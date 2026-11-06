//! 日志 target 常量
//!
//! 每个常量对应一个「通道」，用于决定写入哪个日志文件（见 [channels]）。
//! 打日志时使用本模块常量 + 宏，例如：`log_info!(modules::APP, "msg")`。

/// 应用本体、主流程、启动
pub const APP: &str = "simprint::app";
/// 认证、登录、凭证
pub const AUTH: &str = "simprint::auth";
/// 代理检测、直连 IP、代理相关
pub const PROXY: &str = "simprint::proxy";
/// 更新检查、下载、安装
pub const UPDATER: &str = "simprint::updater";
/// 加密、RSA、AES、密钥
pub const CRYPTO: &str = "simprint::crypto";
/// 配置加载与解析
pub const CONFIG: &str = "simprint::config";
/// 存储、锚点、状态、凭证存储
pub const STORAGE: &str = "simprint::storage";
/// 窗口、布局
pub const WINDOW: &str = "simprint::window";
/// 内核、浏览器进程启动
pub const KERNEL: &str = "simprint::kernel";
/// 网络请求、HTTP、代理测试
pub const NETWORK: &str = "simprint::network";
/// 前端/插件通过 Tauri 记录的日志
pub const FRONTEND: &str = "simprint::frontend";
/// 闪屏、启动流程
pub const SPLASH: &str = "simprint::splash";
/// 系统、状态、文件等
pub const SYSTEM: &str = "simprint::system";

// ---------- 独立日志文件通道（每个对应一个单独日志文件） ----------

/// API 功能专用日志（写入 simprint_api.log）
pub const API: &str = "simprint::api";
/// 同步器功能专用日志（写入 simprint_syncer.log）。
/// 仅记录连接/断开、握手、错误等生命周期与异常，不要记录每条鼠标/键盘等高频事件。
pub const SYNCER: &str = "simprint::syncer";
