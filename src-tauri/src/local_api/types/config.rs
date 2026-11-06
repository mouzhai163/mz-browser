use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalApiRuntimeConfig {
    pub enabled: bool,
    pub api_key: String,
    pub port: i32,
    pub remote_access: bool,
    pub cors_origins: Vec<String>,
    pub requests_today: i32,
    pub daily_limit: i32,
}
