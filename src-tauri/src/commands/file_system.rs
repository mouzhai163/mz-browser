/// 文件系统和存储命令
///
/// 命令层仅负责参数解析和响应，业务逻辑由服务层处理
use crate::core::error::Result;
use crate::services::file_system::{
    FileService, GetDirectorySizesResponse, StoragePathsResponse, StorageService,
};
use serde::Deserialize;
use tauri::AppHandle;

// ============================================================================
// 文件操作命令
// ============================================================================

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String> {
    FileService::read_text_file(path).await
}

#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> Result<()> {
    FileService::write_text_file(path, content).await
}

// ============================================================================
// 存储管理命令
// ============================================================================

#[tauri::command]
pub fn get_storage_default_paths(app: AppHandle) -> Result<StoragePathsResponse> {
    StorageService::get_storage_default_paths(&app)
}

#[derive(Debug, Deserialize)]
pub struct GetDirectorySizesRequest {
    pub paths: Vec<String>,
}

#[tauri::command]
pub async fn get_directory_sizes(
    request: GetDirectorySizesRequest,
) -> Result<GetDirectorySizesResponse> {
    tokio::task::spawn_blocking(move || StorageService::get_directory_sizes(request.paths))
        .await
        .map_err(|e| std::io::Error::other(format!("directory size task failed: {e}")))?
}
