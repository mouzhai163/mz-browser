use serde::Deserialize;
use std::path::Path;

/// Connection settings for the embedded SQLite database.
#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub max_lifetime: u64,
    pub acquire_timeout: u64,
    pub idle_timeout: u64,
}

impl DatabaseConfig {
    pub fn embedded(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            max_connections: 4,
            min_connections: 1,
            max_lifetime: 30 * 60,
            acquire_timeout: 30,
            idle_timeout: 10 * 60,
        }
    }

    pub fn from_path(path: &Path) -> Self {
        let normalized = path.to_string_lossy().replace('\\', "/");
        Self::embedded(format!("sqlite://{normalized}"))
    }
}
