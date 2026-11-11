//! Firefox（Camoufox）环境：启动、BiDi 会话、代理转发、窗口和关闭。
//!
//! 和 Chromium 内核的区别：
//! - 指纹在启动时用环境变量交给内核（`CAMOU_CONFIG_n` / `CAMOU_PREFS_n`），没有命名管道；
//! - 自动化协议是 WebDriver BiDi，一个浏览器只能有一个会话，由这里持有；
//! - 代理一律走本机的 SOCKS5 转发（见 socks_forward），账号密码不进浏览器。

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, OnceLock};
use std::time::Duration;

use serde_json::{Map, Value, json};
use tokio::sync::RwLock;

use super::bidi::BidiConnection;
use super::cdp::CdpEndpointManager;
use super::gecko_relay::{self, Relay};
use super::job::JobManager;
use super::socks_forward::{Forwarder, Upstream};
use super::types::{
    BrowserProxyConfigPayload, CdpEndpointResponse, EnvironmentStartRequest, GeckoLaunchSpec,
    RpaTabCloseResult, RpaTabInfo, RpaTabSelection, RpaTabsSnapshot,
};
use crate::app::{EventPublisher, Result, RuntimeError};
use crate::infrastructure::diagnostics::{log_info, log_warn};
use crate::infrastructure::eventbus::CookieGroup;
use crate::services::environment::{EnvironmentStatus, EnvironmentStatusManager};

const STARTUP_TIMEOUT: Duration = Duration::from_secs(45);
/// Windows 上 autoconfig 用 ANSI 代码页读环境变量，单个变量最长 2047 个字符
const ENV_CHUNK: usize = 2047;
const PROFILE_DIR: &str = "firefox-profile";
const LOG_FILE: &str = "mz-firefox.log";
/// Firefox 被远程控制时会在地址栏画红色斜纹、加一个机器人图标（:root[remotecontrol]）。
/// 只有自动化测试模式能关掉，所以在环境自己的配置目录里用 userChrome.css 盖掉；网页看不到这些界面。
const USER_CHROME_CSS: &str = "/* MZ 指纹浏览器生成，每次启动会覆盖 */
:root[remotecontrol] .urlbar-background {
  background-image: none !important;
}
:root[remotecontrol] #remote-control-box {
  visibility: collapse !important;
  width: 0 !important;
}
";

/// 地址栏可选的搜索引擎（名称、搜索地址、关键字），第一个是默认，和 Chromium 内核一致
const SEARCH_ENGINES: [(&str, &str, &str); 4] = [
    ("Google", "https://www.google.com/search?q={searchTerms}", "@google"),
    ("Bing", "https://www.bing.com/search?q={searchTerms}", "@bing"),
    ("DuckDuckGo", "https://duckduckgo.com/?q={searchTerms}", "@ddg"),
    ("百度", "https://www.baidu.com/s?wd={searchTerms}", "@baidu"),
];

pub struct GeckoInstance {
    pub port: u16,
    bidi: Arc<BidiConnection>,
    forwarder: Forwarder,
    relay: Relay,
}

impl GeckoInstance {
    /// 给 MCP / RPA 用的 BiDi 地址（共用会话的转发端口，不是浏览器自己的端口）
    pub fn ws_url(&self) -> String {
        gecko_relay::relay_url(self.relay.port)
    }
}

fn registry() -> &'static RwLock<HashMap<String, Arc<GeckoInstance>>> {
    static REGISTRY: OnceLock<RwLock<HashMap<String, Arc<GeckoInstance>>>> = OnceLock::new();
    REGISTRY.get_or_init(|| RwLock::new(HashMap::new()))
}

pub async fn instance(env_id: &str) -> Option<Arc<GeckoInstance>> {
    registry().read().await.get(env_id).cloned()
}

pub async fn running_envs() -> Vec<String> {
    registry().read().await.keys().cloned().collect()
}

/// 浏览器自己的 BiDi 地址，只有运行时连它
fn session_url(port: u16) -> String {
    format!("ws://127.0.0.1:{port}/session")
}

/// 把一份 JSON 按长度切成 `NAME_1..NAME_n` 环境变量（Camoufox 读的时候会按序号拼回去）
fn chunked_env(name: &str, data: &Map<String, Value>) -> Vec<(String, String)> {
    // 只用 ASCII：Windows 上 getenv() 走 ANSI 代码页，中文等字符必须写成 \u 转义
    let text = ascii_json(&Value::Object(data.clone()));
    text.as_bytes()
        .chunks(ENV_CHUNK)
        .enumerate()
        .map(|(index, chunk)| (format!("{name}_{}", index + 1), String::from_utf8_lossy(chunk).into_owned()))
        .collect()
}

fn ascii_json(value: &Value) -> String {
    let mut out = String::new();
    for c in value.to_string().chars() {
        if c.is_ascii() {
            out.push(c);
        } else {
            let mut units = [0u16; 2];
            for unit in c.encode_utf16(&mut units) {
                out.push_str(&format!("\\u{unit:04x}"));
            }
        }
    }
    out
}

fn proxy_prefs(forwarder_port: u16) -> Map<String, Value> {
    let mut prefs = Map::new();
    for (key, value) in [
        ("network.proxy.type", json!(1)),
        ("network.proxy.socks", json!("127.0.0.1")),
        ("network.proxy.socks_port", json!(forwarder_port)),
        ("network.proxy.socks_version", json!(5)),
        ("network.proxy.socks_remote_dns", json!(true)),
        ("network.proxy.socks5_remote_dns", json!(true)),
        ("network.proxy.no_proxies_on", json!("")),
        ("network.proxy.failover_direct", json!(false)),
        // 别的协议不再单独设代理，全部走 SOCKS
        ("network.proxy.share_proxy_settings", json!(false)),
        ("network.proxy.http", json!("")),
        ("network.proxy.ssl", json!("")),
    ] {
        prefs.insert(key.into(), value);
    }
    prefs
}

pub async fn launch_browser(
    request: EnvironmentStartRequest,
    cdp_endpoint_manager: Arc<CdpEndpointManager>,
    job_manager: Arc<JobManager>,
    status_manager: Arc<EnvironmentStatusManager>,
    events: EventPublisher,
) -> Result<CdpEndpointResponse> {
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
        return Err(RuntimeError::InvalidState(format!("environment {env_id} is already active")));
    }
    status_manager.set_status(&env_id, EnvironmentStatus::Starting).await;
    // 上一个进程可能还在退出、占着配置目录，等它走完再启动
    #[cfg(target_os = "windows")]
    if let Err(error) = job_manager.finish_process(&env_id).await {
        log::warn!("previous browser of {env_id} did not exit cleanly: {error}");
    }

    match start(&env_id, &request, &cdp_endpoint_manager, &job_manager).await {
        Ok((child, instance)) => {
            let port = instance.port;
            let ws_url = instance.ws_url();
            registry().write().await.insert(env_id.clone(), instance);
            watch_exit(env_id.clone(), child, cdp_endpoint_manager.clone(), job_manager, status_manager.clone(), events.clone());
            status_manager.set_status(&env_id, EnvironmentStatus::Running).await;
            log_info("kernel", format!("Firefox ready for environment {env_id} on port {port}"));
            let _ = events.emit("environment.launch_ready", &json!({ "env_uuid": env_id, "cdp_port": port }));
            emit_connection_status(&events, &env_id, "connected");
            Ok(CdpEndpointResponse {
                env_uuid: env_id,
                host: "127.0.0.1".into(),
                port,
                version_url: String::new(),
                list_url: String::new(),
                browser_ws_url: Some(ws_url),
            })
        }
        Err((stage, error)) => {
            job_manager.remove(&env_id).await;
            cdp_endpoint_manager.remove(&env_id).await;
            status_manager.set_status(&env_id, EnvironmentStatus::Error).await;
            let _ = events.emit(
                "environment.launch_failed",
                &json!({ "env_uuid": env_id, "stage": stage, "error": error.to_string() }),
            );
            Err(error)
        }
    }
}

type StartError = (&'static str, RuntimeError);

async fn start(
    env_id: &str,
    request: &EnvironmentStartRequest,
    cdp_endpoint_manager: &CdpEndpointManager,
    job_manager: &JobManager,
) -> std::result::Result<(tokio::process::Child, Arc<GeckoInstance>), StartError> {
    let internal = |stage: &'static str| move |error: String| (stage, RuntimeError::Internal(error));
    let exe = Path::new(&request.exe_path);
    if !exe.is_file() {
        return Err(("executable_check", RuntimeError::Internal("可执行文件不存在".into())));
    }
    let spec = request.gecko.clone().ok_or_else(|| {
        ("launch_spec", RuntimeError::Internal("Firefox 环境缺少启动配置".into()))
    })?;
    let port = cdp_endpoint_manager.allocate_port(env_id).await.map_err(|error| ("cdp_port_allocation", error))?;

    let upstream = Upstream::from_proxy(request.proxy.as_ref()).map_err(internal("proxy"))?;
    let forwarder = Forwarder::start(upstream).await.map_err(internal("proxy"))?;

    if let Some(kernel_dir) = exe.parent() {
        if let Err(error) = ensure_search_policy(kernel_dir) {
            // 只影响地址栏搜索，浏览器照常启动
            log_warn("kernel", format!("Could not set the Firefox search engine policy: {error}"));
        }
    }

    let profile = Path::new(&request.user_data_dir).join(PROFILE_DIR);
    std::fs::create_dir_all(&profile)
        .map_err(|error| ("profile", RuntimeError::Internal(format!("无法创建 Firefox 配置目录：{error}"))))?;
    if let Err(error) = write_user_chrome(&profile) {
        log_warn("kernel", format!("Could not write the Firefox UI stylesheet for {env_id}: {error}"));
    }

    let mut child = spawn(exe, &profile, &request.user_data_dir, port, &spec, forwarder.port)
        .map_err(|error| ("process_spawn", error))?;
    let pid = child.id().ok_or_else(|| ("process_spawn", RuntimeError::Internal("Firefox 进程没有 pid".into())))?;
    if let Err(error) = job_manager.create_and_assign(env_id, pid).await {
        let _ = child.kill().await;
        return Err(("process_spawn", error));
    }
    log_info("kernel", format!("Firefox spawned for environment {env_id} with pid {pid}"));

    let (bidi, capabilities) = match wait_for_session(&mut child, port, &request.user_data_dir).await {
        Ok(ready) => ready,
        Err(error) => {
            let _ = child.kill().await;
            return Err(("bidi_ready", error));
        }
    };
    let relay = match gecko_relay::start(bidi.clone(), capabilities).await {
        Ok(relay) => relay,
        Err(error) => {
            let _ = child.kill().await;
            return Err(("bidi_ready", RuntimeError::Internal(error)));
        }
    };

    if let Err(error) = prepare_browser(&bidi, request, &spec).await {
        // 窗口、Cookie、起始页没设好不影响浏览器本身可用，只记下来
        log_warn("kernel", format!("Firefox post-launch setup for {env_id} was incomplete: {error}"));
    }

    Ok((child, Arc::new(GeckoInstance { port, bidi, forwarder, relay })))
}

/// Camoufox 去掉了 Firefox 的内置搜索引擎：代码里写死只有一个叫 "None" 的引擎（搜索地址是
/// 127.0.0.1），企业策略也把它设成默认，地址栏没法搜索。内置引擎回不来，所以这里用企业策略
/// 加上常用引擎、默认 Google，并隐藏 "None"；只替换策略里的搜索部分，其余防护策略不动。
/// 策略文件在内核目录里、所有环境共用，内容没变时不写。
fn ensure_search_policy(kernel_dir: &Path) -> std::result::Result<(), String> {
    let path = kernel_dir.join("distribution").join("policies.json");
    let mut document: Value = match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|error| format!("{}: {error}", path.display()))?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => json!({ "policies": {} }),
        Err(error) => return Err(format!("{}: {error}", path.display())),
    };
    if !with_search_policy(&mut document) {
        return Ok(());
    }
    let text = serde_json::to_string_pretty(&document).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(path.parent().unwrap_or(kernel_dir)).map_err(|error| error.to_string())?;
    // 几个环境同时启动时写的是同一份内容，先写临时文件再替换，避免读到写了一半的文件
    let temp = path.with_extension(format!("json.{}.tmp", std::process::id()));
    std::fs::write(&temp, text).map_err(|error| format!("{}: {error}", temp.display()))?;
    std::fs::rename(&temp, &path).map_err(|error| {
        let _ = std::fs::remove_file(&temp);
        format!("{}: {error}", path.display())
    })
}

fn write_user_chrome(profile: &Path) -> std::io::Result<()> {
    let dir = profile.join("chrome");
    std::fs::create_dir_all(&dir)?;
    let path = dir.join("userChrome.css");
    if std::fs::read_to_string(&path).is_ok_and(|text| text == USER_CHROME_CSS) {
        return Ok(());
    }
    std::fs::write(path, USER_CHROME_CSS)
}

fn search_policy() -> Value {
    let engines: Vec<Value> = SEARCH_ENGINES
        .iter()
        .map(|(name, url, alias)| json!({ "Name": name, "URLTemplate": url, "Method": "GET", "Alias": alias }))
        .collect();
    json!({ "Add": engines, "Default": SEARCH_ENGINES[0].0, "Remove": ["None"] })
}

/// 改成我们要的搜索策略，返回内容是否有变化
fn with_search_policy(document: &mut Value) -> bool {
    if !document.is_object() {
        *document = json!({});
    }
    let root = document.as_object_mut().expect("object");
    let policies = root.entry("policies").or_insert_with(|| json!({}));
    if !policies.is_object() {
        *policies = json!({});
    }
    let wanted = search_policy();
    let policies = policies.as_object_mut().expect("object");
    if policies.get("SearchEngines") == Some(&wanted) {
        return false;
    }
    policies.insert("SearchEngines".into(), wanted);
    true
}

fn spawn(
    exe: &Path,
    profile: &Path,
    user_data_dir: &str,
    port: u16,
    spec: &GeckoLaunchSpec,
    forwarder_port: u16,
) -> Result<tokio::process::Child> {
    let mut prefs = spec.prefs.clone();
    prefs.extend(proxy_prefs(forwarder_port));
    // 让 Firefox 读配置目录里的 userChrome.css（见 USER_CHROME_CSS）
    prefs.insert("toolkit.legacyUserProfileCustomizations.stylesheets".into(), json!(true));

    let mut command = tokio::process::Command::new(exe);
    command
        .current_dir(exe.parent().unwrap_or(Path::new(".")))
        .arg("-profile")
        .arg(profile)
        .args(["-no-remote", "-wait-for-browser", "-foreground"])
        .arg("--remote-debugging-port")
        .arg(port.to_string())
        .stdin(Stdio::null());
    // 不继承宿主机上可能残留的同名变量，避免拼进别的配置
    for (key, _) in std::env::vars() {
        if key.starts_with("CAMOU_") {
            command.env_remove(key);
        }
    }
    for (key, value) in chunked_env("CAMOU_CONFIG", &spec.config).into_iter().chain(chunked_env("CAMOU_PREFS", &prefs)) {
        command.env(key, value);
    }

    let log_path = PathBuf::from(user_data_dir).join(LOG_FILE);
    let log = std::fs::File::create(&log_path)
        .map_err(|error| RuntimeError::Internal(format!("无法创建 Firefox 日志 {}: {error}", log_path.display())))?;
    let log_err = log.try_clone().map_err(|error| RuntimeError::Internal(error.to_string()))?;
    command.stdout(Stdio::from(log)).stderr(Stdio::from(log_err));

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
        .spawn()
        .map_err(|error| RuntimeError::Internal(format!("启动 Firefox 内核失败 {}：{error}", exe.display())))
}

fn log_tail(user_data_dir: &str) -> String {
    let Ok(content) = std::fs::read_to_string(Path::new(user_data_dir).join(LOG_FILE)) else {
        return String::new();
    };
    let lines: Vec<&str> = content.lines().rev().take(8).collect();
    if lines.is_empty() {
        return String::new();
    }
    format!("；浏览器日志：{}", lines.into_iter().rev().collect::<Vec<_>>().join(" | "))
}

async fn wait_for_session(
    child: &mut tokio::process::Child,
    port: u16,
    user_data_dir: &str,
) -> Result<(Arc<BidiConnection>, Value)> {
    let deadline = tokio::time::Instant::now() + STARTUP_TIMEOUT;
    loop {
        if let Ok(Some(status)) = child.try_wait() {
            return Err(RuntimeError::Internal(format!(
                "Firefox 在就绪前退出：{status}{}",
                log_tail(user_data_dir)
            )));
        }
        if let Ok(bidi) = BidiConnection::connect(&session_url(port)).await {
            // 页面弹出的 alert/confirm 留给用户处理，不由会话自动关掉
            let capabilities = json!({ "alwaysMatch": { "unhandledPromptBehavior": { "default": "ignore" } } });
            let session = bidi
                .call("session.new", json!({ "capabilities": capabilities }))
                .await
                .map_err(RuntimeError::Internal)?;
            let capabilities = session.get("capabilities").cloned().unwrap_or_else(|| json!({}));
            return Ok((bidi, capabilities));
        }
        if tokio::time::Instant::now() >= deadline {
            return Err(RuntimeError::Internal(format!(
                "Firefox 在 {} 秒内没有就绪{}",
                STARTUP_TIMEOUT.as_secs(),
                log_tail(user_data_dir)
            )));
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}

async fn prepare_browser(
    bidi: &BidiConnection,
    request: &EnvironmentStartRequest,
    spec: &GeckoLaunchSpec,
) -> std::result::Result<(), String> {
    let mut problems = Vec::new();
    if let Some((x, y, width, height)) = spec.window {
        if let Err(error) = set_bounds(bidi, x, y, width, height).await {
            problems.push(error);
        }
    }
    for group in request.cookies.iter().flatten() {
        if let Err(error) = set_cookies(bidi, group).await {
            problems.push(error);
        }
    }
    let urls: Vec<&String> = request.urls.iter().flatten().filter(|url| !url.trim().is_empty()).collect();
    if !urls.is_empty() {
        if let Err(error) = open_urls(bidi, &urls).await {
            problems.push(error);
        }
    }
    if problems.is_empty() { Ok(()) } else { Err(problems.join("；")) }
}

/// 可见的主窗口。Firefox 还有一个放在 (32767, 32767) 的隐藏窗口，不能动它。
async fn main_window(bidi: &BidiConnection) -> std::result::Result<String, String> {
    let windows = bidi.call("browser.getClientWindows", json!({})).await?;
    windows
        .get("clientWindows")
        .and_then(Value::as_array)
        .and_then(|windows| {
            windows
                .iter()
                .filter(|window| window.get("x").and_then(Value::as_i64) != Some(32767))
                .max_by_key(|window| window.get("active").and_then(Value::as_bool).unwrap_or(false))
        })
        .and_then(|window| window.get("clientWindow").and_then(Value::as_str))
        .map(ToOwned::to_owned)
        .ok_or_else(|| "没有找到浏览器窗口".to_string())
}

async fn set_bounds(bidi: &BidiConnection, x: i32, y: i32, width: i32, height: i32) -> std::result::Result<(), String> {
    let window = main_window(bidi).await?;
    bidi.call(
        "browser.setClientWindowState",
        json!({ "clientWindow": window, "state": "normal", "x": x, "y": y, "width": width, "height": height }),
    )
    .await
    .map(|_| ())
}

fn cookie_domain(site: &str) -> Option<String> {
    let rest = site.split_once("://").map_or(site, |(_, rest)| rest);
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    let host = authority.rsplit_once('@').map_or(authority, |(_, host)| host);
    let host = host.split(':').next().unwrap_or("").trim().trim_start_matches('.');
    (!host.is_empty()).then(|| host.to_ascii_lowercase())
}

async fn set_cookies(bidi: &BidiConnection, group: &CookieGroup) -> std::result::Result<(), String> {
    let domain = cookie_domain(&group.site).ok_or_else(|| format!("Cookie 网站地址无效：{}", group.site))?;
    for pair in group.cookie_text.split(';') {
        let Some((name, value)) = pair.split_once('=') else { continue };
        let name = name.trim();
        if name.is_empty() {
            continue;
        }
        bidi.call(
            "storage.setCookie",
            json!({ "cookie": {
                "name": name,
                "value": { "type": "string", "value": value.trim() },
                "domain": domain,
                "path": "/",
            }}),
        )
        .await?;
    }
    Ok(())
}

async fn top_level_contexts(bidi: &BidiConnection) -> std::result::Result<Vec<Value>, String> {
    let tree = bidi.call("browsingContext.getTree", json!({ "maxDepth": 0 })).await?;
    Ok(tree.get("contexts").and_then(Value::as_array).cloned().unwrap_or_default())
}

async fn open_urls(bidi: &BidiConnection, urls: &[&String]) -> std::result::Result<(), String> {
    let first = top_level_contexts(bidi)
        .await?
        .first()
        .and_then(|context| context.get("context").and_then(Value::as_str).map(ToOwned::to_owned))
        .ok_or_else(|| "没有可用的标签页".to_string())?;
    bidi.call("browsingContext.navigate", json!({ "context": first, "url": urls[0], "wait": "none" })).await?;
    for url in &urls[1..] {
        let created = bidi.call("browsingContext.create", json!({ "type": "tab", "background": true })).await?;
        if let Some(context) = created.get("context").and_then(Value::as_str) {
            bidi.call("browsingContext.navigate", json!({ "context": context, "url": url, "wait": "none" })).await?;
        }
    }
    Ok(())
}

/// 进程自己退出（用户关了窗口、崩溃）时清理状态；正常关闭时这里也会走到，清理是幂等的。
fn watch_exit(
    env_id: String,
    mut child: tokio::process::Child,
    cdp_endpoint_manager: Arc<CdpEndpointManager>,
    job_manager: Arc<JobManager>,
    status_manager: Arc<EnvironmentStatusManager>,
    events: EventPublisher,
) {
    tokio::spawn(async move {
        let status = child.wait().await;
        log_info("kernel", format!("Firefox exited for environment {env_id}: {status:?}"));
        let removed = registry().write().await.remove(&env_id).is_some();
        if !removed {
            return; // 同一环境已经被 stop 清理过，或者已经重新启动
        }
        #[cfg(target_os = "windows")]
        let _ = job_manager.finish_process(&env_id).await;
        #[cfg(not(target_os = "windows"))]
        job_manager.remove(&env_id).await;
        cdp_endpoint_manager.remove(&env_id).await;
        status_manager.set_stopped_unless_error(&env_id).await;
        let _ = events.emit("environment.browser_disconnected", &json!({ "env_uuid": env_id }));
        emit_connection_status(&events, &env_id, "disconnected");
    });
}

/// 界面上的环境列表、RPA 编辑器、同步器都靠连接状态事件刷新。Chromium 环境由内核里的扩展
/// 连上事件总线时发出；Firefox 没有这条连接，所以在浏览器就绪和退出时由这里补发同样的事件。
fn emit_connection_status(events: &EventPublisher, env_id: &str, status: &str) {
    let _ = events.emit("eventbus.connection_status", &json!({ "env_id": env_id, "status": status }));
}

pub async fn stop_environment(
    env_id: &str,
    cdp_endpoint_manager: Arc<CdpEndpointManager>,
    job_manager: Arc<JobManager>,
    status_manager: Arc<EnvironmentStatusManager>,
    events: EventPublisher,
) -> Result<()> {
    let Some(instance) = registry().write().await.remove(env_id) else {
        return Err(RuntimeError::Internal(format!("环境 {env_id} 未连接")));
    };
    status_manager.set_status(env_id, EnvironmentStatus::Stopping).await;
    // browser.close 让 Firefox 正常退出、写完配置；之后由 job 等待进程真正结束
    if let Err(error) = instance.bidi.call("browser.close", json!({})).await {
        log_warn("kernel", format!("Firefox close request failed for {env_id}: {error}"));
    }
    drop(instance);
    #[cfg(target_os = "windows")]
    let forced = job_manager.finish_process(env_id).await?.unwrap_or(false);
    #[cfg(not(target_os = "windows"))]
    let forced = {
        job_manager.remove(env_id).await;
        false
    };
    if forced {
        log_warn("kernel", format!("Forced Firefox shutdown for {env_id}; profile flush is not guaranteed"));
    }
    cdp_endpoint_manager.remove(env_id).await;
    status_manager.set_status(env_id, EnvironmentStatus::Stopped).await;
    let _ = events.emit("environment.stopped", &json!({ "env_uuid": env_id, "forced": forced }));
    emit_connection_status(&events, env_id, "disconnected");
    Ok(())
}

async fn require(env_id: &str) -> Result<Arc<GeckoInstance>> {
    instance(env_id).await.ok_or_else(|| RuntimeError::Internal(format!("环境 {env_id} 未连接")))
}

pub async fn refresh_proxy(env_id: &str, proxy: Option<&BrowserProxyConfigPayload>) -> Result<()> {
    let instance = require(env_id).await?;
    let upstream = Upstream::from_proxy(proxy).map_err(RuntimeError::Internal)?;
    instance.forwarder.set_upstream(upstream).await;
    Ok(())
}

pub async fn set_window_bounds(env_id: &str, x: i32, y: i32, width: i32, height: i32) -> Result<()> {
    if width <= 0 || height <= 0 {
        return Err(RuntimeError::Internal("窗口宽高必须大于 0".into()));
    }
    let instance = require(env_id).await?;
    set_bounds(&instance.bidi, x, y, width, height).await.map_err(RuntimeError::Internal)
}

async fn read_tabs(bidi: &BidiConnection) -> Result<(Vec<RpaTabInfo>, Option<u32>)> {
    let contexts = top_level_contexts(bidi).await.map_err(RuntimeError::Internal)?;
    let mut tabs = Vec::with_capacity(contexts.len());
    let mut active_position = None;
    for (index, context) in contexts.iter().enumerate() {
        let id = context.get("context").and_then(Value::as_str).unwrap_or_default().to_string();
        let url = context.get("url").and_then(Value::as_str).unwrap_or_default().to_string();
        // 前台标签页的 document.visibilityState 是 visible
        let visible = bidi
            .call(
                "script.evaluate",
                json!({ "expression": "document.visibilityState", "target": { "context": id }, "awaitPromise": false }),
            )
            .await
            .ok()
            .and_then(|result| result.pointer("/result/value").and_then(Value::as_str).map(|state| state == "visible"))
            .unwrap_or(false);
        let title = bidi
            .call(
                "script.evaluate",
                json!({ "expression": "document.title", "target": { "context": id }, "awaitPromise": false }),
            )
            .await
            .ok()
            .and_then(|result| result.pointer("/result/value").and_then(Value::as_str).map(ToOwned::to_owned))
            .unwrap_or_default();
        let position = index as u32;
        if visible && active_position.is_none() {
            active_position = Some(position);
        }
        tabs.push(RpaTabInfo { position, title, url, active: visible, target_id: id });
    }
    Ok((tabs, active_position))
}

pub async fn list_rpa_tabs(env_id: &str) -> Result<RpaTabsSnapshot> {
    let instance = require(env_id).await?;
    let (tabs, active_position) = read_tabs(&instance.bidi).await?;
    let total = tabs.len() as u32;
    Ok(RpaTabsSnapshot { tabs, active_position, total })
}

pub async fn select_rpa_tab(env_id: &str, position: u32) -> Result<RpaTabSelection> {
    let instance = require(env_id).await?;
    let (tabs, _) = read_tabs(&instance.bidi).await?;
    let tab = tabs.get(position as usize).ok_or_else(|| RuntimeError::Internal("TAB_NOT_FOUND".into()))?;
    instance
        .bidi
        .call("browsingContext.activate", json!({ "context": tab.target_id }))
        .await
        .map_err(RuntimeError::Internal)?;
    Ok(RpaTabSelection { position, target_id: tab.target_id.clone() })
}

pub async fn close_rpa_tab(env_id: &str, position: u32) -> Result<RpaTabCloseResult> {
    let instance = require(env_id).await?;
    let (tabs, _) = read_tabs(&instance.bidi).await?;
    if tabs.len() <= 1 {
        return Err(RuntimeError::Internal("LAST_TAB".into()));
    }
    let tab = tabs.get(position as usize).ok_or_else(|| RuntimeError::Internal("TAB_NOT_FOUND".into()))?;
    instance
        .bidi
        .call("browsingContext.close", json!({ "context": tab.target_id }))
        .await
        .map_err(RuntimeError::Internal)?;
    let (rest, active) = read_tabs(&instance.bidi).await?;
    let active_position = active.unwrap_or(0).min(rest.len().saturating_sub(1) as u32);
    Ok(RpaTabCloseResult { closed_position: position, active_position, target_id: tab.target_id.clone() })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_is_split_into_ascii_chunks_that_join_back() {
        let mut config = Map::new();
        config.insert("timezone".into(), json!("Asia/Tokyo"));
        config.insert("fonts".into(), json!(vec!["微软雅黑"; 400]));
        let chunks = chunked_env("CAMOU_CONFIG", &config);
        assert!(chunks.len() > 1);
        assert!(chunks.iter().all(|(_, value)| value.len() <= ENV_CHUNK && value.is_ascii()));
        assert_eq!(chunks[0].0, "CAMOU_CONFIG_1");
        let joined: String = chunks.into_iter().map(|(_, value)| value).collect();
        let back: Value = serde_json::from_str(&joined).unwrap();
        assert_eq!(back["fonts"][0], "微软雅黑");
        assert_eq!(back["timezone"], "Asia/Tokyo");
    }

    #[test]
    fn proxy_prefs_never_fall_back_to_a_direct_connection() {
        let prefs = proxy_prefs(40123);
        assert_eq!(prefs["network.proxy.type"], 1);
        assert_eq!(prefs["network.proxy.socks_port"], 40123);
        assert_eq!(prefs["network.proxy.socks_remote_dns"], true);
        assert_eq!(prefs["network.proxy.failover_direct"], false);
    }

    #[test]
    fn search_policy_keeps_the_other_policies_and_restores_the_engines() {
        let mut document = json!({
            "policies": {
                "DisableTelemetry": true,
                "SearchEngines": {
                    "Remove": ["Google", "Bing"],
                    "Default": "None",
                    "Add": [{ "Name": "None", "URLTemplate": "http://127.0.0.1" }]
                }
            }
        });
        assert!(with_search_policy(&mut document));
        assert_eq!(document["policies"]["DisableTelemetry"], true);
        let search = &document["policies"]["SearchEngines"];
        assert_eq!(search["Default"], "Google");
        assert_eq!(search["Remove"], json!(["None"]));
        let names: Vec<&str> = search["Add"].as_array().unwrap().iter().map(|e| e["Name"].as_str().unwrap()).collect();
        assert_eq!(names, ["Google", "Bing", "DuckDuckGo", "百度"]);
        assert!(search["Add"].as_array().unwrap().iter().all(|e| e["URLTemplate"].as_str().unwrap().contains("{searchTerms}")));
        assert!(!with_search_policy(&mut document), "second pass must not rewrite the file");

        let mut empty = json!({});
        assert!(with_search_policy(&mut empty));
        assert_eq!(empty["policies"]["SearchEngines"]["Default"], "Google");
    }

    #[test]
    fn search_policy_file_is_rewritten_in_place() {
        let dir = std::env::temp_dir().join(format!("mz-gecko-policy-{}", std::process::id()));
        let distribution = dir.join("distribution");
        std::fs::create_dir_all(&distribution).unwrap();
        let file = distribution.join("policies.json");
        std::fs::write(&file, r#"{"policies":{"DisableAppUpdate":true,"SearchEngines":{"Default":"None"}}}"#).unwrap();
        ensure_search_policy(&dir).unwrap();
        let written: Value = serde_json::from_str(&std::fs::read_to_string(&file).unwrap()).unwrap();
        assert_eq!(written["policies"]["DisableAppUpdate"], true);
        assert_eq!(written["policies"]["SearchEngines"]["Default"], "Google");
        assert_eq!(std::fs::read_dir(&distribution).unwrap().count(), 1, "no temp file left behind");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn user_chrome_hides_the_remote_control_cue() {
        let profile = std::env::temp_dir().join(format!("mz-gecko-chrome-{}", std::process::id()));
        write_user_chrome(&profile).unwrap();
        write_user_chrome(&profile).unwrap();
        let css = std::fs::read_to_string(profile.join("chrome").join("userChrome.css")).unwrap();
        assert!(css.contains(":root[remotecontrol] .urlbar-background"));
        assert!(css.contains("#remote-control-box"));
        let _ = std::fs::remove_dir_all(&profile);
    }

    #[test]
    fn cookie_domain_comes_from_the_site_host() {
        assert_eq!(cookie_domain("https://www.example.com/path?q=1").as_deref(), Some("www.example.com"));
        assert_eq!(cookie_domain(".example.com").as_deref(), Some("example.com"));
        assert_eq!(cookie_domain("http://example.com:8080").as_deref(), Some("example.com"));
        assert_eq!(cookie_domain("").as_deref(), None);
    }
}
