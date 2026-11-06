use serde_json::{Value, json};
use std::{path::PathBuf, process::Stdio, time::Duration};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use super::{error::McpToolError, server::McpServer};

const WORKER: &str = include_str!("../../../automation/browser-worker.mjs");

pub(super) async fn read_page(
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
    let node = PathBuf::from(
        std::env::var_os("SIMPRINT_AGENT_NODE")
            .ok_or_else(|| McpToolError::internal("Trusted Node runtime is not configured"))?,
    );
    if !node.is_absolute() || !node.is_file() {
        return Err(McpToolError::internal(
            "Trusted Node runtime is unavailable",
        ));
    }
    let endpoint = service
        .bridge()
        .get_environment_cdp_endpoint(env_uuid)
        .await?
        .and_then(|endpoint| endpoint.browser_ws_url)
        .ok_or_else(|| McpToolError::invalid_params("Environment is not running"))?;
    let request = json!({
        "endpoint": endpoint,
        "action": if page_id.is_some() { "snapshot" } else { "tabs" },
        "pageId": page_id,
        "allowedOrigins": service.config().access.allowed_origins,
    });
    let mut command = tokio::process::Command::new(node);
    command
        .args([
            "--max-old-space-size=128",
            "--input-type=module",
            "-e",
            WORKER,
            "--",
            "--stdio",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    // Do not inherit Node loader/preload options from the desktop environment.
    command.env_remove("NODE_OPTIONS").env_remove("NODE_PATH");
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    let mut child = command
        .spawn()
        .map_err(|_| McpToolError::internal("Cannot start browser read worker"))?;
    let operation = async {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| McpToolError::internal("Worker stdin unavailable"))?;
        stdin
            .write_all(
                &serde_json::to_vec(&request)
                    .map_err(|_| McpToolError::internal("Cannot encode read request"))?,
            )
            .await
            .map_err(|_| McpToolError::internal("Cannot send read request"))?;
        drop(stdin);
        let mut output = vec![];
        child
            .stdout
            .take()
            .ok_or_else(|| McpToolError::internal("Worker stdout unavailable"))?
            .take(262145)
            .read_to_end(&mut output)
            .await
            .map_err(|_| McpToolError::internal("Cannot read worker result"))?;
        if output.len() > 262144 {
            return Err(McpToolError::internal("Browser result exceeded size limit"));
        }
        let _ = child
            .wait()
            .await
            .map_err(|_| McpToolError::internal("Browser worker failed"))?;
        let result: Value = serde_json::from_slice(&output)
            .map_err(|_| McpToolError::internal("Invalid browser worker result"))?;
        if result.get("ok").and_then(Value::as_bool) != Some(true) {
            return Err(McpToolError::upstream(
                result.get("error").and_then(Value::as_str).unwrap_or("BROWSER_READ_FAILED"),
            ));
        }
        // Recheck session and authorization before releasing page content.
        service.require_environment(env_uuid).await?;
        Ok(result.get("data").cloned().unwrap_or(Value::Null))
    };
    let result = tokio::time::timeout(Duration::from_secs(20), operation).await;
    let _ = child.kill().await;
    let result = result.map_err(|_| McpToolError::upstream("Browser read timed out"))?;
    log::info!(
        "MCP browser read env={} action={} success={}",
        env_uuid,
        if page_id.is_some() {
            "snapshot"
        } else {
            "tabs"
        },
        result.is_ok()
    );
    result
}
