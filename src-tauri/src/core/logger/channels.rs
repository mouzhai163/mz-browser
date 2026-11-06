//! 日志通道配置：target → 日志文件
//!
//! 每个「通道」指定某个 target 写入哪个日志文件（同名则同文件）。
//! 未在列表中的 target 统一写入默认日志（本体日志）。
//! 新增功能只需：在 [modules] 中加常量，在此处加一条映射即可。

use std::path::{Path, PathBuf};

use crate::core::logger::modules;

/// 单条通道：target 与对应日志文件名（不含路径，如 `simprint_api` → `simprint_api.log`）
#[derive(Clone, Debug)]
pub struct Channel {
    /// 日志 target，如 `simprint::api`
    pub target: &'static str,
    /// 日志文件名（不含扩展名），如 `simprint_api`
    pub file_stem: &'static str,
}

/// 所有「独立文件」通道：这些 target 会写入各自单独日志文件
fn channel_list() -> &'static [Channel] {
    &[
        Channel {
            target: modules::APP,
            file_stem: "simprint_app",
        },
        Channel {
            target: modules::API,
            file_stem: "simprint_api",
        },
        Channel {
            target: modules::SYNCER,
            file_stem: "simprint_syncer",
        },
        // 扩展：在此追加新通道即可新增独立日志文件
    ]
}

/// 默认日志文件名（未匹配到任何通道的 target 使用）
const DEFAULT_FILE_STEM: &str = "simprint_app";

/// 根据 target 解析出该条日志应写入的日志文件名（不含路径）
pub fn file_stem_for_target(target: &str) -> &'static str {
    for ch in channel_list() {
        if ch.target == target {
            return ch.file_stem;
        }
    }
    DEFAULT_FILE_STEM
}

/// 在指定目录下生成某通道的完整日志路径
pub fn log_path_for_target(log_dir: &Path, target: &str) -> PathBuf {
    let stem = file_stem_for_target(target);
    log_dir.join(format!("{}.log", stem))
}
