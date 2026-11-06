use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiEnvironmentListResponse {
    pub items: Vec<LocalApiEnvironmentItem>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiEnvironmentItem {
    pub environment: LocalApiEnvironmentCore,
    pub group: Option<LocalApiEnvironmentGroup>,
    pub proxy: Option<LocalApiEnvironmentProxy>,
    pub tags: Vec<LocalApiEnvironmentTag>,
}

pub type LocalApiEnvironmentDetailResponse = LocalApiEnvironmentItem;
pub type LocalApiBatchEnvironmentDetailResponse =
    HashMap<String, LocalApiEnvironmentDetailResponse>;
pub type LocalApiRecycleBinEnvironmentListResponse = LocalApiEnvironmentListResponse;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiEnvironmentCore {
    pub uuid: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub last_opened_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiEnvironmentGroup {
    pub uuid: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiEnvironmentProxy {
    pub uuid: String,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub proxy_type: String,
    pub username: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiEnvironmentTag {
    pub uuid: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiEnvironmentUrlItem {
    pub id: i32,
    pub url: String,
    pub title: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiEnvironmentCookieItem {
    pub site: String,
    pub cookie_text: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalApiStartEnvironmentRequest {
    pub env_uuid: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalApiBatchStartEnvironmentsRequest {
    pub env_uuids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalApiEnvironmentActionResponse {
    pub env_uuid: String,
    pub success: bool,
}
