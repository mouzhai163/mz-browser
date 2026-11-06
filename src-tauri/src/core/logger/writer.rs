//! 多文件日志写入器：按 target 分发到不同日志文件

use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use log::{Level, LevelFilter, Log, Metadata, Record};

use crate::core::logger::channels;

/// 第三方库的 target 前缀，这些仅记录 Warn 及以上，避免泄露敏感信息
const THIRD_PARTY_PREFIXES: &[&str] = &[
    "reqwest",
    "hyper",
    "hyper_util",
    "h2",
    "http",
    "http_body",
    "tower",
    "tower_http",
    "rustls",
    "tls",
    "keyring",
];

pub struct MultiFileLogger {
    pub log_dir: PathBuf,
    pub max_level: LevelFilter,
    /// file_stem -> File，按需打开并缓存
    files: Mutex<HashMap<String, std::fs::File>>,
}

impl MultiFileLogger {
    pub fn new(log_dir: PathBuf, max_level: LevelFilter) -> Self {
        Self {
            log_dir,
            max_level,
            files: Mutex::new(HashMap::new()),
        }
    }

    /// 第三方库仅记录 Warn 及以上，避免泄露敏感信息
    fn should_skip_third_party(&self, record: &Record) -> bool {
        let target = record.target();
        for prefix in THIRD_PARTY_PREFIXES {
            if target.starts_with(prefix) && record.level() < Level::Warn {
                return true;
            }
        }
        false
    }

    fn write_log(&self, file_stem: &str, record: &Record, level: Level) {
        let line = format!(
            "{} [{}] [{}] {}\n",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
            level,
            record.target(),
            record.args()
        );
        let mut guard = match self.files.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        let file = match guard.get_mut(file_stem) {
            Some(f) => f,
            None => {
                let path = self.log_dir.join(format!("{}.log", file_stem));
                match std::fs::OpenOptions::new().create(true).append(true).open(&path) {
                    Ok(f) => {
                        guard.insert(file_stem.to_string(), f);
                        guard.get_mut(file_stem).unwrap()
                    }
                    Err(_) => return,
                }
            }
        };
        let _ = file.write_all(line.as_bytes());
        let _ = file.flush();
    }
}

impl Log for MultiFileLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= self.max_level
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        if self.should_skip_third_party(record) {
            return;
        }
        let file_stem = channels::file_stem_for_target(record.target());
        self.write_log(file_stem, record, record.level());
    }

    fn flush(&self) {
        if let Ok(mut guard) = self.files.lock() {
            for f in guard.values_mut() {
                let _ = f.flush();
            }
        }
    }
}
