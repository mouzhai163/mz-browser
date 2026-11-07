//! 默认浏览器：把外部链接固定交给一个"默认环境"打开。
//!
//! - 用户在环境管理里把某个环境设为"默认浏览器"，同一时刻只有一个；可随时取消。
//! - 设置时把 Simprint 登记成 Windows 的可选浏览器（见 `registry`）；Windows 不允许程序替用户
//!   选择默认浏览器，所以还需要用户在系统"默认应用"里选一次 Simprint。
//! - 之后其他软件里点链接，系统以 `Simprint.exe "<链接>"` 启动（或交给已在运行的实例），
//!   链接直接在默认环境里打开，不询问。没有默认环境时只提示、不打开，绝不挑一个环境顶替。

pub mod ipc;
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

pub use link::{link_from_args, root_from_args, validate_link};

/// 当前进程是不是被系统当作默认浏览器拉起来的（此时不应该显示主窗口）。
pub fn launched_for_link() -> bool {
    link_from_args(std::env::args().skip(1)).is_some()
}

/// 进程启动最早期调用：命令行带了 `--simprint-root=<目录>` 且环境变量没设置时，用它作为数据目录。
///
/// 系统启动的新进程没有开发/隔离运行时的 `SIMPRINT_ROOT_DIR` 环境变量，登记的命令里带上它，
/// 才能找到同一份数据和运行中的应用。已经设置了环境变量就以环境变量为准。
pub fn apply_root_arg() {
    if std::env::var_os("SIMPRINT_ROOT_DIR").is_some() {
        return;
    }
    if let Some(root) = root_from_args(std::env::args().skip(1)) {
        // SAFETY: 只在 main 最开头调用；此时没有任何代码在读取这个变量（读取它的路径、日志目录等都在之后才初始化）。
        #[allow(unsafe_code)]
        unsafe {
            std::env::set_var("SIMPRINT_ROOT_DIR", root)
        };
    }
}

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
/// 登记命令里需要携带的数据目录：只有隔离/开发运行（设置了 SIMPRINT_ROOT_DIR）才有。
#[cfg(windows)]
fn registered_data_root() -> Option<std::path::PathBuf> {
    std::env::var_os("SIMPRINT_ROOT_DIR").map(std::path::PathBuf::from)
}

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
            .map(|exe| registry::is_registered(REGISTRY_ROOT, &names, exe, registered_data_root().as_deref()))
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
        registry::register(REGISTRY_ROOT, &registry_names(), &exe, registered_data_root().as_deref())
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
        // 调试构建没有设置隔离目录时不碰登记：否则调试用的 exe 会顶替正式版的登记。
        let isolated = std::env::var_os("SIMPRINT_ROOT_DIR").is_some();
        if (cfg!(debug_assertions) && !isolated) || default_environment(app).is_none() {
            return;
        }
        let Ok(exe) = std::env::current_exe() else { return };
        let names = registry_names();
        let data_root = registered_data_root();
        if !registry::is_registered(REGISTRY_ROOT, &names, &exe, data_root.as_deref()) {
            if let Err(error) = registry::register(REGISTRY_ROOT, &names, &exe, data_root.as_deref()) {
                log::warn!("failed to refresh default browser registration: {error}");
            }
        }
    }
    #[cfg(not(windows))]
    let _ = app;
}

// ---------------------------------------------------------------- 打开链接

/// 错误直接用给用户看的文字（不带内核错误码前缀）。
async fn open_link_inner(app: &AppHandle, raw: &str) -> std::result::Result<String, String> {
    let url = validate_link(raw).map_err(|reason| format!("链接无效：{reason}"))?;
    let Some(env_uuid) = default_environment(app) else {
        return Err("尚未设置默认浏览器环境，已忽略该链接".to_string());
    };
    open_url_in_environment(app, &env_uuid, &url).await.map_err(|error| error.to_string())?;
    Ok(env_uuid)
}

/// 在指定环境里打开网址：环境已在运行就新开标签页，否则先启动环境再开标签页。
///
/// 链接总是由我们通过 DevTools 新开标签页（拿到标签页 ID 再切到前台），而不是作为启动参数交给内核：
/// 内核把启动网址开在后台标签页，网址一跳转（`qq.com` → `www.qq.com`）就再也认不出是哪一个。
pub async fn open_url_in_environment(app: &AppHandle, env_uuid: &str, raw_url: &str) -> Result<()> {
    let url = validate_link(raw_url).map_err(|reason| format!("链接无效：{reason}"))?;

    if let Some(endpoint) = KernelService::get_cdp_endpoint(env_uuid.to_string()).await? {
        // 端点记录还在，不代表浏览器还在（窗口刚被关掉时）。连不上就当作没在运行。
        if browser_reachable(&endpoint.host, endpoint.port).await {
            return open_in_running_browser(&endpoint.host, endpoint.port, &url).await.map(|_| ());
        }
        log::info!("{env_uuid} has a CDP endpoint but the browser is gone; launching it again");
    }

    let launch_paths = EnvironmentLaunchRuntimeService::resolve_launch_paths(app)?;
    let status_emitter = Some(crate::services::environment::kernel::utils::build_tauri_status_emitter(
        app.clone(),
    ));
    match EnvironmentLaunchRuntimeService::start_environment_for_link(
        env_uuid.to_string(),
        launch_paths,
        status_emitter,
    )
    .await
    {
        Ok(()) => open_after_launch(env_uuid, &url).await,
        // 环境正在被启动（比如连续点了两个链接）：等它就绪后再开标签页。
        Err(error) if error.to_string().contains("already active") => open_after_launch(env_uuid, &url).await,
        Err(error) => Err(error),
    }
}

/// 标签页是不是空白页（内核启动时自带的新标签页）。
fn is_blank_tab(url: &str) -> bool {
    matches!(
        url.trim_end_matches('/'),
        "chrome://newtab" | "chrome://new-tab-page" | "about:blank" | "chrome-search://local-ntp/local-ntp.html"
    )
}

fn devtools_client(timeout: Duration) -> Result<reqwest::Client> {
    // 本机 DevTools 端口不能走系统代理。
    Ok(reqwest::Client::builder().no_proxy().timeout(timeout).build()?)
}

/// 浏览器的 DevTools 接口能不能连上。
async fn browser_reachable(host: &str, port: u16) -> bool {
    let Ok(client) = devtools_client(Duration::from_secs(2)) else { return false };
    matches!(
        client.get(format!("http://{host}:{port}/json/version")).send().await,
        Ok(response) if response.status().is_success()
    )
}

/// 当前所有页面标签页：(id, url)。
async fn list_pages(host: &str, port: u16) -> Result<Vec<(String, String)>> {
    let client = devtools_client(Duration::from_secs(5))?;
    let targets = client
        .get(format!("http://{host}:{port}/json/list"))
        .send()
        .await?
        .error_for_status()?
        .json::<Value>()
        .await?;
    Ok(targets
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter(|item| item.get("type").and_then(Value::as_str) == Some("page"))
                .filter_map(|item| {
                    Some((item.get("id")?.as_str()?.to_string(), item.get("url")?.as_str()?.to_string()))
                })
                .collect()
        })
        .unwrap_or_default())
}

/// 环境刚启动：等浏览器窗口出现，再新开链接标签页并切到前台，然后关掉内核自带的空白标签页
/// （先开新的再关空白的，否则关掉最后一个标签页会让整个浏览器退出）。
async fn open_after_launch(env_uuid: &str, url: &str) -> Result<()> {
    for _ in 0..60 {
        if let Ok(Some(endpoint)) = KernelService::get_cdp_endpoint(env_uuid.to_string()).await {
            if let Ok(pages) = list_pages(&endpoint.host, endpoint.port).await {
                if !pages.is_empty() {
                    let created = open_in_running_browser(&endpoint.host, endpoint.port, url).await?;
                    let client = devtools_client(Duration::from_secs(5))?;
                    for (id, page_url) in &pages {
                        if Some(id) != created.as_ref() && is_blank_tab(page_url) {
                            let _ = client
                                .get(format!("http://{}:{}/json/close/{id}", endpoint.host, endpoint.port))
                                .send()
                                .await;
                        }
                    }
                    return Ok(());
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Err("环境已启动，但浏览器窗口迟迟没有就绪，链接未能打开".into())
}

/// 通过该环境的 DevTools HTTP 接口新开标签页（`PUT /json/new?<url>`）并切到前台，返回新标签页 ID。
async fn open_in_running_browser(host: &str, port: u16, url: &str) -> Result<Option<String>> {
    let client = devtools_client(Duration::from_secs(10))?;
    let base = format!("http://{host}:{port}");
    let created = client
        .put(format!("{base}/json/new?{}", link::percent_encode_all(url)))
        .send()
        .await?
        .error_for_status()?
        .json::<Value>()
        .await?;
    let target_id = created.get("id").and_then(Value::as_str).map(str::to_string);
    if let Some(target_id) = &target_id {
        // 切换标签页并把窗口带到前台；失败不影响链接已经打开。
        let _ = client.get(format!("{base}/json/activate/{target_id}")).send().await;
    }
    Ok(target_id)
}

/// 处理系统交来的链接（命令行 / 单实例转发 / 命名管道），在后台执行。
///
/// 成功时什么都不显示：环境的浏览器窗口自己会出现。失败（没有默认环境、链接无效、环境启动失败）
/// 才显示主窗口并提示原因——不能让用户点了链接却毫无反应。
pub fn handle_link_in_background(app: AppHandle, link: String) {
    tauri::async_runtime::spawn(async move {
        // 本地会话在启动时自动建立；这里确保它已就绪。
        let outcome = match crate::commands::auth::ensure_default_session().await {
            Ok(_) => open_link_inner(&app, &link).await,
            Err(error) => Err(error),
        };

        match outcome {
            Ok(env_uuid) => {
                let _ = app.emit(LINK_RESULT_EVENT, json!({ "ok": true, "envUuid": env_uuid }));
            }
            Err(message) => {
                log::warn!("default browser link rejected or failed: {message}");
                // 等前端就绪再发事件，否则提示会丢；然后显示主窗口让用户看到。
                for _ in 0..120 {
                    if crate::app::init_state::read_app_init_state().is_initialized {
                        break;
                    }
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
                crate::app::startup::show_main_window_now(&app);
                let _ = app.emit(LINK_RESULT_EVENT, json!({ "ok": false, "message": message }));
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blank_tabs_are_recognised_and_real_pages_are_not() {
        for blank in ["chrome://newtab/", "chrome://newtab", "about:blank", "chrome://new-tab-page/"] {
            assert!(is_blank_tab(blank), "{blank}");
        }
        for page in ["https://example.com/", "chrome://settings/", "https://example.com/about:blank", ""] {
            assert!(!is_blank_tab(page), "{page}");
        }
    }
}
