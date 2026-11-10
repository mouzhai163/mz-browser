use super::cdp::CdpEndpointManager;
use super::gecko;
use super::job::JobManager;
use super::types::{
    BatchLaunchResult, CdpEndpointResponse, EnvironmentStartRequest, KernelEngine,
    RpaTabCloseResult, RpaTabSelection, RpaTabsSnapshot, WindowBoundsRequest,
};
use crate::app::{EventPublisher, Result, RuntimeError};
use crate::infrastructure::diagnostics::{log_info, log_warn};
use crate::infrastructure::eventbus::{LaunchConfig, Message, eventbus_manager};
use crate::infrastructure::eventbus::{Topic, get_eventbus_manager};
use crate::services::environment::{EnvironmentStatus, EnvironmentStatusManager};
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use tokio::process::Child;

const BROWSER_STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
const CDP_STARTUP_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(serde::Serialize)]
struct RpaCommandPayload<'a> {
    action: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    position: Option<u32>,
}

pub async fn launch_browser(
    request: EnvironmentStartRequest,
    cdp_endpoint_manager: Arc<CdpEndpointManager>,
    job_manager: Arc<JobManager>,
    status_manager: Arc<EnvironmentStatusManager>,
    events: EventPublisher,
) -> Result<CdpEndpointResponse> {
    if request.engine == KernelEngine::Gecko {
        return gecko::launch_browser(request, cdp_endpoint_manager, job_manager, status_manager, events)
            .await;
    }
    let env_id = request.env_uuid.trim().to_string();
    if matches!(
        status_manager.get_status(&env_id).await,
        Some(
            EnvironmentStatus::Initializing
                | EnvironmentStatus::Starting
                | EnvironmentStatus::Running
                | EnvironmentStatus::Stopping
        )
    ) {
        return Err(RuntimeError::InvalidState(format!(
            "environment {} is already active",
            env_id
        )));
    }
    status_manager.set_status(&env_id, EnvironmentStatus::Initializing).await;
    status_manager.set_status(&env_id, EnvironmentStatus::Starting).await;

    let path = Path::new(&request.exe_path);
    if !path.exists() {
        let error = RuntimeError::Internal("可执行文件不存在".into());
        fail_launch(
            &env_id,
            "executable_check",
            &error,
            cdp_endpoint_manager,
            job_manager,
            status_manager,
            events,
        )
        .await;
        return Err(error);
    }
    let work_dir = match path.parent() {
        Some(work_dir) => work_dir,
        None => {
            let error = RuntimeError::Internal("无法获取可执行文件所在目录".into());
            fail_launch(
                &env_id,
                "executable_check",
                &error,
                cdp_endpoint_manager,
                job_manager,
                status_manager,
                events,
            )
            .await;
            return Err(error);
        }
    };

    let cdp_port = match cdp_endpoint_manager.allocate_port(&env_id).await {
        Ok(port) => port,
        Err(error) => {
            fail_launch(
                &env_id,
                "cdp_port_allocation",
                &error,
                cdp_endpoint_manager,
                job_manager,
                status_manager,
                events,
            )
            .await;
            return Err(error);
        }
    };

    let launch_config = LaunchConfig {
        env_uuid: env_id.clone(),
        user_data_dir: request.user_data_dir.clone(),
        proxy: request.proxy.clone(),
        kernel_version: None,
        extensions: None,
        custom_flags: None,
        cookies: request.cookies.clone(),
        urls: request.urls.clone(),
        fingerprint_config: request.fingerprint_config.clone(),
        accounts: request.accounts.clone(),
        // 没有代理 = 环境明确配置为直连；有代理但没带过来则由浏览器视为"代理丢失"并断网
        direct_connection: request.proxy.is_none(),
    };

    let mut server_ready = eventbus_manager().start_server(env_id.clone(), Some(launch_config));

    let browser = spawn_browser_process(
        &request.exe_path,
        work_dir,
        &env_id,
        &request.user_data_dir,
        cdp_port,
        request.display_id.as_deref(),
        request.window_position.as_deref(),
        request.window_size.as_deref(),
        request.extension_dirs.as_ref(),
        request
            .fingerprint_config
            .as_ref()
            .and_then(|config| config.interface_language.as_deref().or(config.language.as_deref())),
        job_manager.clone(),
    )
    .await;

    let browser = match browser {
        Ok(browser) => browser,
        Err(error) => {
            fail_launch(
                &env_id,
                "process_spawn",
                &error,
                cdp_endpoint_manager.clone(),
                job_manager.clone(),
                status_manager.clone(),
                events.clone(),
            )
            .await;
            return Err(error);
        }
    };

    let browser =
        match wait_for_browser_ready(&env_id, browser, &mut server_ready, &request.user_data_dir)
            .await
        {
            Ok(browser) => browser,
            Err(error) => {
                fail_launch(
                    &env_id,
                    "eventbus_handshake",
                    &error,
                    cdp_endpoint_manager.clone(),
                    job_manager.clone(),
                    status_manager.clone(),
                    events.clone(),
                )
                .await;
                return Err(error);
            }
        };

    let (mut browser, browser_ws_url) = match wait_for_cdp_ready(&env_id, cdp_port, browser).await {
        Ok(ready) => ready,
        Err(error) => {
            fail_launch(
                &env_id,
                "cdp_ready",
                &error,
                cdp_endpoint_manager.clone(),
                job_manager.clone(),
                status_manager.clone(),
                events.clone(),
            )
            .await;
            return Err(error);
        }
    };

    status_manager.set_status(&env_id, EnvironmentStatus::Running).await;

    let watched_env_id = env_id.clone();
    tokio::spawn(async move {
        match browser.wait().await {
            Ok(status) => log_info(
                "kernel",
                format!(
                    "Browser process exited for environment {}: {}",
                    watched_env_id, status
                ),
            ),
            Err(error) => log_warn(
                "kernel",
                format!(
                    "Failed to wait for browser process for environment {}: {}",
                    watched_env_id, error
                ),
            ),
        }
    });

    log_info(
        "kernel",
        format!("Browser ready for environment {}", env_id),
    );
    let _ = events.emit(
        "environment.launch_ready",
        &serde_json::json!({
            "env_uuid": env_id,
            "cdp_port": cdp_port,
        }),
    );

    let mut endpoint = cdp_endpoint_manager
        .get_endpoint(&request.env_uuid)
        .await
        .ok_or_else(|| RuntimeError::Internal("failed to resolve cdp endpoint".into()))?;
    endpoint.browser_ws_url = Some(browser_ws_url);

    Ok(CdpEndpointResponse {
        env_uuid: endpoint.env_uuid,
        host: endpoint.host,
        port: endpoint.port,
        version_url: endpoint.version_url,
        list_url: endpoint.list_url,
        browser_ws_url: endpoint.browser_ws_url,
    })
}

async fn wait_for_cdp_ready(
    env_id: &str,
    cdp_port: u16,
    mut browser: Child,
) -> Result<(Child, String)> {
    let version_url = format!("http://127.0.0.1:{}/json/version", cdp_port);
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_millis(500))
        .build()
        .map_err(|error| RuntimeError::Internal(format!("failed to build CDP client: {error}")))?;
    let deadline = tokio::time::Instant::now() + CDP_STARTUP_TIMEOUT;

    loop {
        if let Some(status) = browser.try_wait().map_err(|error| {
            RuntimeError::Internal(format!(
                "failed checking browser process for environment {}: {}",
                env_id, error
            ))
        })? {
            return Err(RuntimeError::Internal(format!(
                "browser process exited before CDP became ready for environment {}: {}",
                env_id, status
            )));
        }

        if let Ok(response) = client.get(&version_url).send().await {
            if response.status().is_success() {
                if let Ok(payload) = response.json::<serde_json::Value>().await {
                    if let Some(ws_url) =
                        payload.get("webSocketDebuggerUrl").and_then(|value| value.as_str())
                    {
                        return Ok((browser, ws_url.to_string()));
                    }
                }
            }
        }

        if tokio::time::Instant::now() >= deadline {
            return Err(RuntimeError::Internal(format!(
                "CDP endpoint {} did not become ready within {} seconds for environment {}",
                version_url,
                CDP_STARTUP_TIMEOUT.as_secs(),
                env_id
            )));
        }

        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

async fn fail_launch(
    env_id: &str,
    stage: &str,
    error: &RuntimeError,
    cdp_endpoint_manager: Arc<CdpEndpointManager>,
    job_manager: Arc<JobManager>,
    status_manager: Arc<EnvironmentStatusManager>,
    events: EventPublisher,
) {
    job_manager.remove(env_id).await;
    cdp_endpoint_manager.remove(env_id).await;
    status_manager.set_status(env_id, EnvironmentStatus::Error).await;
    let _ = events.emit(
        "environment.launch_failed",
        &serde_json::json!({
            "env_uuid": env_id,
            "stage": stage,
            "error": error.to_string(),
        }),
    );
}

async fn wait_for_browser_ready(
    env_id: &str,
    mut browser: Child,
    server_ready: &mut tokio::sync::mpsc::Receiver<crate::infrastructure::eventbus::Result<()>>,
    user_data_dir: &str,
) -> Result<Child> {
    let timeout = tokio::time::sleep(BROWSER_STARTUP_TIMEOUT);
    tokio::pin!(timeout);

    tokio::select! {
        result = server_ready.recv() => {
            match result {
                Some(Ok(())) => Ok(browser),
                Some(Err(error)) => Err(RuntimeError::EventBus(error)),
                None => Err(RuntimeError::Internal(format!(
                    "eventbus startup channel closed for environment {}",
                    env_id
                ))),
            }
        }
        status = browser.wait() => {
            let status = status
                .map_err(|error| RuntimeError::Internal(format!(
                    "failed waiting for browser process for environment {}: {}",
                    env_id, error
                )))?;
            let log_tail = read_browser_log_tail(user_data_dir);
            Err(RuntimeError::Internal(format!(
                "browser process exited before handshake for environment {}: {}{}",
                env_id,
                status,
                log_tail
            )))
        }
        _ = &mut timeout => {
            Err(RuntimeError::Internal(format!(
                "browser handshake timed out after {} seconds for environment {}",
                BROWSER_STARTUP_TIMEOUT.as_secs(),
                env_id
            )))
        }
    }
}

async fn spawn_browser_process(
    exe_path: &str,
    work_dir: &Path,
    env_id: &str,
    user_data_dir: &str,
    cdp_port: u16,
    display_id: Option<&str>,
    window_position: Option<&str>,
    window_size: Option<&str>,
    extension_dirs: Option<&Vec<String>>,
    ui_language: Option<&str>,
    job_manager: Arc<JobManager>,
) -> Result<Child> {
    validate_browser_runtime_layout(exe_path)?;

    let mut args = base_browser_args(env_id, user_data_dir, cdp_port);

    // 浏览器界面语言必须跟随环境配置，而不是宿主机系统语言：表单控件（文件选择按钮、日期框等）
    // 的文字和宽度页面可以读到，系统是德语时会暴露 "Datei auswählen" 之类的文字。
    if let Some(language) = ui_language.and_then(browser_ui_language_arg) {
        args.push(language);
    }

    if cfg!(debug_assertions) {
        args.push("--v=1".to_string());
    }

    if let Some(id) = display_id {
        args.push(format!("--mz-display-id={}", id));
    }
    if let Some(position) = window_position {
        args.push(format!("--window-position={}", position));
    }
    if let Some(size) = window_size {
        args.push(format!("--window-size={}", size));
    }
    if let Some(dirs) = extension_dirs {
        if !dirs.is_empty() {
            args.push(format!("--load-extension={}", dirs.join(",")));
            log_info(
                "kernel",
                format!("Loading {} extensions: {}", dirs.len(), dirs.join(", ")),
            );
        }
    }

    let mut command = tokio::process::Command::new(exe_path);
    command.current_dir(work_dir).args(&args).stdin(Stdio::null());

    // 浏览器日志由内核自己写入 user-data-dir 下的 mz-browser.log（见 base_browser_args 的
    // --log-file）。不要再用 --enable-logging=stderr 并重定向 stderr：Windows 上 Chromium 的
    // 不开沙箱的子进程（如网络服务）拿不到有效的 stderr 时会自己分配一个控制台窗口，
    // 启动后就会弹出黑框。
    command.stdout(Stdio::null()).stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::fs;
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(exe_path)
            .map_err(|error| RuntimeError::Internal(error.to_string()))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(exe_path, perms)
            .map_err(|error| RuntimeError::Internal(error.to_string()))?;
    }

    let mut child = command
        .spawn()
        .map_err(|error| RuntimeError::Internal(format_process_spawn_error(exe_path, error)))?;
    let pid = child.id().ok_or_else(|| {
        RuntimeError::Internal(format!(
            "browser process for environment {} has no pid",
            env_id
        ))
    })?;

    if let Err(error) = job_manager.create_and_assign(env_id, pid).await {
        let _ = child.kill().await;
        let _ = child.wait().await;
        return Err(error);
    }

    log_info(
        "kernel",
        format!(
            "Browser process spawned for environment {} with pid {}",
            env_id, pid
        ),
    );
    Ok(child)
}

/// 把环境配置里的语言（如 "ja-JP"）转成 `--lang=` 参数；只接受 BCP-47 风格的字符，
/// 配置尚未解析（"ip"/空）时返回 None，由浏览器使用默认语言。
fn browser_ui_language_arg(language: &str) -> Option<String> {
    let language = language.trim();
    let valid = !language.is_empty()
        && !language.eq_ignore_ascii_case("ip")
        && language.len() <= 16
        && language
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    valid.then(|| format!("--lang={language}"))
}

fn base_browser_args(env_id: &str, user_data_dir: &str, cdp_port: u16) -> Vec<String> {
    let args = vec![
        format!("--mz-env-id={env_id}"),
        format!("--user-data-dir={user_data_dir}"),
        format!("--remote-debugging-port={cdp_port}"),
        "--remote-debugging-address=127.0.0.1".into(),
        "--remote-allow-origins=tauri://localhost,http://tauri.localhost,http://localhost:5173,http://127.0.0.1:5173".into(),
        "--disable-skia-graphite".into(),
        // 新环境的配置目录第一次启动时，Chromium 会先显示首次运行引导窗口而不是普通浏览器窗口：
        // 起始页等不到浏览器窗口就被放弃，引导窗口还会拖住关闭。环境由软件管理，不需要首次运行流程
        "--no-first-run".into(),
        "--no-default-browser-check".into(),
        "--enable-logging".into(),
        format!(
            "--log-file={}",
            Path::new(user_data_dir).join("mz-browser.log").display()
        ),
    ];
    #[cfg(all(feature = "desktop-e2e", debug_assertions, not(feature = "production")))]
    let args = append_test_certificate(args);
    args
}

#[cfg(all(feature = "desktop-e2e", debug_assertions, not(feature = "production")))]
fn append_test_certificate(mut args: Vec<String>) -> Vec<String> {
    let root = std::env::var_os("MZ_ROOT_DIR").map(std::path::PathBuf::from);
    let spki = std::env::var("MZ_E2E_CERT_SPKI").unwrap_or_default();
    let marked = root.is_some_and(|root| root.is_absolute() && root.join(".mz-desktop-e2e").is_file());
    if marked && spki.len() == 44 && spki.ends_with('=') && spki[..43].bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'+' || byte == b'/') {
        args.push(format!("--ignore-certificate-errors-spki-list={spki}"));
    }
    args
}

fn validate_browser_runtime_layout(exe_path: &str) -> Result<()> {
    let exe = Path::new(exe_path);
    if !exe.is_file() {
        return Err(RuntimeError::Internal(format!(
            "浏览器内核路径无效：{}",
            exe_path
        )));
    }

    Ok(())
}

fn read_browser_log_tail(user_data_dir: &str) -> String {
    let path = Path::new(user_data_dir).join("mz-browser.log");
    let Ok(content) = std::fs::read_to_string(path) else {
        return String::new();
    };
    let tail = content
        .lines()
        .rev()
        .take(12)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join(" | ");
    if tail.is_empty() {
        String::new()
    } else {
        format!("；浏览器日志：{tail}")
    }
}

fn format_process_spawn_error(exe_path: &str, error: std::io::Error) -> String {
    if let Some(message) = windows_policy_error_message(error.raw_os_error()) {
        return format!("{message}：{exe_path}");
    }

    format!("启动浏览器内核失败 {}：{}", exe_path, error)
}

fn windows_policy_error_message(code: Option<i32>) -> Option<&'static str> {
    match code.map(|value| value as u32) {
        Some(577) => Some("Windows 代码完整性拒绝了该内核或其 DLL（错误 577）"),
        Some(1260) => Some("Windows 应用控制策略阻止了该内核（错误 1260）"),
        Some(225) => Some("Windows Defender 阻止了该内核（错误 225）"),
        _ => None,
    }
}

#[cfg(test)]
mod policy_tests {
    use super::{
        read_browser_log_tail, validate_browser_runtime_layout, windows_policy_error_message,
    };

    #[test]
    fn browser_launch_keeps_sandbox_and_limits_debugging_origins() {
        let args = super::base_browser_args("env-1", "test-profile", 29200);
        assert!(
            !args
                .iter()
                .any(|arg| arg == "--no-sandbox" || arg == "--disable-setuid-sandbox")
        );
        assert!(!args.iter().any(|arg| arg == "--remote-allow-origins=*"));
        assert!(args.iter().any(|arg| arg == "--remote-debugging-address=127.0.0.1"));
    }

    #[test]
    fn new_profiles_skip_the_first_run_flow() {
        let args = super::base_browser_args("env-1", "test-profile", 29200);
        assert!(args.iter().any(|arg| arg == "--no-first-run"));
        assert!(args.iter().any(|arg| arg == "--no-default-browser-check"));
    }

    #[test]
    fn ui_language_follows_the_environment_config() {
        assert_eq!(super::browser_ui_language_arg("ja-JP").as_deref(), Some("--lang=ja-JP"));
        assert_eq!(super::browser_ui_language_arg(" en-US ").as_deref(), Some("--lang=en-US"));
        assert_eq!(super::browser_ui_language_arg("ip"), None);
        assert_eq!(super::browser_ui_language_arg(""), None);
        assert_eq!(super::browser_ui_language_arg("en-US --no-sandbox"), None);
    }

    #[test]
    fn browser_logs_to_a_file_and_never_to_stderr() {
        // --enable-logging=stderr makes unsandboxed child processes pop up console windows.
        let args = super::base_browser_args("env-1", "test-profile", 29200);
        assert!(!args.iter().any(|arg| arg.starts_with("--enable-logging=")));
        assert!(args.iter().any(|arg| arg == "--enable-logging"));
        assert!(args.iter().any(|arg| arg.starts_with("--log-file=") && arg.ends_with("mz-browser.log")));
    }

    #[test]
    fn maps_windows_policy_errors_to_actionable_messages() {
        for (code, expected) in [
            (577, "代码完整性"),
            (1260, "应用控制策略"),
            (225, "Defender"),
        ] {
            assert!(windows_policy_error_message(Some(code)).unwrap().contains(expected));
        }
        assert!(windows_policy_error_message(Some(2)).is_none());
    }

    #[test]
    fn reads_only_the_tail_of_the_browser_log() {
        let dir = std::env::temp_dir().join(format!(
            "mz-browser-log-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let lines = (1..=15).map(|line| format!("line-{line}")).collect::<Vec<_>>();
        std::fs::write(dir.join("mz-browser.log"), lines.join("\n")).unwrap();

        let tail = read_browser_log_tail(dir.to_str().unwrap());

        assert!(tail.starts_with("；浏览器日志：line-4 | line-5"));
        assert!(tail.ends_with("line-15"));
        assert!(!tail.contains("line-3"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn missing_browser_log_does_not_add_noise() {
        let dir = std::env::temp_dir().join(format!(
            "mz-browser-log-missing-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));

        assert_eq!(read_browser_log_tail(dir.to_str().unwrap()), "");
    }

    #[test]
    fn accepts_a_kernel_without_standalone_crashpad_handler() {
        let dir = std::env::temp_dir().join(format!(
            "mz-kernel-layout-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let exe = dir.join("mz.exe");
        std::fs::write(&exe, b"test").unwrap();

        let result = validate_browser_runtime_layout(exe.to_str().unwrap());

        assert!(result.is_ok());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_a_missing_browser_executable() {
        let dir = std::env::temp_dir().join(format!(
            "mz-kernel-layout-missing-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let exe = dir.join("mz.exe");

        let error = validate_browser_runtime_layout(exe.to_str().unwrap()).unwrap_err();

        assert!(error.to_string().contains("浏览器内核路径无效"));
    }
}

pub async fn stop_environment(
    env_uuid: String,
    cdp_endpoint_manager: Arc<CdpEndpointManager>,
    job_manager: Arc<JobManager>,
    status_manager: Arc<EnvironmentStatusManager>,
    events: EventPublisher,
) -> Result<()> {
    let env_id = env_uuid.trim().to_string();
    if gecko::instance(&env_id).await.is_some() {
        return gecko::stop_environment(&env_id, cdp_endpoint_manager, job_manager, status_manager, events)
            .await;
    }
    let manager = eventbus_manager();

    if !manager.is_connected(&env_id).await {
        return Err(RuntimeError::Internal(format!("环境 {} 未连接", env_id)));
    }

    status_manager.set_status(&env_id, EnvironmentStatus::Stopping).await;
    if let Err(error) = manager.disconnect(&env_id).await {
        log_warn("kernel", format!("Close request failed for {env_id}; waiting for the owned process: {error}"));
    }
    #[cfg(target_os = "windows")]
    let forced = match job_manager.finish_process(&env_id).await? {
        Some(forced) => forced,
        None => return Ok(()),
    };
    #[cfg(not(target_os = "windows"))]
    let forced = false;
    #[cfg(not(target_os = "windows"))]
    job_manager.remove(&env_id).await;
    if forced {
        log_warn("kernel", format!("Forced shutdown for {env_id}; profile flush is not guaranteed"));
    }
    cdp_endpoint_manager.remove(&env_id).await;
    status_manager.set_status(&env_id, EnvironmentStatus::Stopped).await;
    let _ = events.emit(
        "environment.stopped",
        &serde_json::json!({ "env_uuid": env_id, "forced": forced }),
    );
    Ok(())
}

pub async fn refresh_proxy(
    env_uuid: String,
    proxy: Option<super::types::BrowserProxyConfigPayload>,
    events: EventPublisher,
) -> Result<()> {
    let env_id = env_uuid.trim().to_string();
    if gecko::instance(&env_id).await.is_some() {
        gecko::refresh_proxy(&env_id, proxy.as_ref()).await?;
        let _ = events.emit("environment.proxy_refreshed", &serde_json::json!({ "env_uuid": env_id }));
        return Ok(());
    }
    let manager = eventbus_manager();

    if !manager.is_connected(&env_id).await {
        return Err(RuntimeError::Internal(format!("环境 {} 未连接", env_id)));
    }

    let proxy_payload = match proxy {
        Some(proxy) => serde_json::to_vec(&proxy)
            .map_err(|error| RuntimeError::Serialization(error.to_string()))?,
        None => b"null".to_vec(),
    };

    manager.send_event(&env_id, Topic::ProxySet, proxy_payload).await?;
    let _ = events.emit(
        "environment.proxy_refreshed",
        &serde_json::json!({ "env_uuid": env_id }),
    );
    Ok(())
}

pub async fn set_window_bounds(request: WindowBoundsRequest, events: EventPublisher) -> Result<()> {
    let env_id = request.env_uuid.trim().to_string();
    if gecko::instance(&env_id).await.is_some() {
        gecko::set_window_bounds(&env_id, request.x, request.y, request.width, request.height).await?;
    } else {
        let manager = eventbus_manager();
        if !manager.is_connected(&env_id).await {
            return Err(RuntimeError::Internal(format!("环境 {} 未连接", env_id)));
        }
        let payload =
            encode_window_bounds_payload(request.x, request.y, request.width, request.height)?;
        let message = Message::event(Topic::WindowSetBounds, payload);
        manager.send(&env_id, &message).await?;
    }

    let _ = events.emit(
        "environment.window_bounds_updated",
        &serde_json::json!({
            "env_uuid": env_id,
            "x": request.x,
            "y": request.y,
            "width": request.width,
            "height": request.height,
        }),
    );
    Ok(())
}

pub async fn get_connected_environments() -> Result<Vec<String>> {
    let mut envs = match get_eventbus_manager() {
        Some(manager) => manager.connected_envs().await,
        None => vec![],
    };
    envs.extend(gecko::running_envs().await);
    Ok(envs)
}

pub async fn get_cdp_endpoint(
    env_uuid: String,
    cdp_endpoint_manager: Arc<CdpEndpointManager>,
) -> Result<Option<CdpEndpointResponse>> {
    let env_id = env_uuid.trim().to_string();
    if let Some(instance) = gecko::instance(&env_id).await {
        return Ok(Some(CdpEndpointResponse {
            env_uuid: env_id,
            host: "127.0.0.1".into(),
            port: instance.port,
            version_url: String::new(),
            list_url: String::new(),
            browser_ws_url: Some(instance.ws_url()),
        }));
    }
    Ok(cdp_endpoint_manager
        .get_endpoint(&env_id)
        .await
        .map(|endpoint| CdpEndpointResponse {
            env_uuid: endpoint.env_uuid,
            host: endpoint.host,
            port: endpoint.port,
            version_url: endpoint.version_url,
            list_url: endpoint.list_url,
            browser_ws_url: endpoint.browser_ws_url,
        }))
}

pub async fn list_rpa_tabs(env_uuid: String) -> Result<RpaTabsSnapshot> {
    let env_id = env_uuid.trim().to_string();
    if gecko::instance(&env_id).await.is_some() {
        return gecko::list_rpa_tabs(&env_id).await;
    }
    let manager = eventbus_manager();

    if !manager.is_connected(&env_id).await {
        return Err(RuntimeError::Internal(format!("环境 {} 未连接", env_id)));
    }

    let response = manager
        .send_request(
            &env_id,
            Topic::RpaCommand,
            encode_rpa_command("list_tabs", None)?,
        )
        .await?;

    decode_rpa_response::<RpaTabsSnapshot>(response)
}

pub async fn select_rpa_tab(env_uuid: String, position: u32) -> Result<RpaTabSelection> {
    let env_id = env_uuid.trim().to_string();
    if gecko::instance(&env_id).await.is_some() {
        return gecko::select_rpa_tab(&env_id, position).await;
    }
    let manager = eventbus_manager();

    if !manager.is_connected(&env_id).await {
        return Err(RuntimeError::Internal(format!("环境 {} 未连接", env_id)));
    }

    let response = manager
        .send_request(
            &env_id,
            Topic::RpaCommand,
            encode_rpa_command("select_tab", Some(position))?,
        )
        .await?;

    decode_rpa_response::<RpaTabSelection>(response)
}

pub async fn close_rpa_tab(env_uuid: String, position: u32) -> Result<RpaTabCloseResult> {
    let env_id = env_uuid.trim().to_string();
    if gecko::instance(&env_id).await.is_some() {
        return gecko::close_rpa_tab(&env_id, position).await;
    }
    let manager = eventbus_manager();

    if !manager.is_connected(&env_id).await {
        return Err(RuntimeError::Internal(format!("环境 {} 未连接", env_id)));
    }

    let response = manager
        .send_request(
            &env_id,
            Topic::RpaCommand,
            encode_rpa_command("close_tab", Some(position))?,
        )
        .await?;

    decode_rpa_response::<RpaTabCloseResult>(response)
}

pub async fn batch_launch_environments(
    requests: Vec<EnvironmentStartRequest>,
    cdp_endpoint_manager: Arc<CdpEndpointManager>,
    job_manager: Arc<JobManager>,
    status_manager: Arc<EnvironmentStatusManager>,
    events: EventPublisher,
) -> Result<Vec<BatchLaunchResult>> {
    let tasks: Vec<_> = requests
        .into_iter()
        .enumerate()
        .map(|(index, request)| {
            let env_uuid = request.env_uuid.clone();
            let cdp_endpoint_manager = cdp_endpoint_manager.clone();
            let job_manager = job_manager.clone();
            let status_manager = status_manager.clone();
            let events = events.clone();

            tokio::spawn(async move {
                let delay = (index as u64) * 50 + (rand::random::<u64>() % 200);
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;

                let result = launch_browser(
                    request,
                    cdp_endpoint_manager,
                    job_manager,
                    status_manager,
                    events,
                )
                .await;

                BatchLaunchResult {
                    env_uuid,
                    success: result.is_ok(),
                    error: result.err().map(|error| error.to_string()),
                }
            })
        })
        .collect();

    let mut results = Vec::new();
    for task in tasks {
        if let Ok(result) = task.await {
            results.push(result);
        }
    }

    Ok(results)
}

fn encode_window_bounds_payload(x: i32, y: i32, width: i32, height: i32) -> Result<Vec<u8>> {
    if width <= 0 || height <= 0 {
        return Err(RuntimeError::Internal("窗口宽高必须大于 0".into()));
    }

    let mut payload = Vec::with_capacity(16);
    payload.extend_from_slice(&x.to_le_bytes());
    payload.extend_from_slice(&y.to_le_bytes());
    payload.extend_from_slice(&width.to_le_bytes());
    payload.extend_from_slice(&height.to_le_bytes());
    Ok(payload)
}

fn encode_rpa_command(action: &str, position: Option<u32>) -> Result<Vec<u8>> {
    serde_json::to_vec(&RpaCommandPayload { action, position })
        .map_err(|error| RuntimeError::Serialization(error.to_string()))
}

fn decode_rpa_response<T>(response: Message) -> Result<T>
where
    T: serde::de::DeserializeOwned,
{
    if response.error_code != 0 {
        return Err(RuntimeError::Internal(read_rpa_error_message(
            &response.data,
        )));
    }

    serde_json::from_slice(&response.data)
        .map_err(|error| RuntimeError::Serialization(error.to_string()))
}

fn read_rpa_error_message(data: &[u8]) -> String {
    #[derive(serde::Deserialize)]
    struct ErrorPayload {
        message: Option<String>,
    }

    serde_json::from_slice::<ErrorPayload>(data)
        .ok()
        .and_then(|payload| payload.message)
        .filter(|message| !message.trim().is_empty())
        .unwrap_or_else(|| "RPA_COMMAND_FAILED".to_string())
}

#[cfg(test)]
mod tests {
    use super::encode_window_bounds_payload;

    #[test]
    fn window_bounds_payload_is_little_endian_i32_sequence() {
        let payload = encode_window_bounds_payload(10, 20, 1280, 720).unwrap();

        assert_eq!(payload.len(), 16);
        assert_eq!(i32::from_le_bytes(payload[0..4].try_into().unwrap()), 10);
        assert_eq!(i32::from_le_bytes(payload[4..8].try_into().unwrap()), 20);
        assert_eq!(i32::from_le_bytes(payload[8..12].try_into().unwrap()), 1280);
        assert_eq!(i32::from_le_bytes(payload[12..16].try_into().unwrap()), 720);
    }

    #[test]
    fn window_bounds_payload_rejects_non_positive_size() {
        assert!(encode_window_bounds_payload(0, 0, 0, 720).is_err());
        assert!(encode_window_bounds_payload(0, 0, 1280, -1).is_err());
    }
}

pub async fn batch_stop_environments(
    env_uuids: Vec<String>,
    cdp_endpoint_manager: Arc<CdpEndpointManager>,
    job_manager: Arc<JobManager>,
    status_manager: Arc<EnvironmentStatusManager>,
    events: EventPublisher,
) -> Result<Vec<BatchLaunchResult>> {
    let tasks: Vec<_> = env_uuids
        .into_iter()
        .map(|env_uuid| {
            let cdp_endpoint_manager = cdp_endpoint_manager.clone();
            let job_manager = job_manager.clone();
            let status_manager = status_manager.clone();
            let events = events.clone();
            tokio::spawn(async move {
                let result = stop_environment(
                    env_uuid.clone(),
                    cdp_endpoint_manager,
                    job_manager,
                    status_manager,
                    events,
                )
                .await;

                BatchLaunchResult {
                    env_uuid,
                    success: result.is_ok(),
                    error: result.err().map(|error| error.to_string()),
                }
            })
        })
        .collect();

    let mut results = Vec::new();
    for task in tasks {
        if let Ok(result) = task.await {
            results.push(result);
        }
    }

    Ok(results)
}
