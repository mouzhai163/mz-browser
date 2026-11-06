use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiGroupListResponse {
    pub items: Vec<LocalApiGroupItem>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiGroupItem {
    pub uuid: String,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
    pub environments_count: Option<i64>,
}
