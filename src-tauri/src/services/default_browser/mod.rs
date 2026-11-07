//! 默认浏览器：把外部链接固定交给一个"默认环境"打开。
//!
//! - 用户在环境管理里把某个环境设为"默认浏览器"，同一时刻只有一个；可随时取消。
//! - 设置时把 Simprint 登记成 Windows 的可选浏览器（见 `registry`）；Windows 不允许程序替用户
//!   选择默认浏览器，所以还需要用户在系统"默认应用"里选一次 Simprint。
//! - 之后其他软件里点链接，系统以 `Simprint.exe "<链接>"` 启动（或交给已在运行的实例），
//!   链接直接在默认环境里打开，不询问。没有默认环境时只提示、不打开，绝不挑一个环境顶替。

mod link;
#[cfg(windows)]
mod registry;

use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::{
    core::error::Result,
    infrastructure::persistence::tauri_store,
    services::environment::{EnvironmentLaunchRuntimeService, KernelService},
};

pub use link::{link_from_args, validate_link};

/// 默认环境 UUID 在 store 里的键；值为 null 或不存在表示没有设置。
pub const DEFAULT_ENVIRONMENT_STORE_KEY: &str = "browser.default_environment_uuid";
/// 链接处理结果事件，前端据此给出提示。
pub const LINK_RESULT_EVENT: &str = "default-browser-link-result";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DefaultBrowserState {
    /// 当前是否支持（目前只有 Windows）
    pub supported: bool,
    /// 默认环境 UUID
    pub environment_uuid: Option<String>,
    /// 已向系统登记为可选浏览器
    pub registered: bool,
    /// 系统当前的默认浏览器就是 Simprint
    pub is_system_default: bool,
}

// ---------------------------------------------------------------- 默认环境（store）

pub fn default_environment(app: &AppHandle) -> Option<String> {
    tauri_store::get_store_key(app, DEFAULT_ENVIRONMENT_STORE_KEY)
        .and_then(|value| value.as_str().map(str::to_string))
        .filter(|uuid| !uuid.trim().is_empty())
}

fn store_default_environment(app: &AppHandle, uuid: Option<&str>) -> Result<()> {
    let value = uuid.map(|uuid| Value::String(uuid.to_string())).unwrap_or(Value::Null);
    tauri_store::set_store_key(app, DEFAULT_ENVIRONMENT_STORE_KEY, value).map_err(Into::into)
}

// ---------------------------------------------------------------- 系统登记

#[cfg(windows)]
const REGISTRY_ROOT: &str = "Software";

/// 隔离/开发运行（设置了 SIMPRINT_ROOT_DIR）用另一套登记名，不覆盖已安装版本的登记。
#[cfg(windows)]
fn registry_names() -> registry::Names {
    if std::env::var_os("SIMPRINT_ROOT_DIR").is_some() {
        registry::ISOLATED_NAMES
    } else {
        registry::RELEASE_NAMES
    }
}

#[cfg(windows)]
pub fn get_state(app: &AppHandle) -> DefaultBrowserState {
    let names = registry_names();
    let exe = std::env::current_exe().ok();
    DefaultBrowserState {
        supported: true,
        environment_uuid: default_environment(app),
        registered: exe
            .as_deref()
            .map(|exe| registry::is_registered(REGISTRY_ROOT, &names, exe))
            .unwrap_or(false),
        is_system_default: registry::is_system_default(&names),
    }
}

#[cfg(not(windows))]
pub fn get_state(app: &AppHandle) -> DefaultBrowserState {
    DefaultBrowserState {
        supported: false,
        environment_uuid: default_environment(app),
        registered: false,
        is_system_default: false,
    }
}

/// 把指定环境设为默认浏览器环境，并向系统登记。
pub fn set_environment(app: &AppHandle, env_uuid: &str) -> Result<DefaultBrowserState> {
    let env_uuid = env_uuid.trim();
    if env_uuid.is_empty() {
        return Err("环境 ID 为空".into());
    }
    #[cfg(windows)]
    {
        let exe = std::env::current_exe().map_err(|error| format!("无法获取程序路径: {error}"))?;
        registry::register(REGISTRY_ROOT, &registry_names(), &exe)
            .map_err(|error| format!("向系统登记浏览器失败: {error}"))?;
        registry::notify_association_changed();
    }
    store_default_environment(app, Some(env_uuid))?;
    Ok(get_state(app))
}

/// 取消默认浏览器：清除默认环境，并取消向系统登记。
///
/// 取消登记后 Simprint 不再出现在 Windows 的可选浏览器里；如果它此刻仍是系统默认，
/// Windows 下次打开链接时会让用户重新选择，而不是把链接发给一个没有默认环境的 Simprint。
pub fn clear_environment(app: &AppHandle) -> Result<DefaultBrowserState> {
    store_default_environment(app, None)?;
    #[cfg(windows)]
    {
        registry::unregister(REGISTRY_ROOT, &registry_names())
            .map_err(|error| format!("取消向系统登记失败: {error}"))?;
        registry::notify_association_changed();
    }
    Ok(get_state(app))
}

/// 打开 Windows 的"默认应用"设置页，让用户把 Simprint 选为默认浏览器。
pub fn open_default_apps_settings() -> Result<()> {
    #[cfg(windows)]
    {
        // 直达 Simprint 的页面（Windows 11）；Windows 10 会落到"默认应用"总页。
        let name = registry_names().display_name;
        let uri = format!("ms-settings:defaultapps?registeredAppUser={}", name.replace(' ', "%20"));
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &uri])
            .spawn()
            .map_err(|error| format!("无法打开系统设置: {error}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("当前系统暂不支持".into())
    }
}

/// 启动时让登记里的 exe 路径跟上当前程序（程序被移动或升级到新位置时）。
/// 开发/隔离运行不处理，避免调试用的 exe 顶替正式登记。
pub fn refresh_registration_if_needed(app: &AppHandle) {
    #[cfg(windows)]
    {
        if cfg!(debug_assertions) || default_environment(app).is_none() {
            return;
        }
        let Ok(exe) = std::env::current_exe() else { return };
        let names = registry_names();
        if !registry::is_registered(REGISTRY_ROOT, &names, &exe) {
            if let Err(error) = registry::register(REGISTRY_ROOT, &names, &exe) {
                log::warn!("failed to refresh default browser registration: {error}");
            }
        }
    }
    #[cfg(not(windows))]
    let _ = app;
}

// ---------------------------------------------------------------- 打开链接

/// 处理系统交来的链接：在默认环境里打开。结果通过事件通知前端。
pub async fn open_link(app: &AppHandle, raw: &str) -> Result<()> {
    let outcome = open_link_inner(app, raw).await;
    let payload = match &outcome {
        Ok(env_uuid) => json!({ "ok": true, "envUuid": env_uuid }),
        Err(error) => json!({ "ok": false, "message": error.to_string() }),
    };
    if let Err(error) = &outcome {
        log::warn!("default browser link rejected or failed: {error}");
    }
    let _ = app.emit(LINK_RESULT_EVENT, payload);
    outcome.map(|_| ())
}

async fn open_link_inner(app: &AppHandle, raw: &str) -> Result<String> {
    let url = validate_link(raw).map_err(|reason| format!("链接无效：{reason}"))?;
    let Some(env_uuid) = default_environment(app) else {
        return Err("尚未设置默认浏览器环境，已忽略该链接".into());
    };
    open_url_in_environment(app, &env_uuid, &url).await?;
    Ok(env_uuid)
}

/// 在指定环境里打开网址：环境已在运行就新开标签页，否则启动环境并带上这个网址。
pub async fn open_url_in_environment(app: &AppHandle, env_uuid: &str, raw_url: &str) -> Result<()> {
    let url = validate_link(raw_url).map_err(|reason| format!("链接无效：{reason}"))?;

    if let Some(endpoint) = KernelService::get_cdp_endpoint(env_uuid.to_string()).await? {
        return open_in_running_browser(&endpoint.host, endpoint.port, &url).await;
    }

    let launch_paths = EnvironmentLaunchRuntimeService::resolve_launch_paths(app)?;
    let status_emitter = Some(crate::services::environment::kernel::utils::build_tauri_status_emitter(
        app.clone(),
    ));
    match EnvironmentLaunchRuntimeService::start_environment_with_url(
        env_uuid.to_string(),
        launch_paths,
        status_emitter,
        url.clone(),
    )
    .await
    {
        Ok(()) => Ok(()),
        Err(error) => {
            // 环境正在被启动（比如连续点了两个链接）：等它就绪后再开标签页。
            if error.to_string().contains("already active") {
                wait_and_open(env_uuid, &url).await
            } else {
                Err(error)
            }
        }
    }
}

async fn wait_and_open(env_uuid: &str, url: &str) -> Result<()> {
    for _ in 0..60 {
        if let Some(endpoint) = KernelService::get_cdp_endpoint(env_uuid.to_string()).await? {
            return open_in_running_browser(&endpoint.host, endpoint.port, url).await;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Err("环境启动超时，链接未能打开".into())
}

/// 通过该环境的 DevTools HTTP 接口新开标签页（`PUT /json/new?<url>`），并尽量切到前台。
async fn open_in_running_browser(host: &str, port: u16, url: &str) -> Result<()> {
    // 本机 DevTools 端口不能走系统代理。
    let client = reqwest::Client::builder().no_proxy().timeout(Duration::from_secs(10)).build()?;
    let base = format!("http://{host}:{port}");
    let created = client
        .put(format!("{base}/json/new?{}", link::percent_encode_all(url)))
        .send()
        .await?
        .error_for_status()?
        .json::<Value>()
        .await?;
    if let Some(target_id) = created.get("id").and_then(Value::as_str) {
        // 切换标签页并把窗口带到前台；失败不影响链接已经打开。
        let _ = client.get(format!("{base}/json/activate/{target_id}")).send().await;
    }
    Ok(())
}

/// 处理启动参数 / 单实例转发过来的链接（后台执行）。
/// 应用刚启动时本地会话可能还没建立，先等它就绪，避免把"尚未就绪"误报成失败。
pub fn handle_link_in_background(app: AppHandle, link: String) {
    tauri::async_runtime::spawn(async move {
        for _ in 0..180 {
            if crate::commands::auth::has_local_session() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
        let _ = open_link(&app, &link).await;
    });
}
