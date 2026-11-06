use std::borrow::Cow;

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    local_api::entitys::LocalApiTagItem,
    mcp::{error::McpToolError, server::McpServer},
};

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<ListTagsTool>()
        .with_async_tool::<CreateTagTool>()
        .with_async_tool::<UpdateTagTool>()
        .with_async_tool::<DeleteTagTool>()
        .into_iter()
        .collect()
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct ListTagsInput {}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ListTagsOutput {
    pub items: Vec<TagSummary>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct TagSummary {
    pub uuid: String,
    pub name: String,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
    pub environments_count: Option<i32>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct CreateTagInput {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct UpdateTagInput {
    pub tag_uuid: String,
    pub name: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct TagIdentityInput {
    pub tag_uuid: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct TagMutationOutput {
    pub success: bool,
    pub uuid: Option<String>,
    pub data: Option<Value>,
}

struct ListTagsTool;
struct CreateTagTool;
struct UpdateTagTool;
struct DeleteTagTool;

impl ToolBase for ListTagsTool {
    type Parameter = ListTagsInput;
    type Output = ListTagsOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_list_tags".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("List Simprint tags.".into())
    }
}

impl AsyncTool<McpServer> for ListTagsTool {
    async fn invoke(
        service: &McpServer,
        _param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let items = service.bridge().list_tags().await?;
        Ok(ListTagsOutput {
            items: items.into_iter().map(map_tag).collect(),
        })
    }
}

impl ToolBase for CreateTagTool {
    type Parameter = CreateTagInput;
    type Output = TagMutationOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_create_tag".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Create a Simprint tag.".into())
    }
}

impl AsyncTool<McpServer> for CreateTagTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        if param.name.trim().is_empty() {
            return Err(McpToolError::invalid_params("name is required"));
        }
        if param.color.trim().is_empty() {
            return Err(McpToolError::invalid_params("color is required"));
        }

        let data = service
            .bridge()
            .create_tag(&serde_json::json!({
                "name": param.name.trim(),
                "color": param.color.trim(),
            }))
            .await?;

        Ok(TagMutationOutput {
            success: true,
            uuid: extract_uuid(&data),
            data: Some(data),
        })
    }
}

impl ToolBase for UpdateTagTool {
    type Parameter = UpdateTagInput;
    type Output = TagMutationOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_update_tag".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Update a Simprint tag.".into())
    }
}

impl AsyncTool<McpServer> for UpdateTagTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let tag_uuid = require_tag_uuid(&param.tag_uuid)?;
        service
            .bridge()
            .update_tag(&serde_json::json!({
                "uuid": tag_uuid.clone(),
                "name": param.name.as_deref().map(str::trim).filter(|v| !v.is_empty()),
                "color": param.color.as_deref().map(str::trim).filter(|v| !v.is_empty()),
            }))
            .await?;

        Ok(TagMutationOutput {
            success: true,
            uuid: Some(tag_uuid),
            data: None,
        })
    }
}

impl ToolBase for DeleteTagTool {
    type Parameter = TagIdentityInput;
    type Output = TagMutationOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_delete_tag".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Delete a Simprint tag by UUID.".into())
    }
}

impl AsyncTool<McpServer> for DeleteTagTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let tag_uuid = require_tag_uuid(&param.tag_uuid)?;
        service.bridge().delete_tag(&tag_uuid).await?;

        Ok(TagMutationOutput {
            success: true,
            uuid: Some(tag_uuid),
            data: None,
        })
    }
}

fn map_tag(tag: LocalApiTagItem) -> TagSummary {
    TagSummary {
        uuid: tag.uuid,
        name: tag.name,
        color: tag.color,
        sort_order: tag.sort_order,
        environments_count: tag.environments_count,
    }
}

fn require_tag_uuid(value: &str) -> Result<String, McpToolError> {
    let tag_uuid = value.trim();
    if tag_uuid.is_empty() {
        Err(McpToolError::invalid_params("tag_uuid is required"))
    } else {
        Ok(tag_uuid.to_string())
    }
}

fn extract_uuid(value: &Value) -> Option<String> {
    value.get("uuid").and_then(Value::as_str).map(ToString::to_string)
}
