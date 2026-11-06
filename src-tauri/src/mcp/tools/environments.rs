use std::borrow::Cow;

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::{Deserialize, Serialize};

use crate::{
    domain::environment::EnvironmentStatus,
    local_api::entitys::{
        LocalApiEnvironmentGroup, LocalApiEnvironmentProxy, LocalApiEnvironmentTag,
    },
    mcp::{
        bridge::{LocalApiEnvironmentListFilters, LocalApiListEnvironmentsRequest},
        error::McpToolError,
        server::McpServer,
    },
    services::environment::BatchLaunchResult,
};

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<ListEnvironmentsTool>()
        .with_async_tool::<GetEnvironmentTool>()
        .with_async_tool::<StartEnvironmentTool>()
        .with_async_tool::<StopEnvironmentTool>()
        .with_async_tool::<BatchStartEnvironmentsTool>()
        .with_async_tool::<BatchStopEnvironmentsTool>()
        .with_async_tool::<GetEnvironmentStatusTool>()
        .with_async_tool::<GetEnvironmentCdpEndpointTool>()
        .into_iter()
        .collect()
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct ListEnvironmentsInput {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub keyword: Option<String>,
    pub group_uuid: Option<String>,
    pub tag_uuids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ListEnvironmentsOutput {
    pub items: Vec<EnvironmentSummary>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct EnvironmentIdentityInput {
    pub env_uuid: String,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct BatchEnvironmentIdentityInput {
    pub env_uuids: Vec<String>,
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
pub struct EnvironmentActionOutput {
    pub env_uuid: String,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct BatchEnvironmentActionOutput {
    pub items: Vec<BatchEnvironmentActionItem>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct BatchEnvironmentActionItem {
    pub env_uuid: String,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct EnvironmentStatusOutput {
    pub env_uuid: String,
    pub status: Option<String>,
    pub running: bool,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct EnvironmentCdpEndpointOutput {
    pub env_uuid: String,
    pub available: bool,
    pub version_url: Option<String>,
    pub list_url: Option<String>,
    pub browser_ws_url: Option<String>,
}

struct ListEnvironmentsTool;
struct GetEnvironmentTool;
struct StartEnvironmentTool;
struct StopEnvironmentTool;
struct BatchStartEnvironmentsTool;
struct BatchStopEnvironmentsTool;
struct GetEnvironmentStatusTool;
struct GetEnvironmentCdpEndpointTool;

impl ToolBase for ListEnvironmentsTool {
    type Parameter = ListEnvironmentsInput;
    type Output = ListEnvironmentsOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_list_environments".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("List Simprint environments with optional filters.".into())
    }
}

impl AsyncTool<McpServer> for ListEnvironmentsTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let filters = if param.keyword.is_some()
            || param.group_uuid.is_some()
            || param.tag_uuids.is_some()
        {
            Some(LocalApiEnvironmentListFilters {
                keyword: param.keyword.map(normalize_non_empty),
                group_uuid: param.group_uuid.map(normalize_non_empty),
                tag_uuids: param.tag_uuids.map(|values| {
                    values.into_iter().map(normalize_non_empty).filter(|v| !v.is_empty()).collect()
                }),
            })
        } else {
            None
        };

        let response = service
            .bridge()
            .list_environments(LocalApiListEnvironmentsRequest {
                page: param.page.unwrap_or(1),
                page_size: param.page_size.unwrap_or(20),
                filters,
            })
            .await?;

        Ok(ListEnvironmentsOutput {
            items: response.items.into_iter().map(map_environment_detail).collect(),
            total: response.total,
            page: response.page,
            page_size: response.page_size,
        })
    }
}

impl ToolBase for GetEnvironmentTool {
    type Parameter = EnvironmentIdentityInput;
    type Output = EnvironmentSummary;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_get_environment".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Get a Simprint environment by UUID.".into())
    }
}

impl AsyncTool<McpServer> for GetEnvironmentTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        if param.env_uuid.trim().is_empty() {
            return Err(McpToolError::invalid_params("env_uuid is required"));
        }

        let detail = service.bridge().get_environment(param.env_uuid.trim()).await?;
        Ok(map_environment_detail(detail))
    }
}

impl ToolBase for StartEnvironmentTool {
    type Parameter = EnvironmentIdentityInput;
    type Output = EnvironmentActionOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_start_environment".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Start a Simprint environment by UUID.".into())
    }
}

impl AsyncTool<McpServer> for StartEnvironmentTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        let result = service.bridge().start_environment(&env_uuid).await?;
        Ok(EnvironmentActionOutput {
            env_uuid: result.env_uuid,
            success: result.success,
        })
    }
}

impl ToolBase for StopEnvironmentTool {
    type Parameter = EnvironmentIdentityInput;
    type Output = EnvironmentActionOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_stop_environment".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Stop a Simprint environment by UUID.".into())
    }
}

impl AsyncTool<McpServer> for StopEnvironmentTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        let result = service.bridge().stop_environment(&env_uuid).await?;
        Ok(EnvironmentActionOutput {
            env_uuid: result.env_uuid,
            success: result.success,
        })
    }
}

impl ToolBase for BatchStartEnvironmentsTool {
    type Parameter = BatchEnvironmentIdentityInput;
    type Output = BatchEnvironmentActionOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_batch_start_environments".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Start multiple Simprint environments by UUID.".into())
    }
}

impl AsyncTool<McpServer> for BatchStartEnvironmentsTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let env_uuids = require_env_uuids(param.env_uuids)?;
        let items = service
            .bridge()
            .batch_start_environments(env_uuids)
            .await?
            .into_iter()
            .map(map_batch_result)
            .collect();

        Ok(BatchEnvironmentActionOutput { items })
    }
}

impl ToolBase for BatchStopEnvironmentsTool {
    type Parameter = BatchEnvironmentIdentityInput;
    type Output = BatchEnvironmentActionOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_batch_stop_environments".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Stop multiple Simprint environments by UUID.".into())
    }
}

impl AsyncTool<McpServer> for BatchStopEnvironmentsTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let env_uuids = require_env_uuids(param.env_uuids)?;
        let items = service
            .bridge()
            .batch_stop_environments(env_uuids)
            .await?
            .into_iter()
            .map(map_batch_result)
            .collect();

        Ok(BatchEnvironmentActionOutput { items })
    }
}

impl ToolBase for GetEnvironmentStatusTool {
    type Parameter = EnvironmentIdentityInput;
    type Output = EnvironmentStatusOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_get_environment_status".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Get the runtime status of a Simprint environment.".into())
    }
}

impl AsyncTool<McpServer> for GetEnvironmentStatusTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        let status = service.bridge().get_environment_status(&env_uuid).await?;

        Ok(EnvironmentStatusOutput {
            env_uuid,
            running: matches!(status, Some(EnvironmentStatus::Running)),
            status: status.map(environment_status_to_string),
        })
    }
}

impl ToolBase for GetEnvironmentCdpEndpointTool {
    type Parameter = EnvironmentIdentityInput;
    type Output = EnvironmentCdpEndpointOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_get_environment_cdp_endpoint".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Get the CDP endpoint of a running Simprint environment.".into())
    }
}

impl AsyncTool<McpServer> for GetEnvironmentCdpEndpointTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let env_uuid = require_env_uuid(&param.env_uuid)?;
        let endpoint = service.bridge().get_environment_cdp_endpoint(&env_uuid).await?;

        Ok(EnvironmentCdpEndpointOutput {
            env_uuid,
            available: endpoint.is_some(),
            version_url: endpoint.as_ref().map(|item| item.version_url.clone()),
            list_url: endpoint.as_ref().map(|item| item.list_url.clone()),
            browser_ws_url: endpoint.and_then(|item| item.browser_ws_url),
        })
    }
}

fn map_environment_detail(
    detail: crate::local_api::entitys::LocalApiEnvironmentDetailResponse,
) -> EnvironmentSummary {
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

fn map_batch_result(result: BatchLaunchResult) -> BatchEnvironmentActionItem {
    BatchEnvironmentActionItem {
        env_uuid: result.env_uuid,
        success: result.success,
        error: result.error,
    }
}

fn environment_status_to_string(status: EnvironmentStatus) -> String {
    match status {
        EnvironmentStatus::Verifying => "verifying",
        EnvironmentStatus::Downloading => "downloading",
        EnvironmentStatus::Extracting => "extracting",
        EnvironmentStatus::Ready => "ready",
        EnvironmentStatus::Initializing => "initializing",
        EnvironmentStatus::Starting => "starting",
        EnvironmentStatus::Running => "running",
        EnvironmentStatus::Stopping => "stopping",
        EnvironmentStatus::Stopped => "stopped",
        EnvironmentStatus::Error => "error",
    }
    .to_string()
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
    let env_uuids = values
        .into_iter()
        .map(normalize_non_empty)
        .filter(|item| !item.is_empty())
        .collect::<Vec<_>>();

    if env_uuids.is_empty() {
        Err(McpToolError::invalid_params(
            "env_uuids must contain at least one item",
        ))
    } else {
        Ok(env_uuids)
    }
}

fn normalize_non_empty(value: String) -> String {
    value.trim().to_string()
}
