//! Result 扩展 trait
//!
//! 提供链式日志记录方法，简化错误处理代码

use super::Result;

/// Result 扩展 trait
///
/// 提供链式日志记录方法，简化错误处理代码
///
/// # 示例
///
/// ```rust
/// use crate::core::error::{Result, ResultExt};
///
/// // 简单日志
/// fn example1() -> Result<()> {
///     some_operation().log_err()?;
///     Ok(())
/// }
///
/// // 带上下文的日志
/// fn example2(key: &str) -> Result<Value> {
///     CacheManager::get(key)
///         .log_err_with(format!("key: {}", key))?
/// }
///
/// // 警告级别日志
/// fn example3() -> Result<()> {
///     optional_operation()
///         .log_warn()
///         .ok();  // 忽略错误
///     Ok(())
/// }
/// ```
pub trait ResultExt<T> {
    /// 如果是错误，记录 error 级别日志
    ///
    /// 日志格式：`[错误码] 错误描述`
    fn log_err(self) -> Self;

    /// 如果是错误，记录 error 级别日志并附加上下文
    ///
    /// 日志格式：`[错误码] 错误描述: 上下文`
    fn log_err_with(self, context: impl std::fmt::Display) -> Self;

    /// 如果是错误，记录 warn 级别日志
    fn log_warn(self) -> Self;

    /// 如果是错误，记录 warn 级别日志并附加上下文
    fn log_warn_with(self, context: impl std::fmt::Display) -> Self;

    /// 如果是错误，记录 info 级别日志
    fn log_info(self) -> Self;

    /// 如果是错误，记录 info 级别日志并附加上下文
    fn log_info_with(self, context: impl std::fmt::Display) -> Self;
}

impl<T> ResultExt<T> for Result<T> {
    fn log_err(self) -> Self {
        if let Err(ref e) = self {
            if cfg!(debug_assertions) {
                log::error!("[{}] {}", e.code(), e);
            } else {
                log::error!("[{}]", e.code());
            }
        }
        self
    }

    fn log_err_with(self, context: impl std::fmt::Display) -> Self {
        if let Err(ref e) = self {
            if cfg!(debug_assertions) {
                log::error!("[{}] {}: {}", e.code(), e, context);
            } else {
                log::error!("[{}]", e.code());
            }
        }
        self
    }

    fn log_warn(self) -> Self {
        if let Err(ref e) = self {
            if cfg!(debug_assertions) {
                log::warn!("[{}] {}", e.code(), e);
            } else {
                log::warn!("[{}]", e.code());
            }
        }
        self
    }

    fn log_warn_with(self, context: impl std::fmt::Display) -> Self {
        if let Err(ref e) = self {
            if cfg!(debug_assertions) {
                log::warn!("[{}] {}: {}", e.code(), e, context);
            } else {
                log::warn!("[{}]", e.code());
            }
        }
        self
    }

    fn log_info(self) -> Self {
        if let Err(ref e) = self {
            if cfg!(debug_assertions) {
                log::info!("[{}] {}", e.code(), e);
            } else {
                log::info!("[{}]", e.code());
            }
        }
        self
    }

    fn log_info_with(self, context: impl std::fmt::Display) -> Self {
        if let Err(ref e) = self {
            if cfg!(debug_assertions) {
                log::info!("[{}] {}: {}", e.code(), e, context);
            } else {
                log::info!("[{}]", e.code());
            }
        }
        self
    }
}
