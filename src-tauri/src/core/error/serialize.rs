//! 序列化实现
//!
//! 实现 Error 类型的序列化，用于 Tauri 命令返回

use super::Error;
use serde::Serialize;

/// Tauri 序列化实现
///
/// 根据编译模式返回不同的错误信息：
/// - debug: 完整信息
/// - release: 只返回错误码
impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.format_for_frontend())
    }
}
