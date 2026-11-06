use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiProxyListResponse {
    pub items: Vec<LocalApiProxyItem>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiProxyItem {
    pub uuid: String,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub proxy_type: String,
    pub username: Option<String>,
    pub country: Option<String>,
    pub city: Option<String>,
    pub status: String,
    pub latency: Option<i32>,
    pub last_checked_at: Option<String>,
    pub environments_count: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiProxyDetail {
    pub uuid: String,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub proxy_type: String,
    pub username: Option<String>,
    pub country: Option<String>,
    pub city: Option<String>,
    pub status: String,
    pub latency: Option<i32>,
    pub last_checked_at: Option<String>,
    pub environments_count: Option<i64>,
}
