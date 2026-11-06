use crate::core::error::Result;
use serde::Serialize;
use std::fs;
use std::path::Path;

/// 递归计算目录大小（字节）
fn dir_size(path: &Path) -> u64 {
    if !path.exists() || !path.is_dir() {
        return 0;
    }
    fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .map(|e| {
                    let p = e.path();
                    if p.is_dir() {
                        dir_size(&p)
                    } else {
                        fs::metadata(&p).map(|m| m.len()).unwrap_or(0)
                    }
                })
                .sum()
        })
        .unwrap_or(0)
}

/// 存储默认路径配置
#[derive(Debug, Serialize)]
pub struct StoragePathsResponse {
    pub app_base: String,
    pub profiles: String,
    pub cache: String,
    pub logs: String,
    pub downloads: String,
}

/// 批量获取目录大小响应（字节）
#[derive(Debug, Serialize)]
pub struct GetDirectorySizesResponse {
    pub sizes: Vec<u64>,
}

pub struct StorageService;

impl StorageService {
    /// 获取存储默认路径（使用 PathManager 统一管理）
    pub fn get_storage_default_paths(app: &tauri::AppHandle) -> Result<StoragePathsResponse> {
        let app_root = crate::core::paths::PathManager::get_root_dir()?;
        let cache = crate::core::paths::PathManager::get_cache_dir(app)?;
        let logs = crate::core::paths::PathManager::get_logs_dir(app)?;
        let profiles = crate::core::paths::PathManager::get_profiles_dir(app)?;
        let downloads = crate::core::paths::PathManager::get_downloads_dir(app)?;

        Ok(StoragePathsResponse {
            app_base: app_root.to_string_lossy().to_string(),
            profiles: profiles.to_string_lossy().to_string(),
            cache: cache.to_string_lossy().to_string(),
            logs: logs.to_string_lossy().to_string(),
            downloads: downloads.to_string_lossy().to_string(),
        })
    }

    /// 批量统计目录大小
    pub fn get_directory_sizes(paths: Vec<String>) -> Result<GetDirectorySizesResponse> {
        let sizes = paths.iter().map(|p| dir_size(Path::new(p))).collect();

        Ok(GetDirectorySizesResponse { sizes })
    }
}
