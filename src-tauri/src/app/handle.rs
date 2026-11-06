use std::sync::OnceLock;

use anyhow::Result;
use tauri::AppHandle;

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

pub fn init_app_handle(app_handle: AppHandle) -> Result<()> {
    APP_HANDLE
        .set(app_handle)
        .map_err(|_| anyhow::anyhow!("AppHandle already initialized"))
}

pub fn get_app_handle() -> Result<AppHandle> {
    APP_HANDLE
        .get()
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("AppHandle not initialized"))
}
