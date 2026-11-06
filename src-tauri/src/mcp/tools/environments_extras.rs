use std::{borrow::Cow, collections::HashMap};

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    local_api::entitys::{
        LocalApiEnvironmentCookieItem, LocalApiEnvironmentDetailResponse, LocalApiEnvironmentGroup,
        LocalApiEnvironmentProxy, LocalApiEnvironmentTag, LocalApiEnvironmentUrlItem,
    },
    mcp::{
        bridge::{LocalApiEnvironmentListFilters, LocalApiListEnvironmentsRequest},
        error::McpToolError,
        server::McpServer,
    },
};

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<BatchGetEnvironmentsTool>()
        .with_async_tool::<CreateEnvironmentTool>()
        .with_async_tool::<UpdateEnvironmentTool>()
        .with_async_tool::<DeleteEnvironmentTool>()
        .with_async_tool::<BatchDeleteEnvironmentsTool>()
        .with_async_tool::<ListRecycleBinEnvironmentsTool>()
        .with_async_tool::<RestoreEnvironmentTool>()
        .with_async_tool::<BatchRestoreEnvironmentsTool>()
        .with_async_tool::<PermanentDeleteEnvironmentTool>()
        .with_async_tool::<BatchPermanentDeleteEnvironmentsTool>()
        .with_async_tool::<SetEnvironmentProxyTool>()
        .with_async_tool::<SetEnvironmentAccountsTool>()
        .with_async_tool::<AssignEnvironmentTagsTool>()
        .with_async_tool::<BatchAssignEnvironmentTagsTool>()
        .with_async_tool::<RemoveEnvironmentTagTool>()
        .with_async_tool::<BatchRemoveEnvironmentTagsTool>()
        .with_async_tool::<MoveEnvironmentToGroupTool>()
        .with_async_tool::<BatchMoveEnvironmentsToGroupTool>()
        .with_async_tool::<ListEnvironmentUrlsTool>()
        .with_async_tool::<AddEnvironmentUrlTool>()
        .with_async_tool::<DeleteEnvironmentUrlTool>()
        .with_async_tool::<ClearEnvironmentUrlsTool>()
        .with_async_tool::<ListEnvironmentCookiesTool>()
        .with_async_tool::<AddEnvironmentCookieTool>()
        .with_async_tool::<DeleteEnvironmentCookieTool>()
        .with_async_tool::<ClearEnvironmentCookiesTool>()
        .into_iter()
        .collect()
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct EnvironmentIdentityInput {
    pub env_uuid: String,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct BatchEnvironmentIdentityInput {
    pub env_uuids: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct ListRecycleBinEnvironmentsInput {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub keyword: Option<String>,
    pub group_uuid: Option<String>,
    pub tag_uuids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct EnvironmentConfigInput {
    pub window_info: Value,
    pub basic_settings: Value,
    pub fingerprint_settings: Value,
    pub device_settings: Value,
    pub preference_settings: Value,
    pub project_metadata: Option<Value>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, JsonSchema)]
pub struct EnvironmentCookieGroupInput {
    pub site: String,
    pub cookie_text: String,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct CreateEnvironmentInput {
    pub workspace_uuid: String,
    pub team_uuid: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub icon_color: Option<String>,
    pub group_uuid: Option<String>,
    pub tag_uuids: Option<Vec<String>>,
    pub account_uuids: Option<Vec<String>>,
    pub proxy_uuid: Option<String>,
    pub cookies: Option<Vec<EnvironmentCookieGroupInput>>,
    pub config: EnvironmentConfigInput,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct UpdateEnvironmentInput {
    pub env_uuid: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub icon_color: Option<String>,
    pub group_uuid: Option<String>,
    pub config: Option<EnvironmentConfigInput>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct SetEnvironmentProxyInput {
    pub env_uuid: String,
    pub proxy_uuid: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct SetEnvironmentAccountsInput {
    pub env_uuid: String,
    pub account_uuids: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct AssignEnvironmentTagsInput {
    pub env_uuid: String,
    pub tag_uuids: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct BatchAssignEnvironmentTagsInput {
    pub env_uuids: Vec<String>,
    pub tag_uuid: String,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct RemoveEnvironmentTagInput {
    pub env_uuid: String,
    pub tag_uuid: String,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct BatchRemoveEnvironmentTagsInput {
    pub env_uuids: Vec<String>,
    pub tag_uuid: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct MoveEnvironmentToGroupInput {
    pub env_uuid: String,
    pub group_uuid: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct BatchMoveEnvironmentsToGroupInput {
    pub env_uuids: Vec<String>,
    pub group_uuid: String,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct EnvironmentUrlCreateInput {
    pub env_uuid: String,
    pub url: String,
    pub title: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct EnvironmentCookieCreateInput {
    pub env_uuid: String,
    pub site: String,
    pub cookie_text: String,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct ItemIdentityInput {
    pub id: i32,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct BatchGetEnvironmentsOutput {
    pub items: Vec<EnvironmentSummary>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ListRecycleBinEnvironmentsOutput {
    pub items: Vec<EnvironmentSummary>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct EnvironmentMutationOutput {
    pub success: bool,
    pub uuid: Option<String>,
    pub uuids: Option<Vec<String>>,
    pub id: Option<i32>,
    pub data: Option<Value>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct EnvironmentSummary {
    pub uuid: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub last_opened_at: Option<String>,
    pub group: Option<GroupSummary>,
    pub proxy: Option<ProxySummary>,
    pub tags: Vec<TagSummary>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct GroupSummary {
    pub uuid: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ProxySummary {
    pub uuid: String,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub proxy_type: String,
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct TagSummary {
    pub uuid: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct EnvironmentUrlSummary {
    pub id: i32,
    pub url: String,
    pub title: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ListEnvironmentUrlsOutput {
    pub env_uuid: String,
    pub items: Vec<EnvironmentUrlSummary>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct EnvironmentCookieSummary {
    pub site: String,
    pub cookie_text: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ListEnvironmentCookiesOutput {
    pub env_uuid: String,
    pub items: Vec<EnvironmentCookieSummary>,
}

struct BatchGetEnvironmentsTool;
struct CreateEnvironmentTool;
struct UpdateEnvironmentTool;
struct DeleteEnvironmentTool;
struct BatchDeleteEnvironmentsTool;
struct ListRecycleBinEnvironmentsTool;
struct RestoreEnvironmentTool;
struct BatchRestoreEnvironmentsTool;
struct PermanentDeleteEnvironmentTool;
struct BatchPermanentDeleteEnvironmentsTool;
struct SetEnvironmentProxyTool;
struct SetEnvironmentAccountsTool;
struct AssignEnvironmentTagsTool;
struct BatchAssignEnvironmentTagsTool;
struct RemoveEnvironmentTagTool;
struct BatchRemoveEnvironmentTagsTool;
struct MoveEnvironmentToGroupTool;
struct BatchMoveEnvironmentsToGroupTool;
struct ListEnvironmentUrlsTool;
struct AddEnvironmentUrlTool;
struct DeleteEnvironmentUrlTool;
struct ClearEnvironmentUrlsTool;
struct ListEnvironmentCookiesTool;
struct AddEnvironmentCookieTool;
struct DeleteEnvironmentCookieTool;
struct ClearEnvironmentCookiesTool;

macro_rules! environment_uuid_tool {
    ($tool:ident, $input:ty, $output:ty, $name:literal, $description:literal, |$service:ident, $param:ident| $body:block) => {
        impl ToolBase for $tool {
            type Parameter = $input;
            type Output = $output;
            type Error = McpToolError;

            fn name() -> Cow<'static, str> {
                $name.into()
            }

            fn description() -> Option<Cow<'static, str>> {
                Some($description.into())
            }
        }

        impl AsyncTool<McpServer> for $tool {
            async fn invoke(
                $service: &McpServer,
                $param: Self::Parameter,
            ) -> Result<Self::Output, Self::Error> {
                $body
            }
        }
    };
}

environment_uuid_tool!(
    BatchGetEnvironmentsTool,
    BatchEnvironmentIdentityInput,
    BatchGetEnvironmentsOutput,
    "simprint_batch_get_environments",
    "Get multiple Simprint environments by UUID.",
    |service, param| {
        let env_uuids = require_env_uuids(param.env_uuids)?;
        let items = service.bridge().batch_get_environments(env_uuids).await?;

        Ok(BatchGetEnvironmentsOutput {
            items: sort_environment_map(items).into_iter().map(map_environment_detail).collect(),
        })
    }
);

environment_uuid_tool!(
    CreateEnvironmentTool,
    CreateEnvironmentInput,
    EnvironmentMutationOutput,
    "simprint_create_environment",
    "Create a Simprint environment.",
    |service, param| {
        if param.workspace_uuid.trim().is_empty() {
            return Err(McpToolError::invalid_params("workspace_uuid is required"));
        }
        if param.team_uuid.trim().is_empty() {
            return Err(McpToolError::invalid_params("team_uuid is required"));
        }
        if param.name.trim().is_empty() {
            return Err(McpToolError::invalid_params("name is required"));
        }

        let data = service
            .bridge()
            .create_environment(&serde_json::json!({
                "workspace_uuid": param.workspace_uuid.trim(),
                "team_uuid": param.team_uuid.trim(),
                "name": param.name.trim(),
                "description": normalize_optional(param.description),
                "icon": normalize_optional(param.icon),
                "icon_color": normalize_optional(param.icon_color),
                "group_uuid": normalize_optional(param.group_uuid),
                "tag_uuids": normalize_string_vec_optional(param.tag_uuids),
                "account_uuids": normalize_string_vec_optional(param.account_uuids),
                "proxy_uuid": normalize_optional(param.proxy_uuid),
                "cookies": param.cookies,
                "config": map_environment_config(param.config),
            }))
            .await?;

        Ok(EnvironmentMutationOutput {
            success: true,
            uuid: extract_uuid(&data),
            uuids: None,
            id: extract_id(&data),
            data: Some(data),
        })
    }
);

environment_uuid_tool!(
    UpdateEnvironmentTool,
    UpdateEnvironmentInput,
    EnvironmentMutationOutput,
    "simprint_update_environment",
    "Update a Simprint environment.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        service
            .bridge()
            .update_environment(&serde_json::json!({
                "uuid": env_uuid.clone(),
                "name": param.name.as_deref().map(str::trim).filter(|v| !v.is_empty()),
                "description": normalize_optional(param.description),
                "icon": normalize_optional(param.icon),
                "icon_color": normalize_optional(param.icon_color),
                "group_uuid": normalize_optional(param.group_uuid),
                "config": param.config.map(map_environment_config),
            }))
            .await?;

        Ok(EnvironmentMutationOutput {
            success: true,
            uuid: Some(env_uuid),
            uuids: None,
            id: None,
            data: None,
        })
    }
);

environment_uuid_tool!(
    DeleteEnvironmentTool,
    EnvironmentIdentityInput,
    EnvironmentMutationOutput,
    "simprint_delete_environment",
    "Delete a Simprint environment by UUID.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        service.bridge().delete_environment(&env_uuid).await?;

        Ok(success_uuid_output(env_uuid))
    }
);

environment_uuid_tool!(
    BatchDeleteEnvironmentsTool,
    BatchEnvironmentIdentityInput,
    EnvironmentMutationOutput,
    "simprint_batch_delete_environments",
    "Delete multiple Simprint environments by UUID.",
    |service, param| {
        let env_uuids = require_env_uuids(param.env_uuids)?;
        service.bridge().batch_delete_environments(env_uuids.clone()).await?;

        Ok(success_uuids_output(env_uuids))
    }
);

environment_uuid_tool!(
    ListRecycleBinEnvironmentsTool,
    ListRecycleBinEnvironmentsInput,
    ListRecycleBinEnvironmentsOutput,
    "simprint_list_recycle_bin_environments",
    "List deleted Simprint environments in the recycle bin.",
    |service, param| {
        let filters = list_environment_filters(param.keyword, param.group_uuid, param.tag_uuids);
        let response = service
            .bridge()
            .list_recycle_bin_environments(LocalApiListEnvironmentsRequest {
                page: param.page.unwrap_or(1),
                page_size: param.page_size.unwrap_or(20),
                filters,
            })
            .await?;

        Ok(ListRecycleBinEnvironmentsOutput {
            items: response.items.into_iter().map(map_environment_detail).collect(),
            total: response.total,
            page: response.page,
            page_size: response.page_size,
        })
    }
);

environment_uuid_tool!(
    RestoreEnvironmentTool,
    EnvironmentIdentityInput,
    EnvironmentMutationOutput,
    "simprint_restore_environment",
    "Restore a deleted Simprint environment from the recycle bin.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        service.bridge().restore_environment(&env_uuid).await?;

        Ok(success_uuid_output(env_uuid))
    }
);

environment_uuid_tool!(
    BatchRestoreEnvironmentsTool,
    BatchEnvironmentIdentityInput,
    EnvironmentMutationOutput,
    "simprint_batch_restore_environments",
    "Restore multiple deleted Simprint environments from the recycle bin.",
    |service, param| {
        let env_uuids = require_env_uuids(param.env_uuids)?;
        service.bridge().batch_restore_environments(env_uuids.clone()).await?;

        Ok(success_uuids_output(env_uuids))
    }
);

environment_uuid_tool!(
    PermanentDeleteEnvironmentTool,
    EnvironmentIdentityInput,
    EnvironmentMutationOutput,
    "simprint_permanent_delete_environment",
    "Permanently delete an environment from the recycle bin.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        service.bridge().permanent_delete_environment(&env_uuid).await?;

        Ok(success_uuid_output(env_uuid))
    }
);

environment_uuid_tool!(
    BatchPermanentDeleteEnvironmentsTool,
    BatchEnvironmentIdentityInput,
    EnvironmentMutationOutput,
    "simprint_batch_permanent_delete_environments",
    "Permanently delete multiple environments from the recycle bin.",
    |service, param| {
        let env_uuids = require_env_uuids(param.env_uuids)?;
        service.bridge().batch_permanent_delete_environments(env_uuids.clone()).await?;

        Ok(success_uuids_output(env_uuids))
    }
);

environment_uuid_tool!(
    SetEnvironmentProxyTool,
    SetEnvironmentProxyInput,
    EnvironmentMutationOutput,
    "simprint_set_environment_proxy",
    "Assign or clear a proxy for a Simprint environment.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        service
            .bridge()
            .set_environment_proxy(&serde_json::json!({
                "uuid": env_uuid.clone(),
                "proxy_uuid": normalize_optional(param.proxy_uuid),
            }))
            .await?;

        Ok(success_uuid_output(env_uuid))
    }
);

environment_uuid_tool!(
    SetEnvironmentAccountsTool,
    SetEnvironmentAccountsInput,
    EnvironmentMutationOutput,
    "simprint_set_environment_accounts",
    "Set account bindings for a Simprint environment.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        let account_uuids = require_named_uuids("account_uuids", param.account_uuids)?;
        service
            .bridge()
            .set_environment_accounts(&serde_json::json!({
                "uuid": env_uuid.clone(),
                "account_uuids": account_uuids,
            }))
            .await?;

        Ok(success_uuid_output(env_uuid))
    }
);

environment_uuid_tool!(
    AssignEnvironmentTagsTool,
    AssignEnvironmentTagsInput,
    EnvironmentMutationOutput,
    "simprint_assign_environment_tags",
    "Assign multiple tags to a Simprint environment.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        let tag_uuids = require_named_uuids("tag_uuids", param.tag_uuids)?;
        service
            .bridge()
            .assign_tags(&serde_json::json!({
                "uuid": env_uuid.clone(),
                "tag_uuids": tag_uuids,
            }))
            .await?;

        Ok(success_uuid_output(env_uuid))
    }
);

environment_uuid_tool!(
    BatchAssignEnvironmentTagsTool,
    BatchAssignEnvironmentTagsInput,
    EnvironmentMutationOutput,
    "simprint_batch_assign_environment_tags",
    "Assign a tag to multiple Simprint environments.",
    |service, param| {
        let env_uuids = require_env_uuids(param.env_uuids)?;
        let tag_uuid = require_non_empty("tag_uuid", param.tag_uuid)?;
        service
            .bridge()
            .batch_assign_tags(&serde_json::json!({
                "env_uuids": env_uuids.clone(),
                "tag_uuid": tag_uuid,
            }))
            .await?;

        Ok(success_uuids_output(env_uuids))
    }
);

environment_uuid_tool!(
    RemoveEnvironmentTagTool,
    RemoveEnvironmentTagInput,
    EnvironmentMutationOutput,
    "simprint_remove_environment_tag",
    "Remove a tag from a Simprint environment.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        let tag_uuid = require_non_empty("tag_uuid", param.tag_uuid)?;
        service
            .bridge()
            .remove_tag(&serde_json::json!({
                "uuid": env_uuid.clone(),
                "tag_uuid": tag_uuid,
            }))
            .await?;

        Ok(success_uuid_output(env_uuid))
    }
);

environment_uuid_tool!(
    BatchRemoveEnvironmentTagsTool,
    BatchRemoveEnvironmentTagsInput,
    EnvironmentMutationOutput,
    "simprint_batch_remove_environment_tags",
    "Remove one or all tags from multiple Simprint environments.",
    |service, param| {
        let env_uuids = require_env_uuids(param.env_uuids)?;
        service
            .bridge()
            .batch_remove_tags(&serde_json::json!({
                "env_uuids": env_uuids.clone(),
                "tag_uuid": normalize_optional(param.tag_uuid),
            }))
            .await?;

        Ok(success_uuids_output(env_uuids))
    }
);

environment_uuid_tool!(
    MoveEnvironmentToGroupTool,
    MoveEnvironmentToGroupInput,
    EnvironmentMutationOutput,
    "simprint_move_environment_to_group",
    "Move a Simprint environment to a group or clear its group.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        service
            .bridge()
            .move_to_group(&serde_json::json!({
                "uuid": env_uuid.clone(),
                "group_uuid": normalize_optional(param.group_uuid),
            }))
            .await?;

        Ok(success_uuid_output(env_uuid))
    }
);

environment_uuid_tool!(
    BatchMoveEnvironmentsToGroupTool,
    BatchMoveEnvironmentsToGroupInput,
    EnvironmentMutationOutput,
    "simprint_batch_move_environments_to_group",
    "Move multiple Simprint environments to a group.",
    |service, param| {
        let env_uuids = require_env_uuids(param.env_uuids)?;
        let group_uuid = require_non_empty("group_uuid", param.group_uuid)?;
        service
            .bridge()
            .batch_move_to_group(&serde_json::json!({
                "env_uuids": env_uuids.clone(),
                "group_uuid": group_uuid,
            }))
            .await?;

        Ok(success_uuids_output(env_uuids))
    }
);

environment_uuid_tool!(
    ListEnvironmentUrlsTool,
    EnvironmentIdentityInput,
    ListEnvironmentUrlsOutput,
    "simprint_list_environment_urls",
    "List configured start URLs for a Simprint environment.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        let items = service.bridge().list_environment_urls(&env_uuid).await?;

        Ok(ListEnvironmentUrlsOutput {
            env_uuid,
            items: items.into_iter().map(map_environment_url).collect(),
        })
    }
);

environment_uuid_tool!(
    AddEnvironmentUrlTool,
    EnvironmentUrlCreateInput,
    EnvironmentMutationOutput,
    "simprint_add_environment_url",
    "Add a start URL to a Simprint environment.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        if param.url.trim().is_empty() {
            return Err(McpToolError::invalid_params("url is required"));
        }

        let data = service
            .bridge()
            .add_environment_url(&serde_json::json!({
                "environment_uuid": env_uuid.clone(),
                "url": param.url.trim(),
                "title": normalize_optional(param.title),
                "sort_order": param.sort_order,
            }))
            .await?;

        Ok(EnvironmentMutationOutput {
            success: true,
            uuid: Some(env_uuid),
            uuids: None,
            id: extract_id(&data),
            data: Some(data),
        })
    }
);

environment_uuid_tool!(
    DeleteEnvironmentUrlTool,
    ItemIdentityInput,
    EnvironmentMutationOutput,
    "simprint_delete_environment_url",
    "Delete a stored environment URL by ID.",
    |service, param| {
        if param.id <= 0 {
            return Err(McpToolError::invalid_params("id must be greater than 0"));
        }
        service.bridge().delete_environment_url(param.id).await?;

        Ok(EnvironmentMutationOutput {
            success: true,
            uuid: None,
            uuids: None,
            id: Some(param.id),
            data: None,
        })
    }
);

environment_uuid_tool!(
    ClearEnvironmentUrlsTool,
    EnvironmentIdentityInput,
    EnvironmentMutationOutput,
    "simprint_clear_environment_urls",
    "Clear all stored URLs for a Simprint environment.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        service.bridge().clear_environment_urls(&env_uuid).await?;

        Ok(success_uuid_output(env_uuid))
    }
);

environment_uuid_tool!(
    ListEnvironmentCookiesTool,
    EnvironmentIdentityInput,
    ListEnvironmentCookiesOutput,
    "simprint_list_environment_cookies",
    "List stored cookies for a Simprint environment.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        let items = service.bridge().list_environment_cookies(&env_uuid).await?;

        Ok(ListEnvironmentCookiesOutput {
            env_uuid,
            items: items.into_iter().map(map_environment_cookie).collect(),
        })
    }
);

environment_uuid_tool!(
    AddEnvironmentCookieTool,
    EnvironmentCookieCreateInput,
    EnvironmentMutationOutput,
    "simprint_add_environment_cookie",
    "Add a cookie to a Simprint environment.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        if param.site.trim().is_empty() {
            return Err(McpToolError::invalid_params("site is required"));
        }
        if param.cookie_text.trim().is_empty() {
            return Err(McpToolError::invalid_params("cookie_text is required"));
        }

        let data = service
            .bridge()
            .add_environment_cookie(&serde_json::json!({
                "environment_uuid": env_uuid.clone(),
                "site": param.site.trim(),
                "cookie_text": param.cookie_text.trim(),
            }))
            .await?;

        Ok(EnvironmentMutationOutput {
            success: true,
            uuid: Some(env_uuid),
            uuids: None,
            id: extract_id(&data),
            data: Some(data),
        })
    }
);

environment_uuid_tool!(
    DeleteEnvironmentCookieTool,
    ItemIdentityInput,
    EnvironmentMutationOutput,
    "simprint_delete_environment_cookie",
    "Delete a stored environment cookie by ID.",
    |service, param| {
        if param.id <= 0 {
            return Err(McpToolError::invalid_params("id must be greater than 0"));
        }
        service.bridge().delete_environment_cookie(param.id).await?;

        Ok(EnvironmentMutationOutput {
            success: true,
            uuid: None,
            uuids: None,
            id: Some(param.id),
            data: None,
        })
    }
);

environment_uuid_tool!(
    ClearEnvironmentCookiesTool,
    EnvironmentIdentityInput,
    EnvironmentMutationOutput,
    "simprint_clear_environment_cookies",
    "Clear all stored cookies for a Simprint environment.",
    |service, param| {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        service.bridge().clear_environment_cookies(&env_uuid).await?;

        Ok(success_uuid_output(env_uuid))
    }
);

fn sort_environment_map(
    items: HashMap<String, LocalApiEnvironmentDetailResponse>,
) -> Vec<LocalApiEnvironmentDetailResponse> {
    let mut items = items.into_values().collect::<Vec<_>>();
    items.sort_by(|left, right| left.environment.name.cmp(&right.environment.name));
    items
}

fn map_environment_detail(detail: LocalApiEnvironmentDetailResponse) -> EnvironmentSummary {
    EnvironmentSummary {
        uuid: detail.environment.uuid,
        name: detail.environment.name,
        description: detail.environment.description,
        status: detail.environment.status,
        last_opened_at: detail.environment.last_opened_at,
        group: detail.group.map(map_group),
        proxy: detail.proxy.map(map_proxy),
        tags: detail.tags.into_iter().map(map_tag).collect(),
    }
}

fn map_group(group: LocalApiEnvironmentGroup) -> GroupSummary {
    GroupSummary {
        uuid: group.uuid,
        name: group.name,
    }
}

fn map_proxy(proxy: LocalApiEnvironmentProxy) -> ProxySummary {
    ProxySummary {
        uuid: proxy.uuid,
        name: proxy.name,
        host: proxy.host,
        port: proxy.port,
        proxy_type: proxy.proxy_type,
        username: proxy.username,
    }
}

fn map_tag(tag: LocalApiEnvironmentTag) -> TagSummary {
    TagSummary {
        uuid: tag.uuid,
        name: tag.name,
        color: tag.color,
    }
}

fn map_environment_url(item: LocalApiEnvironmentUrlItem) -> EnvironmentUrlSummary {
    EnvironmentUrlSummary {
        id: item.id,
        url: item.url,
        title: item.title,
        sort_order: item.sort_order,
    }
}

fn map_environment_cookie(item: LocalApiEnvironmentCookieItem) -> EnvironmentCookieSummary {
    EnvironmentCookieSummary {
        site: item.site,
        cookie_text: item.cookie_text,
    }
}

fn map_environment_config(config: EnvironmentConfigInput) -> Value {
    serde_json::json!({
        "window_info": config.window_info,
        "basic_settings": config.basic_settings,
        "fingerprint_settings": config.fingerprint_settings,
        "device_settings": config.device_settings,
        "preference_settings": config.preference_settings,
        "project_metadata": config.project_metadata,
    })
}

fn list_environment_filters(
    keyword: Option<String>,
    group_uuid: Option<String>,
    tag_uuids: Option<Vec<String>>,
) -> Option<LocalApiEnvironmentListFilters> {
    if keyword.is_some() || group_uuid.is_some() || tag_uuids.is_some() {
        Some(LocalApiEnvironmentListFilters {
            keyword: keyword.map(normalize_non_empty),
            group_uuid: group_uuid.map(normalize_non_empty),
            tag_uuids: normalize_string_vec_optional(tag_uuids),
        })
    } else {
        None
    }
}

fn success_uuid_output(uuid: String) -> EnvironmentMutationOutput {
    EnvironmentMutationOutput {
        success: true,
        uuid: Some(uuid),
        uuids: None,
        id: None,
        data: None,
    }
}

fn success_uuids_output(uuids: Vec<String>) -> EnvironmentMutationOutput {
    EnvironmentMutationOutput {
        success: true,
        uuid: None,
        uuids: Some(uuids),
        id: None,
        data: None,
    }
}

fn require_env_uuid(value: &str) -> Result<String, McpToolError> {
    let env_uuid = value.trim();
    if env_uuid.is_empty() {
        Err(McpToolError::invalid_params("env_uuid is required"))
    } else {
        Ok(env_uuid.to_string())
    }
}

fn require_env_uuids(values: Vec<String>) -> Result<Vec<String>, McpToolError> {
    require_named_uuids("env_uuids", values)
}

fn require_named_uuids(field: &str, values: Vec<String>) -> Result<Vec<String>, McpToolError> {
    let values = values
        .into_iter()
        .map(normalize_non_empty)
        .filter(|item| !item.is_empty())
        .collect::<Vec<_>>();

    if values.is_empty() {
        Err(McpToolError::invalid_params(format!(
            "{field} must contain at least one item"
        )))
    } else {
        Ok(values)
    }
}

fn require_non_empty(field: &str, value: String) -> Result<String, McpToolError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        Err(McpToolError::invalid_params(format!("{field} is required")))
    } else {
        Ok(value)
    }
}

fn normalize_non_empty(value: String) -> String {
    value.trim().to_string()
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.map(|item| item.trim().to_string()).filter(|item| !item.is_empty())
}

fn normalize_string_vec_optional(values: Option<Vec<String>>) -> Option<Vec<String>> {
    values
        .map(|items| {
            items
                .into_iter()
                .map(normalize_non_empty)
                .filter(|item| !item.is_empty())
                .collect::<Vec<_>>()
        })
        .filter(|items| !items.is_empty())
}

fn extract_uuid(value: &Value) -> Option<String> {
    value.get("uuid").and_then(Value::as_str).map(ToString::to_string)
}

fn extract_id(value: &Value) -> Option<i32> {
    value.get("id").and_then(Value::as_i64).map(|value| value as i32)
}
