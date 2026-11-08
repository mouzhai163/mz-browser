use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::Pagination;

/// 查询分组列表请求
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ListGroupsRequest {
    #[serde(flatten)]
    pub pagination: Pagination,
    pub keyword: Option<String>,
}

/// 创建分组请求
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateGroupRequest {
    pub name: String,
    pub description: Option<String>,
}

/// 更新分组请求
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UpdateGroupRequest {
    pub uuid: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
}
