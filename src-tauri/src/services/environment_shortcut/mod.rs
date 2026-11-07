//! 环境桌面快捷方式：双击就直接打开对应的环境，不经过工作台界面。
//!
//! 快捷方式指向 `Simprint.exe --open-env=<环境 ID>`（不是浏览器内核本身：内核必须由应用启动，
//! 指纹配置、代理断网保护和启动确认都由应用下发）。
//!
//! - 应用没运行：静默启动（主窗口保持隐藏），启动完成后直接打开该环境；
//! - 应用已在运行：新进程把环境 ID 通过本机命名管道交给它就退出（见 `ipc`）；
//! - 环境已经在运行：只把它的窗口切到前台；
//! - 打开失败：才显示主窗口并提示原因，不会让用户点了快捷方式却毫无反应。

pub mod ipc;
pub mod shortcut;

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::{
    core::error::Result,
    services::environment::{EnvironmentLaunchRuntimeService, KernelService},
};

/// 快捷方式的启动参数前缀。
pub const OPEN_ENV_ARG: &str = "--open-env=";
/// 打开结果事件（目前只在失败时发给前端提示）。
pub const RESULT_EVENT: &str = "environment-shortcut-result";

/// 环境 ID 必须是标准 UUID 文本（36 位十六进制和连字符）。它来自命令行/管道，按不可信输入处理。
pub fn is_valid_env_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 36
        && bytes.iter().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => *byte == b'-',
            _ => byte.is_ascii_hexdigit(),
        })
}

/// 从进程参数里取出 `--open-env=<uuid>`。格式不对的一律忽略。
pub fn env_from_args<I>(args: I) -> Option<String>
where
    I: IntoIterator<Item = String>,
{
    args.into_iter()
        .filter_map(|arg| arg.strip_prefix(OPEN_ENV_ARG).map(|value| value.trim().to_string()))
        .find(|value| is_valid_env_uuid(value))
}

/// 当前进程是不是被快捷方式拉起来的（此时不应该显示主窗口）。
pub fn launched_for_environment() -> bool {
    env_from_args(std::env::args().skip(1)).is_some()
}

/// 打开环境：已在运行就切到前台，否则启动。
pub async fn open_environment(app: &AppHandle, env_uuid: &str) -> Result<()> {
    if !is_valid_env_uuid(env_uuid) {
        return Err("环境 ID 无效".into());
    }

    if let Some(endpoint) = KernelService::get_cdp_endpoint(env_uuid.to_string()).await? {
        return bring_to_front(&endpoint.host, endpoint.port).await;
    }

    let launch_paths = EnvironmentLaunchRuntimeService::resolve_launch_paths(app)?;
    let status_emitter = Some(crate::services::environment::kernel::utils::build_tauri_status_emitter(
        app.clone(),
    ));
    match EnvironmentLaunchRuntimeService::start_environment_by_uuid(
        env_uuid.to_string(),
        launch_paths,
        status_emitter,
        None,
    )
    .await
    {
        Ok(()) => Ok(()),
        Err(error) if error.to_string().contains("already active") => {
            // 环境正在被启动（比如连点了两次快捷方式）：等它就绪后切到前台。
            for _ in 0..60 {
                if let Some(endpoint) = KernelService::get_cdp_endpoint(env_uuid.to_string()).await? {
                    return bring_to_front(&endpoint.host, endpoint.port).await;
                }
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
            Err("环境启动超时".into())
        }
        Err(error) => Err(error),
    }
}

/// 通过该环境的 DevTools HTTP 接口把已有标签页切到前台（窗口随之置前）；一个标签页都没有就新开一个。
async fn bring_to_front(host: &str, port: u16) -> Result<()> {
    // 本机 DevTools 端口不能走系统代理。
    let client = reqwest::Client::builder().no_proxy().timeout(Duration::from_secs(10)).build()?;
    let base = format!("http://{host}:{port}");
    let targets = client.get(format!("{base}/json/list")).send().await?.error_for_status()?.json::<Value>().await?;
    let first_page = targets.as_array().and_then(|items| {
        items.iter().find(|item| item.get("type").and_then(Value::as_str) == Some("page"))
    });
    match first_page.and_then(|item| item.get("id")).and_then(Value::as_str) {
        Some(id) => {
            client.get(format!("{base}/json/activate/{id}")).send().await?.error_for_status()?;
        }
        None => {
            client.put(format!("{base}/json/new?about%3Ablank")).send().await?.error_for_status()?;
        }
    }
    Ok(())
}

/// 后台处理一次"打开环境"请求：失败时显示主窗口并通知前端。
/// 软件没有登录和锁屏，会话在启动时自动建立；这里确保它已经就绪即可。
pub fn handle_open_env_in_background(app: AppHandle, env_uuid: String) {
    tauri::async_runtime::spawn(async move {
        let outcome = match crate::commands::auth::ensure_default_session().await {
            Ok(_) => open_environment(&app, &env_uuid).await.map_err(|error| error.to_string()),
            Err(error) => Err(error),
        };

        if let Err(message) = outcome {
            log::warn!("opening environment {env_uuid} from a shortcut failed: {message}");
            // 失败要让用户看见：显示主窗口（等前端就绪后再发事件，否则提示会丢）。
            for _ in 0..120 {
                if crate::app::init_state::read_app_init_state().is_initialized {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
            crate::app::startup::show_main_window_now(&app);
            let _ = app.emit(RESULT_EVENT, json!({ "ok": false, "envUuid": env_uuid, "message": message }));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const UUID: &str = "c85aac79-2b43-3d15-d8ce-15e7a511a15b";

    #[test]
    fn only_canonical_uuids_are_accepted() {
        assert!(is_valid_env_uuid(UUID));
        assert!(is_valid_env_uuid(&UUID.to_uppercase()));
        for bad in [
            "",
            "c85aac79-2b43-3d15-d8ce-15e7a511a15",
            "c85aac79-2b43-3d15-d8ce-15e7a511a15bb",
            "c85aac792b433d15d8ce15e7a511a15b",
            "c85aac79-2b43-3d15-d8ce-15e7a511a15g",
            "c85aac79_2b43_3d15_d8ce_15e7a511a15b",
            "../../etc/passwd--------------------",
            "c85aac79-2b43-3d15-d8ce-15e7a511a15b --no-sandbox",
        ] {
            assert!(!is_valid_env_uuid(bad), "{bad}");
        }
    }

    #[test]
    fn finds_the_environment_in_process_arguments() {
        let args = |items: &[&str]| items.iter().map(|item| item.to_string()).collect::<Vec<_>>();
        assert_eq!(
            env_from_args(args(&["Simprint.exe", &format!("--open-env={UUID}")])).as_deref(),
            Some(UUID)
        );
        // 参数不合法就当没有，不能把它当成环境 ID 用
        assert_eq!(env_from_args(args(&["Simprint.exe", "--open-env=not-a-uuid"])), None);
        assert_eq!(env_from_args(args(&["Simprint.exe", "--open-env="])), None);
        assert_eq!(env_from_args(args(&["Simprint.exe", UUID])), None);
        assert_eq!(env_from_args(args(&["Simprint.exe", "simprint://login"])), None);
        assert_eq!(env_from_args(args(&["Simprint.exe"])), None);
        // 第一个不合法、后面有合法的：取合法的
        assert_eq!(
            env_from_args(args(&["x", "--open-env=bad", &format!("--open-env={UUID}")])).as_deref(),
            Some(UUID)
        );
    }
}
