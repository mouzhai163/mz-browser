/// 按模块记录信息日志（前端/插件可传入 module 区分功能，不传则使用 simprint::frontend）
#[tauri::command]
pub fn log_info(module: Option<String>, message: String) {
    let target = module.as_deref().unwrap_or(crate::core::logger::modules::FRONTEND);
    log::info!(target: target, "{}", message);
}

/// 按模块记录错误日志（前端/插件可传入 module 区分功能，不传则使用 simprint::frontend）
#[tauri::command]
pub fn log_error(module: Option<String>, message: String) {
    let target = module.as_deref().unwrap_or(crate::core::logger::modules::FRONTEND);
    log::error!(target: target, "{}", message);
}
