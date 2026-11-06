//! Store 读写命令：前端配置统一通过此类 command 访问，不再直接使用 plugin-store

use crate::core::error::Result;
use serde_json::Value;
use tauri::command;

use crate::infrastructure::persistence::tauri_store;

/// 按 key 读取 store 中的值；不存在则返回 null（前端对应 undefined）
#[command]
pub fn get_store_key(app: tauri::AppHandle, key: String) -> Option<Value> {
    tauri_store::get_store_key(&app, &key)
}

/// 按 key 写入 store
#[command]
pub fn set_store_key(app: tauri::AppHandle, key: String, value: Value) -> Result<()> {
    tauri_store::set_store_key(&app, &key, value).map_err(Into::into)
}
