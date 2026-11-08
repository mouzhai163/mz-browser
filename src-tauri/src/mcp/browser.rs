use serde_json::Value;
use std::time::Duration;

use super::{cdp, cdp_act, error::McpToolError, server::McpServer};

/// Reads tabs (`page_id == None`) or one page snapshot from an authorized, running environment.
pub(crate) async fn read_page(
    service: &McpServer,
    env_uuid: &str,
    page_id: Option<&str>,
) -> Result<Value, McpToolError> {
    service.require_environment(env_uuid).await?;
    let _slot = service
        .config()
        .read_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| McpToolError::upstream("Browser read capacity reached; retry later"))?;
    if !service.config().access.page_tools_enabled {
        return Err(McpToolError::invalid_params("Page tools are disabled"));
    }
    let origins = &service.config().access.allowed_origins;
    if origins.is_empty() {
        return Err(McpToolError::invalid_params(
            "No site origins are allowed for page tools; add the sites in the MCP settings first",
        ));
    }
    let endpoint = service
        .bridge()
        .get_environment_cdp_endpoint(env_uuid)
        .await?
        .and_then(|endpoint| endpoint.browser_ws_url)
        .ok_or_else(|| McpToolError::invalid_params("Environment is not running"))?;
    let action = if page_id.is_some() { "snapshot" } else { "tabs" };
    let result = tokio::time::timeout(
        Duration::from_secs(20),
        cdp::read(&endpoint, origins, page_id),
    )
    .await
    .map_err(|_| McpToolError::upstream("Browser read timed out"))
    .and_then(|result| result);
    log::info!(
        "MCP browser read env={} action={} success={}",
        env_uuid,
        action,
        result.is_ok()
    );
    let data = result?;
    // Recheck session and authorization before releasing page content.
    service.require_environment(env_uuid).await?;
    Ok(data)
}

/// One page action of the "act" tier.
pub(crate) enum ActOp<'a> {
    Navigate { page_id: &'a str, url: &'a str },
    OpenTab { url: &'a str },
    Click { page_id: &'a str, node_id: &'a str },
    Type { page_id: &'a str, node_id: &'a str, text: &'a str, clear: bool, submit: bool },
    PressKey { page_id: &'a str, key: &'a str },
}

impl ActOp<'_> {
    fn name(&self) -> &'static str {
        match self {
            Self::Navigate { .. } => "navigate",
            Self::OpenTab { .. } => "open_tab",
            Self::Click { .. } => "click",
            Self::Type { .. } => "type",
            Self::PressKey { .. } => "press_key",
        }
    }
}

/// Runs a page action in an authorized, running environment on allowed sites only.
pub(crate) async fn act(
    service: &McpServer,
    env_uuid: &str,
    op: ActOp<'_>,
) -> Result<Value, McpToolError> {
    service.require_act().await?;
    service.require_environment(env_uuid).await?;
    let _slot = service
        .config()
        .read_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| McpToolError::upstream("Browser capacity reached; retry later"))?;
    let origins = &service.config().access.allowed_origins;
    let endpoint = service
        .bridge()
        .get_environment_cdp_endpoint(env_uuid)
        .await?
        .and_then(|endpoint| endpoint.browser_ws_url)
        .ok_or_else(|| McpToolError::invalid_params("Environment is not running"))?;
    let name = op.name();
    let run = async {
        let mut conn = cdp::CdpConnection::connect(&endpoint).await?;
        let result = match op {
            ActOp::Navigate { page_id, url } => {
                cdp_act::navigate(&mut conn, origins, page_id, url).await
            }
            ActOp::OpenTab { url } => cdp_act::open_tab(&mut conn, origins, url).await,
            ActOp::Click { page_id, node_id } => {
                cdp_act::click(&mut conn, origins, page_id, node_id).await
            }
            ActOp::Type { page_id, node_id, text, clear, submit } => {
                cdp_act::type_text(&mut conn, origins, page_id, node_id, text, clear, submit).await
            }
            ActOp::PressKey { page_id, key } => {
                cdp_act::press_key(&mut conn, origins, page_id, key).await
            }
        };
        conn.close().await;
        result
    };
    let result = tokio::time::timeout(Duration::from_secs(20), run)
        .await
        .map_err(|_| McpToolError::upstream("Browser action timed out"))
        .and_then(|result| result);
    // never log typed text or full URLs
    log::info!("MCP browser act env={} action={} success={}", env_uuid, name, result.is_ok());
    let data = result?;
    service.require_environment(env_uuid).await?;
    Ok(data)
}
