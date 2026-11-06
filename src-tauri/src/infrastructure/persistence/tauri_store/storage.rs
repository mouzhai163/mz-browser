//! store.json 读写
//!
//! 不再依赖 Tauri 默认路径，而是统一落到 `config/store.json`。

use once_cell::sync::Lazy;
use serde_json::{Map, Value};
use std::fs;
use std::sync::Mutex;

use super::keys;

static STORE_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

/// 从 store 的 storage 对象中取字符串子键，空或不存在则返回 None
pub(crate) fn get_storage_string(_app: &tauri::AppHandle, sub_key: &str) -> Option<String> {
    let root = read_store_root().ok()?;
    let storage = root.get(keys::STORAGE)?;
    let obj = storage.as_object()?;
    let s = obj.get(sub_key)?.as_str()?;
    let trimmed = s.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

/// 日志目录路径：store 中 `storage.logsPath` 非空则用该路径，否则使用统一路径层默认值
pub fn get_logs_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    crate::core::paths::PathManager::get_logs_dir(app).map_err(|e| e.to_string())
}

/// 缓存目录路径：store 中 `storage.cachePath` 非空则用该路径，否则使用统一路径层默认值
pub fn get_cache_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    crate::core::paths::PathManager::get_cache_dir(app).map_err(|e| e.to_string())
}

/// 按 key 读取 store 中的任意键值
pub fn get_store_key(_app: &tauri::AppHandle, key: &str) -> Option<Value> {
    read_store_root().ok()?.get(key).cloned()
}

/// Security-sensitive readers must distinguish missing keys from unreadable data.
pub fn get_store_key_checked(_app: &tauri::AppHandle, key: &str) -> Result<Option<Value>, String> {
    Ok(read_store_root()?.get(key).cloned())
}

/// 按 key 写入 store
pub fn set_store_key(app: &tauri::AppHandle, key: &str, value: Value) -> Result<(), String> {
    let _guard = STORE_LOCK.lock().map_err(|_| "store lock poisoned".to_string())?;
    let mut root = read_store_root_without_lock()?;
    root.insert(key.to_string(), value);
    write_store_root_without_lock(&root)?;
    sync_bootstrap_for_key(key, &root)?;
    if let Err(error) = crate::core::paths::PathManager::sync_runtime_paths_registry(app) {
        log::warn!("failed to sync runtime paths registry: {}", error);
    }
    Ok(())
}

/// 配置写入 store（供命令或内部统一写入用）
#[allow(dead_code)]
pub fn set_storage_value(
    app: &tauri::AppHandle,
    sub_key: &str,
    value: Value,
) -> Result<(), String> {
    let _guard = STORE_LOCK.lock().map_err(|_| "store lock poisoned".to_string())?;
    let mut root = read_store_root_without_lock()?;

    let mut storage: Map<String, Value> =
        root.get(keys::STORAGE).and_then(|v| v.as_object().cloned()).unwrap_or_default();

    storage.insert(sub_key.to_string(), value);
    root.insert(keys::STORAGE.to_string(), Value::Object(storage));

    write_store_root_without_lock(&root)?;
    sync_bootstrap_for_key(keys::STORAGE, &root)?;
    if let Err(error) = crate::core::paths::PathManager::sync_runtime_paths_registry(app) {
        log::warn!("failed to sync runtime paths registry: {}", error);
    }
    Ok(())
}

pub(super) fn ensure_store_file() -> Result<(), String> {
    let _guard = STORE_LOCK.lock().map_err(|_| "store lock poisoned".to_string())?;
    let path = crate::core::paths::PathManager::get_store_file().map_err(|e| e.to_string())?;

    if path.exists() {
        return Ok(());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("无法创建 store 目录: {}", e))?;
    }

    fs::write(&path, "{}").map_err(|e| format!("无法初始化 store 文件: {}", e))
}

fn read_store_root() -> Result<Map<String, Value>, String> {
    let _guard = STORE_LOCK.lock().map_err(|_| "store lock poisoned".to_string())?;
    read_store_root_without_lock()
}

fn read_store_root_without_lock() -> Result<Map<String, Value>, String> {
    let path = crate::core::paths::PathManager::get_store_file().map_err(|e| e.to_string())?;

    if !path.exists() {
        return Ok(Map::new());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("无法读取 store 文件: {}", e))?;
    if content.trim().is_empty() {
        return Err("store 文件为空或已损坏".to_string());
    }

    serde_json::from_str::<Map<String, Value>>(&content)
        .map_err(|e| format!("store 文件格式无效: {}", e))
}

fn write_store_root(root: &Map<String, Value>) -> Result<(), String> {
    let _guard = STORE_LOCK.lock().map_err(|_| "store lock poisoned".to_string())?;
    write_store_root_without_lock(root)
}

fn write_store_root_without_lock(root: &Map<String, Value>) -> Result<(), String> {
    let path = crate::core::paths::PathManager::get_store_file().map_err(|e| e.to_string())?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("无法创建 store 目录: {}", e))?;
    }

    let content =
        serde_json::to_string_pretty(root).map_err(|e| format!("无法序列化 store 内容: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("无法写入 store 文件: {}", e))
}

fn sync_bootstrap_for_key(key: &str, root: &Map<String, Value>) -> Result<(), String> {
    if key != keys::STORAGE {
        return Ok(());
    }

    let storage = root.get(keys::STORAGE).and_then(Value::as_object);
    crate::core::paths::PathManager::sync_bootstrap_from_storage(storage)
        .map_err(|e| format!("无法同步 bootstrap.json: {}", e))
}
