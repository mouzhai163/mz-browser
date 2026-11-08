//! 默认浏览器命令：命令层只做参数转发，逻辑在 services::default_browser。

use crate::core::error::Result;
use crate::services::default_browser::{self, DefaultBrowserState};
use tauri::AppHandle;

#[tauri::command]
pub fn get_default_browser_state(app: AppHandle) -> DefaultBrowserState {
    default_browser::get_state(&app)
}

/// 把指定环境设为默认浏览器环境（同时只有一个），并向系统登记。
#[tauri::command]
pub fn set_default_browser_environment(app: AppHandle, env_uuid: String) -> Result<DefaultBrowserState> {
    default_browser::set_environment(&app, &env_uuid)
}

/// 取消默认浏览器：清除默认环境并取消向系统登记。
#[tauri::command]
pub fn clear_default_browser_environment(app: AppHandle) -> Result<DefaultBrowserState> {
    default_browser::clear_environment(&app)
}

/// 打开系统"默认应用"设置页，让用户把 M Z指纹浏览器 选为默认浏览器。
#[tauri::command]
pub fn open_default_apps_settings() -> Result<()> {
    default_browser::open_default_apps_settings()
}
