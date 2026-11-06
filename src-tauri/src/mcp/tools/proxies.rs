use std::borrow::Cow;

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    local_api::entitys::{LocalApiProxyDetail, LocalApiProxyItem},
    mcp::{
        bridge::{LocalApiListProxiesFilters, LocalApiListProxiesRequest},
        error::McpToolError,
        server::McpServer,
    },
};

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<ListProxiesTool>()
        .with_async_tool::<GetProxyTool>()
        .with_async_tool::<CreateProxyTool>()
        .with_async_tool::<UpdateProxyTool>()
        .with_async_tool::<DeleteProxyTool>()
        .with_async_tool::<BatchDeleteProxiesTool>()
        .into_iter()
        .collect()
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct ListProxiesInput {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub keyword: Option<String>,
    pub proxy_type: Option<String>,
    pub status: Option<String>,
    pub country: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct ProxyIdentityInput {
    pub proxy_uuid: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ListProxiesOutput {
    pub items: Vec<ProxySummary>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ProxySummary {
    pub uuid: String,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub proxy_type: String,
    pub username: Option<String>,
    pub country: Option<String>,
    pub city: Option<String>,
    pub status: String,
    pub latency: Option<i32>,
    pub last_checked_at: Option<String>,
    pub environments_count: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct CreateProxyInput {
    pub name: String,
    pub host: String,
    pub port: i32,
    pub proxy_type: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub country: Option<String>,
    pub city: Option<String>,
    pub ssh_key: Option<String>,
    pub ssh_passphrase: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct UpdateProxyInput {
    pub proxy_uuid: String,
    pub name: Option<String>,
    pub host: Option<String>,
    pub port: Option<i32>,
    pub proxy_type: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub country: Option<String>,
    pub city: Option<String>,
    pub ssh_key: Option<String>,
    pub ssh_passphrase: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct BatchProxyIdentityInput {
    pub proxy_uuids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ProxyMutationOutput {
    pub success: bool,
    pub uuid: Option<String>,
    pub uuids: Option<Vec<String>>,
    pub data: Option<Value>,
}

struct ListProxiesTool;
struct GetProxyTool;
struct CreateProxyTool;
struct UpdateProxyTool;
struct DeleteProxyTool;
struct BatchDeleteProxiesTool;

impl ToolBase for ListProxiesTool {
    type Parameter = ListProxiesInput;
    type Output = ListProxiesOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_list_proxies".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("List Simprint proxies with optional filters.".into())
    }
}

impl AsyncTool<McpServer> for ListProxiesTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let filters = if param.keyword.is_some()
            || param.proxy_type.is_some()
            || param.status.is_some()
            || param.country.is_some()
        {
            Some(LocalApiListProxiesFilters {
                keyword: param.keyword.map(normalize_non_empty),
                proxy_type: param.proxy_type.map(normalize_non_empty),
                status: param.status.map(normalize_non_empty),
                country: param.country.map(normalize_non_empty),
            })
        } else {
            None
        };

        let response = service
            .bridge()
            .list_proxies(LocalApiListProxiesRequest {
                page: param.page.unwrap_or(1),
                page_size: param.page_size.unwrap_or(20),
                filters,
            })
            .await?;

        Ok(ListProxiesOutput {
            items: response.items.into_iter().map(map_proxy).collect(),
            total: response.total,
            page: response.page,
            page_size: response.page_size,
        })
    }
}

impl ToolBase for GetProxyTool {
    type Parameter = ProxyIdentityInput;
    type Output = ProxySummary;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_get_proxy".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Get a Simprint proxy by UUID.".into())
    }
}

impl AsyncTool<McpServer> for GetProxyTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let proxy_uuid = require_proxy_uuid(&param.proxy_uuid)?;
        let detail = service.bridge().get_proxy(&proxy_uuid).await?;
        Ok(map_proxy_detail(detail))
    }
}

impl ToolBase for CreateProxyTool {
    type Parameter = CreateProxyInput;
    type Output = ProxyMutationOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_create_proxy".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Create a Simprint proxy.".into())
    }
}

impl AsyncTool<McpServer> for CreateProxyTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        validate_proxy_create(&param)?;
        let data = service
            .bridge()
            .create_proxy(&serde_json::json!({
                "name": param.name.trim(),
                "host": param.host.trim(),
                "port": param.port,
                "proxy_type": param.proxy_type.trim(),
                "username": normalize_optional(param.username),
                "password": normalize_optional(param.password),
                "country": normalize_optional(param.country),
                "city": normalize_optional(param.city),
                "ssh_key": normalize_optional(param.ssh_key),
                "ssh_passphrase": normalize_optional(param.ssh_passphrase),
            }))
            .await?;

        Ok(ProxyMutationOutput {
            success: true,
            uuid: extract_uuid(&data),
            uuids: None,
            data: Some(data),
        })
    }
}

impl ToolBase for UpdateProxyTool {
    type Parameter = UpdateProxyInput;
    type Output = ProxyMutationOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_update_proxy".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Update a Simprint proxy.".into())
    }
}

impl AsyncTool<McpServer> for UpdateProxyTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let proxy_uuid = require_proxy_uuid(&param.proxy_uuid)?;
        service
            .bridge()
            .update_proxy(&serde_json::json!({
                "uuid": proxy_uuid.clone(),
                "name": param.name.as_deref().map(str::trim).filter(|v| !v.is_empty()),
                "host": param.host.as_deref().map(str::trim).filter(|v| !v.is_empty()),
                "port": param.port,
                "proxy_type": param.proxy_type.as_deref().map(str::trim).filter(|v| !v.is_empty()),
                "username": normalize_optional(param.username),
                "password": normalize_optional(param.password),
                "country": normalize_optional(param.country),
                "city": normalize_optional(param.city),
                "ssh_key": normalize_optional(param.ssh_key),
                "ssh_passphrase": normalize_optional(param.ssh_passphrase),
            }))
            .await?;

        Ok(ProxyMutationOutput {
            success: true,
            uuid: Some(proxy_uuid),
            uuids: None,
            data: None,
        })
    }
}

impl ToolBase for DeleteProxyTool {
    type Parameter = ProxyIdentityInput;
    type Output = ProxyMutationOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_delete_proxy".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Delete a Simprint proxy by UUID.".into())
    }
}

impl AsyncTool<McpServer> for DeleteProxyTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let proxy_uuid = require_proxy_uuid(&param.proxy_uuid)?;
        service.bridge().delete_proxy(&proxy_uuid).await?;

        Ok(ProxyMutationOutput {
            success: true,
            uuid: Some(proxy_uuid),
            uuids: None,
            data: None,
        })
    }
}

impl ToolBase for BatchDeleteProxiesTool {
    type Parameter = BatchProxyIdentityInput;
    type Output = ProxyMutationOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_batch_delete_proxies".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Delete multiple Simprint proxies by UUID.".into())
    }
}

impl AsyncTool<McpServer> for BatchDeleteProxiesTool {
    async fn invoke(
        service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let proxy_uuids = require_proxy_uuids(param.proxy_uuids)?;
        service.bridge().batch_delete_proxies(proxy_uuids.clone()).await?;

        Ok(ProxyMutationOutput {
            success: true,
            uuid: None,
            uuids: Some(proxy_uuids),
            data: None,
        })
    }
}

fn map_proxy(proxy: LocalApiProxyItem) -> ProxySummary {
    ProxySummary {
        uuid: proxy.uuid,
        name: proxy.name,
        host: proxy.host,
        port: proxy.port,
        proxy_type: proxy.proxy_type,
        username: proxy.username,
        country: proxy.country,
        city: proxy.city,
        status: proxy.status,
        latency: proxy.latency,
        last_checked_at: proxy.last_checked_at,
        environments_count: proxy.environments_count,
    }
}

fn map_proxy_detail(proxy: LocalApiProxyDetail) -> ProxySummary {
    ProxySummary {
        uuid: proxy.uuid,
        name: proxy.name,
        host: proxy.host,
        port: proxy.port,
        proxy_type: proxy.proxy_type,
        username: proxy.username,
        country: proxy.country,
        city: proxy.city,
        status: proxy.status,
        latency: proxy.latency,
        last_checked_at: proxy.last_checked_at,
        environments_count: proxy.environments_count,
    }
}

fn require_proxy_uuid(value: &str) -> Result<String, McpToolError> {
    let proxy_uuid = value.trim();
    if proxy_uuid.is_empty() {
        Err(McpToolError::invalid_params("proxy_uuid is required"))
    } else {
        Ok(proxy_uuid.to_string())
    }
}

fn normalize_non_empty(value: String) -> String {
    value.trim().to_string()
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.map(|item| item.trim().to_string()).filter(|item| !item.is_empty())
}

fn require_proxy_uuids(values: Vec<String>) -> Result<Vec<String>, McpToolError> {
    let proxy_uuids = values
        .into_iter()
        .map(normalize_non_empty)
        .filter(|item| !item.is_empty())
        .collect::<Vec<_>>();

    if proxy_uuids.is_empty() {
        Err(McpToolError::invalid_params(
            "proxy_uuids must contain at least one item",
        ))
    } else {
        Ok(proxy_uuids)
    }
}

fn validate_proxy_create(param: &CreateProxyInput) -> Result<(), McpToolError> {
    if param.name.trim().is_empty() {
        return Err(McpToolError::invalid_params("name is required"));
    }
    if param.host.trim().is_empty() {
        return Err(McpToolError::invalid_params("host is required"));
    }
    if param.proxy_type.trim().is_empty() {
        return Err(McpToolError::invalid_params("proxy_type is required"));
    }
    if param.port <= 0 {
        return Err(McpToolError::invalid_params("port must be greater than 0"));
    }
    Ok(())
}

fn extract_uuid(value: &Value) -> Option<String> {
    value.get("uuid").and_then(Value::as_str).map(ToString::to_string)
}
