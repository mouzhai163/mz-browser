use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiWorkspaceListResponse {
    pub current_workspace_uuid: Option<String>,
    pub workspaces: Vec<LocalApiWorkspaceItem>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiWorkspaceItem {
    pub uuid: String,
    pub name: String,
    pub workspace_type: String,
    pub is_current: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalApiWorkspaceDetail {
    pub uuid: String,
    pub name: String,
    pub workspace_type: String,
}
