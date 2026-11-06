//! 多模块、多文件日志
//!
//! - **多文件**：不同功能写入不同日志文件，所有日志位于统一路径层给出的 `logs/` 目录下：
//!   - `simprint_app.log` — 本体、认证、代理、更新、存储、窗口等（默认）
//!   - `simprint_api.log` — API 功能（target: `simprint::api`）
//!   - `simprint_syncer.log` — 同步器功能（target: `simprint::syncer`）
//! - **可扩展**：在 [channels] 的 `channel_list()` 中增加一条 `Channel { target, file_stem }`，并在 [modules] 中增加对应常量即可新增一个独立日志文件。
//! - 打日志请使用本模块的宏并传入 [modules] 中的 target，例如：`log_info!(logger::modules::APP, "msg")`。

mod channels;
pub mod modules;
mod writer;

pub use channels::{Channel, file_stem_for_target, log_path_for_target};
pub use writer::MultiFileLogger;

use std::path::{Path, PathBuf};

/// 返回启动早期使用的日志目录，不依赖 Tauri。
pub fn bootstrap_log_dir() -> PathBuf {
    crate::core::paths::PathManager::get_bootstrap_logs_dir().unwrap_or_else(|_| {
        let cwd = std::env::current_dir().unwrap_or_else(|_| Path::new(".").to_path_buf());
        cwd.join("logs")
    })
}

/// 带模块的 info 日志
#[macro_export]
macro_rules! log_info {
    ($module:expr, $($arg:tt)*) => {
        log::info!(target: $module, $($arg)*)
    };
}

/// 带模块的 error 日志
#[macro_export]
macro_rules! log_error {
    ($module:expr, $($arg:tt)*) => {
        log::error!(target: $module, $($arg)*)
    };
}

/// 带模块的 warn 日志
#[macro_export]
macro_rules! log_warn {
    ($module:expr, $($arg:tt)*) => {
        log::warn!(target: $module, $($arg)*)
    };
}

/// 带模块的 debug 日志
#[macro_export]
macro_rules! log_debug {
    ($module:expr, $($arg:tt)*) => {
        log::debug!(target: $module, $($arg)*)
    };
}

/// 初始化多文件日志系统：使用给定目录，按 target 写入不同文件
pub fn init_logging(log_dir: impl AsRef<Path>) {
    let max_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    let log_dir = log_dir.as_ref().to_path_buf();
    if std::fs::create_dir_all(&log_dir).is_err() {
        let _ = log::set_logger(&NOP_LOGGER).map(|()| log::set_max_level(log::LevelFilter::Off));
        return;
    }

    let logger = Box::new(MultiFileLogger::new(log_dir.clone(), max_level));
    if log::set_boxed_logger(logger).is_err() {
        return;
    }
    log::set_max_level(max_level);

    log_info!(modules::APP, "日志系统初始化成功");
    log_info!(modules::APP, "日志目录: {:?}", log_dir);
    log_info!(modules::APP, "日志级别: {:?}", max_level);
}

/// 记录应用启动信息（版本、环境等）
pub fn log_app_start() {
    log_info!(modules::APP, "版本: {}", env!("CARGO_PKG_VERSION"));

    if let Ok(timestamp) = std::env::var("VERGEN_BUILD_TIMESTAMP") {
        log_info!(modules::APP, "编译时间: {}", timestamp);
    }
    if let Ok(target) = std::env::var("VERGEN_CARGO_TARGET_TRIPLE") {
        log_info!(modules::APP, "目标平台: {}", target);
    }

    log_info!(modules::APP, "操作系统: {}", std::env::consts::OS);
    log_info!(modules::APP, "架构: {}", std::env::consts::ARCH);
}

/// 在 panic hook 中记录 panic 信息（写入本体日志）
pub fn log_app_panic(panic_info: &std::panic::PanicHookInfo) {
    let panic_msg = if let Some(s) = panic_info.payload().downcast_ref::<String>() {
        s.clone()
    } else if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
        s.to_string()
    } else {
        "未知panic原因".to_string()
    };

    log_error!(modules::APP, "Panic信息: {}", panic_msg);
}

/// 在日志未初始化时使用的空实现（例如 create_dir_all 失败时）
struct NopLogger;

impl log::Log for NopLogger {
    fn enabled(&self, _: &log::Metadata) -> bool {
        false
    }
    fn log(&self, _: &log::Record) {}
    fn flush(&self) {}
}

// 用于 set_logger(&'static dyn Log)
unsafe impl Send for NopLogger {}
unsafe impl Sync for NopLogger {}

static NOP_LOGGER: NopLogger = NopLogger;
