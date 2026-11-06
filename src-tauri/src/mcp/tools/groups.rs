use std::borrow::Cow;

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    local_api::entitys::LocalApiGroupItem,
    mcp::{error::McpToolError, server::McpServer},
};

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<ListGroupsTool>()
        .with_async_tool::<CreateGroupTool>()
        .with_async_tool::<UpdateGroupTool>()
        .with_async_tool::<DeleteGroupTool>()
        .into_iter()
        .collect()
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct ListGroupsInput {}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ListGroupsOutput {
    pub items: Vec<GroupSummary>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct GroupSummary {
    pub uuid: String,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
    pub environments_count: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct CreateGroupInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct UpdateGroupInput {
    pub group_uuid: String,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct GroupIdentityInput {
    pub group_uuid: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct GroupMutationOutput {
    pub success: bool,
    pub uuid: Option<String>,
    pub data: Option<Value>,
}

struct ListGroupsTool;
struct CreateGroupTool;
struct UpdateGroupTool;
struct DeleteGroupTool;

impl ToolBase for ListGroupsTool {
    type Parameter = ListGroupsInput;
    type Output = ListGroupsOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_list_groups".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("List Simprint groups.".into())
    }
}

impl AsyncTool<McpServer> for ListGroupsTool {
    async fn invoke(
        service: &McpServer,
        _param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let response = service.bridge().list_groups().await?;
        Ok(ListGroupsOutput {
            items: response.items.into_iter().map(map_group).collect(),
        })
    }
}

impl ToolBase for CreateGroupTool {
    type Parameter = CreateGroupInput;
    type Output = GroupMutationOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_create_group".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Create a Simprint group.".into())
    }
}

impl AsyncTool<McpServer> for CreateGroupTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        if param.name.trim().is_empty() {
            return Err(McpToolError::invalid_params("name is required"));
        }

        let data = service
            .bridge()
            .create_group(&serde_json::json!({
                "name": param.name.trim(),
                "description": param.description.as_deref().map(str::trim).filter(|v| !v.is_empty()),
            }))
            .await?;

        Ok(GroupMutationOutput {
            success: true,
            uuid: extract_uuid(&data),
            data: Some(data),
        })
    }
}

impl ToolBase for UpdateGroupTool {
    type Parameter = UpdateGroupInput;
    type Output = GroupMutationOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_update_group".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Update a Simprint group.".into())
    }
}

impl AsyncTool<McpServer> for UpdateGroupTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let group_uuid = require_group_uuid(&param.group_uuid)?;
        service
            .bridge()
            .update_group(&serde_json::json!({
                "uuid": group_uuid.clone(),
                "name": param.name.as_deref().map(str::trim).filter(|v| !v.is_empty()),
                "description": param.description.as_deref().map(str::trim).filter(|v| !v.is_empty()),
            }))
            .await?;

        Ok(GroupMutationOutput {
            success: true,
            uuid: Some(group_uuid),
            data: None,
        })
    }
}

impl ToolBase for DeleteGroupTool {
    type Parameter = GroupIdentityInput;
    type Output = GroupMutationOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_delete_group".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Delete a Simprint group by UUID.".into())
    }
}

impl AsyncTool<McpServer> for DeleteGroupTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let group_uuid = require_group_uuid(&param.group_uuid)?;
        service.bridge().delete_group(&group_uuid).await?;

        Ok(GroupMutationOutput {
            success: true,
            uuid: Some(group_uuid),
            data: None,
        })
    }
}

fn map_group(group: LocalApiGroupItem) -> GroupSummary {
    GroupSummary {
        uuid: group.uuid,
        name: group.name,
        description: group.description,
        sort_order: group.sort_order,
        environments_count: group.environments_count,
    }
}

fn require_group_uuid(value: &str) -> Result<String, McpToolError> {
    let group_uuid = value.trim();
    if group_uuid.is_empty() {
        Err(McpToolError::invalid_params("group_uuid is required"))
    } else {
        Ok(group_uuid.to_string())
    }
}

fn extract_uuid(value: &Value) -> Option<String> {
    value.get("uuid").and_then(Value::as_str).map(ToString::to_string)
}
