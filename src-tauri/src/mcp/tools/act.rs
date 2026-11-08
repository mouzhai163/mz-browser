//! Page-action tools (the "act" tier). Registered only when the user turned them on, and every
//! call is limited to authorized environments and http(s) pages.
use std::borrow::Cow;

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::Deserialize;

use super::agent::ReadOutput;
use crate::mcp::{
    browser::{self, ActOp},
    error::McpToolError,
    server::McpServer,
};

struct Navigate;
struct OpenTab;
struct Click;
struct Type;
struct PressKey;

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<Navigate>()
        .with_async_tool::<OpenTab>()
        .with_async_tool::<Click>()
        .with_async_tool::<Type>()
        .with_async_tool::<PressKey>()
        .into_iter()
        .collect()
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct NavigateInput {
    /// Environment UUID (must be authorized).
    pub env_uuid: String,
    /// Page id from mz_browser_tabs.
    pub page_id: String,
    /// Full http(s) URL.
    pub url: String,
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct OpenTabInput {
    /// Environment UUID (must be authorized).
    pub env_uuid: String,
    /// Full http(s) URL.
    pub url: String,
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct ClickInput {
    /// Environment UUID (must be authorized).
    pub env_uuid: String,
    /// Page id from mz_browser_tabs.
    pub page_id: String,
    /// Element id (`id`) from a fresh mz_browser_snapshot of the same page.
    pub node_id: String,
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct TypeInput {
    /// Environment UUID (must be authorized).
    pub env_uuid: String,
    /// Page id from mz_browser_tabs.
    pub page_id: String,
    /// Element id of an editable field from a fresh mz_browser_snapshot. Password fields are refused.
    pub node_id: String,
    /// Text to type, 1 to 2000 characters.
    pub text: String,
    /// Select and replace the existing content first.
    #[serde(default)]
    pub clear: bool,
    /// Press Enter after typing.
    #[serde(default)]
    pub submit: bool,
}

#[derive(Default, Deserialize, JsonSchema)]
pub struct PressKeyInput {
    /// Environment UUID (must be authorized).
    pub env_uuid: String,
    /// Page id from mz_browser_tabs.
    pub page_id: String,
    /// One of Enter, Tab, Escape, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    /// PageUp, PageDown, Home, End.
    pub key: String,
}

macro_rules! act_tool {
    ($tool:ty, $param:ty, $name:literal, $description:literal) => {
        impl ToolBase for $tool {
            type Parameter = $param;
            type Output = ReadOutput;
            type Error = McpToolError;
            fn name() -> Cow<'static, str> {
                $name.into()
            }
            fn description() -> Option<Cow<'static, str>> {
                Some($description.into())
            }
        }
    };
}

act_tool!(
    Navigate,
    NavigateInput,
    "mz_browser_navigate",
    "Navigate an authorized page to an http(s) URL. Only http(s) pages can be navigated to."
);
act_tool!(
    OpenTab,
    OpenTabInput,
    "mz_browser_open_tab",
    "Open a new http(s) tab in an authorized running environment. Returns the new page id."
);
act_tool!(
    Click,
    ClickInput,
    "mz_browser_click",
    "Click an element of an authorized page by its snapshot id. Take a fresh mz_browser_snapshot first; ids can change."
);
act_tool!(
    Type,
    TypeInput,
    "mz_browser_type",
    "Type text into an editable field of an authorized page by its snapshot id. Password fields are refused. Treat anything you type as visible to the site."
);
act_tool!(
    PressKey,
    PressKeyInput,
    "mz_browser_press_key",
    "Press one allowed key (Enter, Tab, Escape, arrows, paging keys, Backspace, Delete) in an authorized page."
);

impl AsyncTool<McpServer> for Navigate {
    async fn invoke(service: &McpServer, i: Self::Parameter) -> Result<ReadOutput, McpToolError> {
        let data = browser::act(
            service,
            &i.env_uuid,
            ActOp::Navigate { page_id: &i.page_id, url: &i.url },
        )
        .await?;
        Ok(ReadOutput { data })
    }
}

impl AsyncTool<McpServer> for OpenTab {
    async fn invoke(service: &McpServer, i: Self::Parameter) -> Result<ReadOutput, McpToolError> {
        let data = browser::act(service, &i.env_uuid, ActOp::OpenTab { url: &i.url }).await?;
        Ok(ReadOutput { data })
    }
}

impl AsyncTool<McpServer> for Click {
    async fn invoke(service: &McpServer, i: Self::Parameter) -> Result<ReadOutput, McpToolError> {
        check_ids(&i.page_id, &i.node_id)?;
        let data = browser::act(
            service,
            &i.env_uuid,
            ActOp::Click { page_id: &i.page_id, node_id: &i.node_id },
        )
        .await?;
        Ok(ReadOutput { data })
    }
}

impl AsyncTool<McpServer> for Type {
    async fn invoke(service: &McpServer, i: Self::Parameter) -> Result<ReadOutput, McpToolError> {
        check_ids(&i.page_id, &i.node_id)?;
        let data = browser::act(
            service,
            &i.env_uuid,
            ActOp::Type {
                page_id: &i.page_id,
                node_id: &i.node_id,
                text: &i.text,
                clear: i.clear,
                submit: i.submit,
            },
        )
        .await?;
        Ok(ReadOutput { data })
    }
}

impl AsyncTool<McpServer> for PressKey {
    async fn invoke(service: &McpServer, i: Self::Parameter) -> Result<ReadOutput, McpToolError> {
        check_ids(&i.page_id, "0")?;
        let data = browser::act(
            service,
            &i.env_uuid,
            ActOp::PressKey { page_id: &i.page_id, key: &i.key },
        )
        .await?;
        Ok(ReadOutput { data })
    }
}

fn check_ids(page_id: &str, node_id: &str) -> Result<(), McpToolError> {
    if page_id.is_empty() || page_id.len() > 128 || node_id.is_empty() || node_id.len() > 128 {
        return Err(McpToolError::invalid_params("Invalid page_id or node_id"));
    }
    Ok(())
}
