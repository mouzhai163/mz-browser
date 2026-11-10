// ============ 新架构模块 ============
#[cfg(all(feature = "desktop-e2e", any(feature = "production", not(debug_assertions))))]
compile_error!("desktop-e2e is only permitted in non-production debug builds");
pub mod core; // 核心模块（配置、错误、日志、工具）
pub mod domain; // 领域层（业务模型）
pub mod infrastructure; // 基础设施层（缓存、事件总线、网络、存储等）
pub mod local_api; // 进程内调用业务路由，供 MCP 使用
pub mod mcp; // MCP 子域
pub mod services; // 服务层（业务逻辑）

// ============ 现有模块 ============
pub mod app;
pub mod commands;

// ============ 重导出常用模块 ============
pub use core::logger::modules;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    app::run();
}
