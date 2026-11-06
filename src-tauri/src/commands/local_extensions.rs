use tauri::AppHandle;

use crate::core::error::Result;
use crate::services::local_extensions::{LocalExtensionDto, LocalExtensionService};

#[tauri::command]
pub fn import_local_extension_crx(app: AppHandle, path: String) -> Result<LocalExtensionDto> {
    LocalExtensionService::import_crx(&app, path)
}

#[tauri::command]
pub async fn import_local_extension_store_url(
    app: AppHandle,
    store_url: String,
) -> Result<LocalExtensionDto> {
    LocalExtensionService::import_store_url(&app, store_url).await
}

#[tauri::command]
pub fn list_local_extensions(app: AppHandle) -> Result<Vec<LocalExtensionDto>> {
    LocalExtensionService::list_extensions(&app)
}

#[tauri::command]
pub fn install_local_extension(app: AppHandle, record_id: String) -> Result<LocalExtensionDto> {
    LocalExtensionService::install_extension(&app, record_id)
}

#[tauri::command]
pub fn uninstall_local_extension(app: AppHandle, record_id: String) -> Result<LocalExtensionDto> {
    LocalExtensionService::uninstall_extension(&app, record_id)
}

#[tauri::command]
pub fn remove_local_extension(app: AppHandle, record_id: String) -> Result<()> {
    LocalExtensionService::remove_extension(&app, record_id)
}

#[tauri::command]
pub fn disable_local_extension(app: AppHandle, record_id: String) -> Result<LocalExtensionDto> {
    LocalExtensionService::disable_extension(&app, record_id)
}

#[tauri::command]
pub fn enable_local_extension(app: AppHandle, record_id: String) -> Result<LocalExtensionDto> {
    LocalExtensionService::enable_extension(&app, record_id)
}
