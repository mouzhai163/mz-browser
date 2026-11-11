//! RPA 的保存格式转换和运行都在前端（执行管理器），MCP 工具通过事件把请求转给主窗口，
//! 再由 `mcp_rpa_respond` 命令把结果带回来。
use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex},
    time::Duration,
};

use serde_json::{Value, json};
use tauri::Emitter;
use tokio::sync::oneshot;
use uuid::Uuid;

use crate::{app::handle::get_app_handle, mcp::error::McpToolError};

const REQUEST_EVENT: &str = "mcp-rpa-request";
const REPLY_TIMEOUT: Duration = Duration::from_secs(30);

type Reply = Result<Value, String>;

static PENDING: LazyLock<Mutex<HashMap<String, oneshot::Sender<Reply>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn take_pending(id: &str) -> Option<oneshot::Sender<Reply>> {
    PENDING.lock().ok()?.remove(id)
}

/// 把一个请求交给主窗口处理并等结果。
pub async fn call(action: &str, payload: Value) -> Result<Value, McpToolError> {
    let app = get_app_handle().map_err(|error| McpToolError::internal(error.to_string()))?;
    let id = Uuid::new_v4().to_string();
    let (sender, receiver) = oneshot::channel();
    PENDING
        .lock()
        .map_err(|_| McpToolError::internal("RPA bridge is unavailable"))?
        .insert(id.clone(), sender);

    let request = json!({ "id": id, "action": action, "payload": payload });
    if let Err(error) = app.emit_to("main", REQUEST_EVENT, request) {
        take_pending(&id);
        return Err(McpToolError::internal(error.to_string()));
    }

    match tokio::time::timeout(REPLY_TIMEOUT, receiver).await {
        Ok(Ok(Ok(value))) => Ok(value),
        Ok(Ok(Err(message))) => Err(McpToolError::invalid_params(message)),
        Ok(Err(_)) => Err(McpToolError::internal("RPA bridge closed")),
        Err(_) => {
            take_pending(&id);
            Err(McpToolError::upstream("The application window did not respond"))
        }
    }
}

/// 主窗口的回复。请求已超时的回复直接丢弃。
pub fn respond(id: &str, reply: Reply) {
    if let Some(sender) = take_pending(id) {
        let _ = sender.send(reply);
    }
}
