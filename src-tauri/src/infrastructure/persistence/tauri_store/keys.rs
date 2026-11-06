//! Store 键名常量
//!
//! 所有键在此处统一定义，避免多处硬编码；前端与后端共用同一套键名。

/// 存储相关配置（与前端 storage-settings 对应）
pub const STORAGE: &str = "storage";

/// MCP 配置
pub const MCP: &str = "mcp";

/// 存储配置下的子键
pub mod storage {
    pub const LOGS_PATH: &str = "logsPath";
    pub const CACHE_PATH: &str = "cachePath";
    pub const BETA_CHANNEL: &str = "betaChannel";
}
