//! Store 统一入口
//!
//! store.json 现在由应用自己的路径层决定实际落点，固定放在 `config/store.json`。

pub mod keys;
pub mod storage;

pub use storage::{
    get_cache_path, get_logs_path, get_store_key, get_store_key_checked, set_storage_value,
    set_store_key,
};

/// Store 文件名，全应用唯一来源；前端加载时使用相同名称即可与后端共用
pub const STORE_FILENAME: &str = "store.json";

/// 在 setup 中调用一次，确保 `config/store.json` 已存在
pub fn ensure_store_loaded(app: &tauri::AppHandle) -> Result<(), String> {
    storage::ensure_store_file()?;
    if let Err(error) = crate::core::paths::PathManager::sync_runtime_paths_registry(app) {
        log::warn!(
            "failed to sync runtime paths registry during startup: {}",
            error
        );
    }
    Ok(())
}
