use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiTagItem {
    pub uuid: String,
    pub name: String,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
    pub environments_count: Option<i32>,
}
