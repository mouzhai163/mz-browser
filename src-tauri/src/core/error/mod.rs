//! 应用统一错误处理系统
//!
//! 本模块定义了应用级别的错误类型，整合了错误码系统。
//!
//! ## 设计原则
//!
//! 1. **错误定义即错误码定义**：错误码直接在 #[error] 属性中定义
//! 2. **最大化自动转换**：常见错误类型使用 #[from] 自动转换
//! 3. **链式日志调用**：提供 Result 扩展方法支持链式日志记录
//! 4. **环境感知**：开发环境显示详细信息，生产环境只显示错误码
//!
//! ## 使用示例
//!
//! ```rust
//! use crate::core::error::{Error, Result, ResultExt};
//!
//! // 自动转换，无需 map_err
//! #[tauri::command]
//! pub async fn read_file(path: String) -> Result<String> {
//!     tokio::fs::read_to_string(&path).await?  // io::Error 自动转换
//! }
//!
//! // 手动构造特定错误
//! #[tauri::command]
//! pub fn validate() -> Result<()> {
//!     if !is_valid() {
//!         return Err(Error::ValidationFailed.log());
//!     }
//!     Ok(())
//! }
//! ```

mod convert;
mod ext;
mod serialize;
mod types;

// 重新导出公共 API
pub use ext::ResultExt;
pub use types::Error;

/// 应用 Result 类型别名
///
/// 使用应用的 Error 类型作为错误类型，符合 Rust 惯例
pub type Result<T> = std::result::Result<T, Error>;
