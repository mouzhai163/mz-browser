use std::borrow::Cow;

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::{Deserialize, Serialize};

use crate::{
    local_api::entitys::{LocalApiWorkspaceDetail, LocalApiWorkspaceItem},
    mcp::{error::McpToolError, server::McpServer},
};

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<ListWorkspacesTool>()
        .with_async_tool::<GetWorkspaceTool>()
        .with_async_tool::<SwitchWorkspaceTool>()
        .into_iter()
        .collect()
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct ListWorkspacesInput {}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct WorkspaceIdentityInput {
    pub workspace_uuid: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ListWorkspacesOutput {
    pub current_workspace_uuid: Option<String>,
    pub items: Vec<WorkspaceSummary>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct WorkspaceSummary {
    pub uuid: String,
    pub name: String,
    pub workspace_type: String,
    pub is_current: bool,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct WorkspaceDetailOutput {
    pub uuid: String,
    pub name: String,
    pub workspace_type: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct WorkspaceActionOutput {
    pub workspace_uuid: String,
    pub success: bool,
}

struct ListWorkspacesTool;
struct GetWorkspaceTool;
struct SwitchWorkspaceTool;

impl ToolBase for ListWorkspacesTool {
    type Parameter = ListWorkspacesInput;
    type Output = ListWorkspacesOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_list_workspaces".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("List Simprint workspaces and indicate the current workspace.".into())
    }
}

impl AsyncTool<McpServer> for ListWorkspacesTool {
    async fn invoke(
        service: &McpServer,
        _param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let response = service.bridge().list_workspaces().await?;
        Ok(ListWorkspacesOutput {
            current_workspace_uuid: response.current_workspace_uuid,
            items: response.workspaces.into_iter().map(map_workspace).collect(),
        })
    }
}

impl ToolBase for GetWorkspaceTool {
    type Parameter = WorkspaceIdentityInput;
    type Output = WorkspaceDetailOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_get_workspace".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Get a Simprint workspace by UUID.".into())
    }
}

impl AsyncTool<McpServer> for GetWorkspaceTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let workspace_uuid = require_workspace_uuid(&param.workspace_uuid)?;
        let detail = service.bridge().get_workspace(&workspace_uuid).await?;
        Ok(map_workspace_detail(detail))
    }
}

impl ToolBase for SwitchWorkspaceTool {
    type Parameter = WorkspaceIdentityInput;
    type Output = WorkspaceActionOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_switch_workspace".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Switch the current Simprint workspace by UUID.".into())
    }
}

impl AsyncTool<McpServer> for SwitchWorkspaceTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let workspace_uuid = require_workspace_uuid(&param.workspace_uuid)?;
        service.bridge().switch_workspace(&workspace_uuid).await?;

        Ok(WorkspaceActionOutput {
            workspace_uuid,
            success: true,
        })
    }
}

fn map_workspace(workspace: LocalApiWorkspaceItem) -> WorkspaceSummary {
    WorkspaceSummary {
        uuid: workspace.uuid,
        name: workspace.name,
        workspace_type: workspace.workspace_type,
        is_current: workspace.is_current,
    }
}

fn map_workspace_detail(workspace: LocalApiWorkspaceDetail) -> WorkspaceDetailOutput {
    WorkspaceDetailOutput {
        uuid: workspace.uuid,
        name: workspace.name,
        workspace_type: workspace.workspace_type,
    }
}

fn require_workspace_uuid(value: &str) -> Result<String, McpToolError> {
    let workspace_uuid = value.trim();
    if workspace_uuid.is_empty() {
        Err(McpToolError::invalid_params("workspace_uuid is required"))
    } else {
        Ok(workspace_uuid.to_string())
    }
}
