//! Minimal CDP client used by the MCP page tools.
//!
//! Replaces the former Node worker (`automation/browser-worker.mjs`), so page tools work in an
//! installed build without any extra runtime. The rules are the same as before:
//! * only `ws://127.0.0.1:<kernel CDP port>/devtools/browser/<id>` endpoints are accepted,
//!   optionally carrying the kernel's `mz_token` access token;
//! * only pages (and every frame inside them) whose origin is explicitly allowed are touched;
//! * the connection is only ever detached, never `Browser.close` / `Target.closeTarget`.

use std::collections::{HashMap, HashSet};
use std::time::Duration;

use futures::{SinkExt, StreamExt};
use serde_json::{Value, json};
use tokio::net::TcpStream;
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async_with_config,
    tungstenite::{Message, protocol::WebSocketConfig},
};

use super::error::McpToolError;

/// The kernel CDP port range (see `runtime::...::kernel::cdp`).
const CDP_PORT_START: u16 = 29200;
const CDP_PORT_END: u16 = 29499;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const COMMAND_TIMEOUT: Duration = Duration::from_secs(5);
const INPUT_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_MESSAGE_BYTES: usize = 16 * 1024 * 1024;
pub const MAX_SNAPSHOT_NODES: usize = 400;
const MAX_TABS: usize = 100;

/// Stable error codes; they are returned to the AI client as-is.
pub mod code {
    pub const INVALID_ENDPOINT: &str = "INVALID_CDP_ENDPOINT";
    pub const CONNECTION_FAILED: &str = "CDP_CONNECTION_FAILED";
    pub const CONNECTION_TIMEOUT: &str = "CDP_CONNECTION_TIMEOUT";
    pub const CONNECTION_CLOSED: &str = "CDP_CONNECTION_CLOSED";
    pub const COMMAND_FAILED: &str = "CDP_COMMAND_FAILED";
    pub const COMMAND_TIMEOUT: &str = "CDP_COMMAND_TIMEOUT";
    pub const SEND_FAILED: &str = "CDP_SEND_FAILED";
    pub const FRAME_NOT_AUTHORIZED: &str = "FRAME_ORIGIN_NOT_AUTHORIZED";
    pub const PAGE_NOT_AUTHORIZED: &str = "PAGE_NOT_AUTHORIZED";
    pub const PAGE_CHANGED: &str = "PAGE_CHANGED_RETRY";
}

fn err(code: &str) -> McpToolError {
    McpToolError::upstream(code)
}

fn is_debug_token_query(query: &str) -> bool {
    query
        .strip_prefix("mz_token=")
        .is_some_and(|token| !token.is_empty() && token.chars().all(|c| c.is_ascii_hexdigit()))
}

/// Accepts only the browser-level websocket of a local kernel.
pub fn validate_endpoint(value: &str) -> Result<reqwest::Url, McpToolError> {
    let url = reqwest::Url::parse(value).map_err(|_| err(code::INVALID_ENDPOINT))?;
    let port_ok = matches!(url.port(), Some(port) if (CDP_PORT_START..=CDP_PORT_END).contains(&port));
    let path_ok = url
        .path()
        .strip_prefix("/devtools/browser/")
        .is_some_and(|id| !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'));
    if url.scheme() != "ws"
        || url.host_str() != Some("127.0.0.1")
        || !port_ok
        || !url.username().is_empty()
        || url.password().is_some()
        || !url.query().is_none_or(is_debug_token_query)
        || url.fragment().is_some()
        || !path_ok
    {
        return Err(err(code::INVALID_ENDPOINT));
    }
    Ok(url)
}

/// `true` when `value` is a plain http(s) URL without credentials (so never `file:`, `chrome:`,
/// `devtools:`, extension or `about:` pages). A non-empty `origins` list narrows that further to
/// exactly those origins; the app passes an empty list, i.e. any web page.
pub fn authorized_url(value: &str, origins: &[String]) -> bool {
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };
    matches!(url.scheme(), "http" | "https")
        && url.username().is_empty()
        && url.password().is_none()
        && (origins.is_empty() || origins.iter().any(|origin| *origin == url.origin().ascii_serialization()))
}

/// Origin + path only (no query or fragment, which often carry tokens).
pub fn public_url(value: &str) -> String {
    match reqwest::Url::parse(value) {
        Ok(url) => truncate(&format!("{}{}", url.origin().ascii_serialization(), url.path()), 2048),
        Err(_) => String::new(),
    }
}

pub(super) fn truncate(value: &str, max: usize) -> String {
    value.chars().take(max).collect()
}

fn truthy(value: Option<&Value>) -> bool {
    match value {
        Some(Value::Bool(b)) => *b,
        Some(Value::Null) | None => false,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|n| n != 0.0),
        Some(Value::String(s)) => !s.is_empty(),
        Some(_) => true,
    }
}

fn node_id(node: &Value) -> Option<String> {
    match node.get("nodeId") {
        Some(Value::String(s)) => Some(s.clone()),
        Some(Value::Number(n)) => Some(n.to_string()),
        _ => None,
    }
}

fn child_ids(node: &Value) -> Vec<String> {
    node.get("childIds")
        .and_then(Value::as_array)
        .map(|ids| {
            ids.iter()
                .filter_map(|id| match id {
                    Value::String(s) => Some(s.clone()),
                    Value::Number(n) => Some(n.to_string()),
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default()
}

fn has_property(node: &Value, name: &str) -> bool {
    node.get("properties")
        .and_then(Value::as_array)
        .is_some_and(|props| {
            props.iter().any(|p| {
                p.get("name").and_then(Value::as_str) == Some(name)
                    && truthy(p.get("value").and_then(|v| v.get("value")))
            })
        })
}

fn is_editable(node: &Value) -> bool {
    let role = node
        .get("role")
        .and_then(|r| r.get("value"))
        .and_then(Value::as_str)
        .unwrap_or("");
    ["textbox", "searchbox", "combobox", "spinbutton"].contains(&role) || has_property(node, "editable")
}

/// Ids of nodes that must never be exposed or acted on: password ("protected") nodes and
/// everything below them, and the children of editable fields (which carry the typed value).
pub(super) fn blocked_ids(nodes: &[Value], secrets: &HashSet<u64>) -> HashSet<String> {
    let by_id: HashMap<String, &Value> =
        nodes.iter().filter_map(|n| node_id(n).map(|id| (id, n))).collect();
    let mut queue: Vec<String> = nodes
        .iter()
        .filter(|n| is_secret_node(n, secrets))
        .filter_map(node_id)
        .collect();
    for node in nodes.iter().filter(|n| is_editable(n)) {
        queue.extend(child_ids(node));
    }
    let mut blocked: HashSet<String> = HashSet::new();
    while let Some(id) = queue.pop() {
        if !blocked.insert(id.clone()) {
            continue;
        }
        if let Some(node) = by_id.get(&id) {
            queue.extend(child_ids(node));
        }
    }
    blocked
}

/// The accessibility tree of the DevTools protocol does not report a `protected` property for
/// password fields, so secrets are found in the DOM (see [`secret_backend_ids`]) and matched here
/// by `backendDOMNodeId`; the property check stays as a second signal.
pub(super) fn is_secret_node(node: &Value, secrets: &HashSet<u64>) -> bool {
    has_property(node, "protected")
        || node
            .get("backendDOMNodeId")
            .and_then(Value::as_u64)
            .is_some_and(|id| secrets.contains(&id))
}

const SECRET_AUTOCOMPLETE: [&str; 6] =
    ["current-password", "new-password", "one-time-code", "cc-number", "cc-csc", "cc-exp"];
const MAX_DOM_NODES: usize = 400_000;

fn collect_secret_inputs(root: &Value, out: &mut HashSet<u64>) {
    let mut stack = vec![root];
    let mut seen = 0usize;
    while let Some(node) = stack.pop() {
        seen += 1;
        if seen > MAX_DOM_NODES {
            break;
        }
        if node.get("nodeName").and_then(Value::as_str).is_some_and(|n| n.eq_ignore_ascii_case("input")) {
            let attrs = node.get("attributes").and_then(Value::as_array);
            let attr = |wanted: &str| -> Option<String> {
                let attrs = attrs?;
                attrs
                    .chunks(2)
                    .find(|pair| pair.first().and_then(Value::as_str).is_some_and(|n| n.eq_ignore_ascii_case(wanted)))
                    .and_then(|pair| pair.get(1))
                    .and_then(Value::as_str)
                    .map(|v| v.to_ascii_lowercase())
            };
            let secret_type = attr("type").is_some_and(|t| t.trim() == "password");
            let secret_hint = attr("autocomplete")
                .is_some_and(|a| a.split_whitespace().any(|token| SECRET_AUTOCOMPLETE.contains(&token)));
            if secret_type || secret_hint {
                if let Some(id) = node.get("backendNodeId").and_then(Value::as_u64) {
                    out.insert(id);
                }
            }
        }
        for key in ["children", "shadowRoots"] {
            if let Some(items) = node.get(key).and_then(Value::as_array) {
                stack.extend(items.iter());
            }
        }
        for key in ["contentDocument", "templateContent"] {
            if let Some(child) = node.get(key) {
                stack.push(child);
            }
        }
    }
}

/// `backendNodeId`s of password inputs and inputs that hint at a secret (one-time codes, card
/// data), including those inside iframes and shadow roots. Fails closed: if the DOM cannot be
/// read, the caller must not continue.
pub(super) async fn secret_backend_ids(
    conn: &mut CdpConnection,
    session: &str,
) -> Result<HashSet<u64>, McpToolError> {
    let document = conn
        .send("DOM.getDocument", json!({ "depth": -1, "pierce": true }), Some(session))
        .await?;
    let root = document.get("root").ok_or_else(|| err(code::COMMAND_FAILED))?;
    let mut out = HashSet::new();
    collect_secret_inputs(root, &mut out);
    Ok(out)
}

pub(super) fn node_is_editable(node: &Value) -> bool {
    is_editable(node)
}

pub(super) fn node_ident(node: &Value) -> Option<String> {
    node_id(node)
}

/// Reduces a full accessibility tree to a bounded, privacy-reduced outline: editable-field
/// values are replaced and password ("protected") nodes with all their descendants are dropped.
pub fn summarize_nodes(nodes: &[Value]) -> Vec<Value> {
    summarize_nodes_with(nodes, false, &HashSet::new())
}

/// With `full` the outline keeps field names, shows the AX `value` of fields (for a password
/// field that is what the browser exposes, usually bullets; use the field-read tool for the
/// real text) and marks password fields with `"protected": true` instead of dropping them.
pub fn summarize_nodes_with(nodes: &[Value], full: bool, secrets: &HashSet<u64>) -> Vec<Value> {
    let blocked = if full { HashSet::new() } else { blocked_ids(nodes, secrets) };
    nodes
        .iter()
        .filter(|n| !truthy(n.get("ignored")) && node_id(n).is_some_and(|id| !blocked.contains(&id)))
        .take(MAX_SNAPSHOT_NODES)
        .map(|node| {
            let id = node_id(node).unwrap_or_default();
            let role = node
                .get("role")
                .and_then(|r| r.get("value"))
                .and_then(Value::as_str)
                .unwrap_or("");
            let name = if is_editable(node) && !full {
                "[editable field]".to_string()
            } else {
                truncate(
                    node.get("name").and_then(|n| n.get("value")).and_then(Value::as_str).unwrap_or(""),
                    300,
                )
            };
            let children: Vec<String> = child_ids(node)
                .into_iter()
                .filter(|c| !blocked.contains(c))
                .take(20)
                .map(|c| truncate(&c, 100))
                .collect();
            let mut entry = json!({ "id": truncate(&id, 100), "role": truncate(role, 100), "name": name, "children": children });
            if full {
                if let Some(value) = node.get("value").and_then(|v| v.get("value")).and_then(Value::as_str) {
                    entry["value"] = json!(truncate(value, 1000));
                }
                if is_secret_node(node, secrets) {
                    entry["protected"] = json!(true);
                }
            }
            entry
        })
        .collect()
}

type Socket = WebSocketStream<MaybeTlsStream<TcpStream>>;

/// One short-lived browser-level CDP connection. Requests are strictly sequential.
pub struct CdpConnection {
    socket: Socket,
    next_id: u64,
    /// Sessions that saw a navigation/detach event while we were reading.
    changed_sessions: HashSet<String>,
    /// Highest tier: do not hide input/password content.
    full_access: bool,
}

impl CdpConnection {
    pub async fn connect(endpoint: &str) -> Result<Self, McpToolError> {
        let url = validate_endpoint(endpoint)?;
        Self::connect_validated(url.as_str()).await
    }

    /// Skips the endpoint policy; only for tests against an ephemeral local server.
    pub(crate) async fn connect_validated(url: &str) -> Result<Self, McpToolError> {
        let config = WebSocketConfig::default()
            .max_message_size(Some(MAX_MESSAGE_BYTES))
            .max_frame_size(Some(MAX_MESSAGE_BYTES));
        let (socket, _) = tokio::time::timeout(
            CONNECT_TIMEOUT,
            connect_async_with_config(url, Some(config), false),
        )
        .await
        .map_err(|_| err(code::CONNECTION_TIMEOUT))?
        .map_err(|_| err(code::CONNECTION_FAILED))?;
        Ok(Self { socket, next_id: 1, changed_sessions: HashSet::new(), full_access: false })
    }

    pub fn with_full_access(mut self, on: bool) -> Self {
        self.full_access = on;
        self
    }

    pub fn full_access(&self) -> bool {
        self.full_access
    }

    pub fn session_changed(&self, session_id: &str) -> bool {
        self.changed_sessions.contains(session_id)
    }

    pub async fn send(
        &mut self,
        method: &str,
        params: Value,
        session_id: Option<&str>,
    ) -> Result<Value, McpToolError> {
        let id = self.next_id;
        self.next_id += 1;
        let mut message = json!({ "id": id, "method": method, "params": params });
        if let Some(session_id) = session_id {
            message["sessionId"] = json!(session_id);
        }
        self.socket
            .send(Message::text(message.to_string()))
            .await
            .map_err(|_| err(code::SEND_FAILED))?;
        let wait = async {
            while let Some(frame) = self.socket.next().await {
                let frame = frame.map_err(|_| err(code::CONNECTION_CLOSED))?;
                let Message::Text(text) = frame else {
                    if matches!(frame, Message::Close(_)) {
                        return Err(err(code::CONNECTION_CLOSED));
                    }
                    continue;
                };
                let Ok(value) = serde_json::from_str::<Value>(&text) else {
                    continue; // ignore malformed, non-protocol messages
                };
                match value.get("id").and_then(Value::as_u64) {
                    Some(reply) if reply == id => {
                        return if value.get("error").is_some() {
                            Err(err(code::COMMAND_FAILED))
                        } else {
                            Ok(value.get("result").cloned().unwrap_or(Value::Null))
                        };
                    }
                    Some(_) => {} // stale reply of an earlier timed-out request
                    None => {
                        let method = value.get("method").and_then(Value::as_str).unwrap_or("");
                        if let ("Page.frameNavigated" | "Page.frameDetached", Some(session)) =
                            (method, value.get("sessionId").and_then(Value::as_str))
                        {
                            self.changed_sessions.insert(session.to_string());
                        }
                    }
                }
            }
            Err(err(code::CONNECTION_CLOSED))
        };
        let method_name = method.to_string();
        // input events are acknowledged by the page itself, so a busy page needs more time
        let limit = if method.starts_with("Input.") { INPUT_TIMEOUT } else { COMMAND_TIMEOUT };
        tokio::time::timeout(limit, wait)
            .await
            .map_err(|_| McpToolError::upstream(format!("{}: {method_name}", code::COMMAND_TIMEOUT)))?
    }

    /// Detach only; never closes the browser or a target.
    pub async fn close(mut self) {
        let _ = self.socket.close(None).await;
    }
}

pub(super) struct PageInfo {
    pub(super) target_id: String,
    pub(super) title: String,
    pub(super) url: String,
}

pub(super) async fn authorized_pages(
    conn: &mut CdpConnection,
    origins: &[String],
) -> Result<Vec<PageInfo>, McpToolError> {
    let result = conn.send("Target.getTargets", json!({}), None).await?;
    let infos = result.get("targetInfos").and_then(Value::as_array).cloned().unwrap_or_default();
    Ok(infos
        .iter()
        .filter(|t| t.get("type").and_then(Value::as_str) == Some("page"))
        .filter_map(|t| {
            let url = t.get("url").and_then(Value::as_str)?;
            if !authorized_url(url, origins) {
                return None;
            }
            Some(PageInfo {
                target_id: t.get("targetId").and_then(Value::as_str)?.to_string(),
                title: t.get("title").and_then(Value::as_str).unwrap_or("").to_string(),
                url: url.to_string(),
            })
        })
        .collect())
}

/// Every frame in the tree must be a plain web page (and match the optional site list).
pub(super) fn assert_frames(tree: &Value, origins: &[String]) -> Result<(), McpToolError> {
    let url = tree
        .get("frame")
        .and_then(|f| f.get("url"))
        .and_then(Value::as_str)
        .unwrap_or("");
    if !authorized_url(url, origins) {
        return Err(err(code::FRAME_NOT_AUTHORIZED));
    }
    for child in tree.get("childFrames").and_then(Value::as_array).into_iter().flatten() {
        assert_frames(child, origins)?;
    }
    Ok(())
}

pub async fn list_tabs(conn: &mut CdpConnection, origins: &[String]) -> Result<Value, McpToolError> {
    let pages = authorized_pages(conn, origins).await?;
    Ok(json!({
        "pages": pages.iter().take(MAX_TABS).map(|p| json!({
            "pageId": p.target_id,
            "title": truncate(&p.title, 256),
            "url": public_url(&p.url),
        })).collect::<Vec<_>>()
    }))
}

pub async fn snapshot(
    conn: &mut CdpConnection,
    origins: &[String],
    page_id: &str,
) -> Result<Value, McpToolError> {
    let pages = authorized_pages(conn, origins).await?;
    let page = pages
        .iter()
        .find(|p| p.target_id == page_id)
        .ok_or_else(|| err(code::PAGE_NOT_AUTHORIZED))?;
    let attached = conn
        .send("Target.attachToTarget", json!({ "targetId": page.target_id, "flatten": true }), None)
        .await?;
    let session = attached
        .get("sessionId")
        .and_then(Value::as_str)
        .ok_or_else(|| err(code::COMMAND_FAILED))?
        .to_string();
    conn.send("Page.enable", json!({}), Some(&session)).await?;
    let tree = conn.send("Page.getFrameTree", json!({}), Some(&session)).await?;
    assert_frames(tree.get("frameTree").unwrap_or(&Value::Null), origins)?;
    let secrets = secret_backend_ids(conn, &session).await?;
    let ax = conn
        .send("Accessibility.getFullAXTree", json!({ "depth": 8 }), Some(&session))
        .await?;
    let final_info = conn
        .send("Target.getTargetInfo", json!({ "targetId": page.target_id }), None)
        .await?;
    let tree = conn.send("Page.getFrameTree", json!({}), Some(&session)).await?;
    assert_frames(tree.get("frameTree").unwrap_or(&Value::Null), origins)?;
    let final_url = final_info
        .get("targetInfo")
        .and_then(|t| t.get("url"))
        .and_then(Value::as_str)
        .unwrap_or("");
    if conn.session_changed(&session) || !authorized_url(final_url, origins) || final_url != page.url {
        return Err(err(code::PAGE_CHANGED));
    }
    let nodes = ax.get("nodes").and_then(Value::as_array).cloned().unwrap_or_default();
    Ok(json!({
        "pageId": page.target_id,
        "url": public_url(final_url),
        "nodes": summarize_nodes_with(&nodes, conn.full_access, &secrets),
        "truncated": nodes.len() > MAX_SNAPSHOT_NODES,
    }))
}

/// Connects, runs `tabs` (when `page_id` is `None`) or `snapshot`, then detaches.
pub async fn read(
    endpoint: &str,
    origins: &[String],
    page_id: Option<&str>,
    full_access: bool,
) -> Result<Value, McpToolError> {
    let mut conn = CdpConnection::connect(endpoint).await?.with_full_access(full_access);
    let result = match page_id {
        None => list_tabs(&mut conn, origins).await,
        Some(page_id) => snapshot(&mut conn, origins, page_id).await,
    };
    conn.close().await;
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;
    use tokio_tungstenite::accept_async;

    fn origins() -> Vec<String> {
        vec!["https://example.com".into()]
    }

    #[test]
    fn endpoint_policy_only_allows_local_kernel_browser_sockets() {
        assert!(validate_endpoint("ws://127.0.0.1:29200/devtools/browser/abc-123").is_ok());
        assert!(validate_endpoint("ws://127.0.0.1:29200/devtools/browser/abc?mz_token=ab12").is_ok());
        for bad in [
            "ws://localhost:29200/devtools/browser/abc",
            "ws://127.0.0.1:29199/devtools/browser/abc",
            "ws://127.0.0.1:29500/devtools/browser/abc",
            "ws://127.0.0.1/devtools/browser/abc",
            "wss://127.0.0.1:29200/devtools/browser/abc",
            "ws://user@127.0.0.1:29200/devtools/browser/abc",
            "ws://127.0.0.1:29200/devtools/page/abc",
            "ws://127.0.0.1:29200/devtools/browser/",
            "ws://127.0.0.1:29200/devtools/browser/abc?x=1",
            "ws://127.0.0.1:29200/devtools/browser/abc?mz_token=",
            "ws://127.0.0.1:29200/devtools/browser/abc?mz_token=ab&x=1",
            "ws://127.0.0.1:29200/devtools/browser/a/b",
        ] {
            assert!(validate_endpoint(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn without_a_site_list_only_plain_web_pages_are_in_scope() {
        let any: Vec<String> = vec![];
        assert!(authorized_url("https://mail.example.com/inbox?x=1", &any));
        assert!(authorized_url("http://127.0.0.1:3000/", &any));
        for bad in [
            "file:///c:/windows/win.ini",
            "chrome://settings/",
            "devtools://devtools/bundled/inspector.html",
            "chrome-extension://abc/page.html",
            "about:blank",
            "javascript:alert(1)",
            "data:text/html,hi",
            "https://user:pw@example.com/",
        ] {
            assert!(!authorized_url(bad, &any), "{bad}");
        }
    }

    #[test]
    fn url_policy_is_exact_origin_without_credentials() {
        let o = origins();
        assert!(authorized_url("https://example.com/a?b=1", &o));
        assert!(!authorized_url("http://example.com/", &o));
        assert!(!authorized_url("https://example.com.evil.net/", &o));
        assert!(!authorized_url("https://user:pw@example.com/", &o));
        assert!(!authorized_url("file:///c:/x", &o));
        assert!(!authorized_url("not a url", &o));
        assert_eq!(public_url("https://example.com/a/b?token=1#x"), "https://example.com/a/b");
    }

    #[test]
    fn snapshot_hides_editable_values_and_password_subtrees() {
        let nodes = vec![
            json!({"nodeId":"1","role":{"value":"WebArea"},"name":{"value":"Login"},"childIds":["2","3","5"]}),
            json!({"nodeId":"2","role":{"value":"textbox"},"name":{"value":"alice@example.com"},"childIds":["4"]}),
            json!({"nodeId":"3","role":{"value":"textbox"},"name":{"value":"secret"},
                   "properties":[{"name":"protected","value":{"value":true}}],"childIds":[]}),
            json!({"nodeId":"4","role":{"value":"StaticText"},"name":{"value":"typed-value"}}),
            json!({"nodeId":"5","role":{"value":"button"},"name":{"value":"Sign in"},"ignored":false}),
            json!({"nodeId":"6","role":{"value":"none"},"name":{"value":"hidden"},"ignored":true}),
        ];
        let out = summarize_nodes(&nodes);
        let text = serde_json::to_string(&out).unwrap();
        assert!(!text.contains("alice@example.com") && !text.contains("secret"));
        assert!(!text.contains("typed-value") && !text.contains("hidden"));
        assert!(text.contains("[editable field]") && text.contains("Sign in"));
        // the password node and the editable field's child are not offered as children either
        assert_eq!(out[0]["children"], json!(["2", "5"]));
        // the password node itself is removed entirely
        assert!(out.iter().all(|n| n["id"] != "3"));
    }

    #[test]
    fn full_access_snapshot_shows_fields_and_marks_passwords() {
        let nodes = vec![
            json!({"nodeId":"1","role":{"value":"WebArea"},"name":{"value":"Login"},"childIds":["2","3"]}),
            json!({"nodeId":"2","role":{"value":"textbox"},"name":{"value":"Email"},"backendDOMNodeId":22,
                   "value":{"value":"alice@example.com"},"childIds":[]}),
            json!({"nodeId":"3","role":{"value":"textbox"},"name":{"value":"Password"},"backendDOMNodeId":23,
                   "childIds":[]}),
        ];
        let secrets: HashSet<u64> = [23].into_iter().collect();
        let out = summarize_nodes_with(&nodes, true, &secrets);
        assert_eq!(out.len(), 3);
        assert_eq!(out[1]["name"], "Email");
        assert_eq!(out[1]["value"], "alice@example.com");
        assert!(out[1].get("protected").is_none());
        assert_eq!(out[2]["protected"], true);
        assert_eq!(out[0]["children"], json!(["2", "3"]));
        // the default view of the same tree hides the fields, and the password node entirely
        let hidden = summarize_nodes_with(&nodes, false, &secrets);
        let text = serde_json::to_string(&hidden).unwrap();
        assert!(!text.contains("alice@example.com") && !text.contains("Password") && !text.contains("Email"));
        assert!(hidden.iter().all(|n| n["id"] != "3"));
    }

    #[test]
    fn secrets_are_found_in_the_dom_including_frames_and_shadow_roots() {
        let root = json!({"nodeName":"#document","backendNodeId":1,"children":[
            {"nodeName":"HTML","backendNodeId":2,"children":[
                {"nodeName":"INPUT","backendNodeId":10,"attributes":["type","text","name","q"]},
                {"nodeName":"input","backendNodeId":11,"attributes":["TYPE"," Password "]},
                {"nodeName":"INPUT","backendNodeId":12,"attributes":["type","text","autocomplete","section-x new-password"]},
                {"nodeName":"INPUT","backendNodeId":13,"attributes":["autocomplete","one-time-code"]},
                {"nodeName":"INPUT","backendNodeId":14,"attributes":["autocomplete","email"]},
                {"nodeName":"IFRAME","backendNodeId":15,"contentDocument":{"nodeName":"#document","backendNodeId":16,
                    "children":[{"nodeName":"INPUT","backendNodeId":17,"attributes":["type","password"]}]}},
                {"nodeName":"DIV","backendNodeId":18,"shadowRoots":[{"nodeName":"#document-fragment","backendNodeId":19,
                    "children":[{"nodeName":"INPUT","backendNodeId":20,"attributes":["type","password"]}]}]},
                {"nodeName":"TEXTAREA","backendNodeId":21,"attributes":["type","password"]}
            ]}]});
        let mut found = HashSet::new();
        collect_secret_inputs(&root, &mut found);
        let mut ids: Vec<u64> = found.into_iter().collect();
        ids.sort();
        assert_eq!(ids, vec![11, 12, 13, 17, 20]);
    }

    #[test]
    fn secret_nodes_and_their_subtree_are_blocked_without_any_protected_property() {
        // real accessibility trees never carry a `protected` property; the DOM tells us instead
        let nodes = vec![
            json!({"nodeId":"1","role":{"value":"WebArea"},"childIds":["2"]}),
            json!({"nodeId":"2","role":{"value":"textbox"},"backendDOMNodeId":42,"childIds":["3"]}),
            json!({"nodeId":"3","role":{"value":"generic"},"name":{"value":"bullets"},"childIds":[]}),
        ];
        let secrets: HashSet<u64> = [42].into_iter().collect();
        let blocked = blocked_ids(&nodes, &secrets);
        assert!(blocked.contains("2") && blocked.contains("3") && !blocked.contains("1"));
    }

    #[test]
    fn snapshot_is_bounded() {
        let nodes: Vec<Value> = (0..500)
            .map(|i| json!({"nodeId": i.to_string(), "role": {"value": "x"}, "name": {"value": "n".repeat(900)}}))
            .collect();
        let out = summarize_nodes(&nodes);
        assert_eq!(out.len(), MAX_SNAPSHOT_NODES);
        assert_eq!(out[0]["name"].as_str().unwrap().chars().count(), 300);
    }

    /// A scripted fake kernel: answers every request by `method` from `replies`.
    async fn fake_kernel(replies: Vec<(&'static str, Value)>) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut ws = accept_async(stream).await.unwrap();
            while let Some(Ok(Message::Text(text))) = ws.next().await {
                let request: Value = serde_json::from_str(&text).unwrap();
                let method = request["method"].as_str().unwrap().to_string();
                // an unrelated event first, to prove events do not confuse reply matching
                let _ = ws
                    .send(Message::text(json!({"method":"Other.event","params":{}}).to_string()))
                    .await;
                let result = replies
                    .iter()
                    .find(|(m, _)| *m == method)
                    .map(|(_, r)| r.clone())
                    .unwrap_or_else(|| json!({}));
                let _ = ws
                    .send(Message::text(json!({"id": request["id"], "result": result}).to_string()))
                    .await;
            }
        });
        format!("ws://127.0.0.1:{port}/devtools/browser/test")
    }

    #[tokio::test]
    async fn tabs_only_lists_authorized_pages_and_strips_queries() {
        let url = fake_kernel(vec![(
            "Target.getTargets",
            json!({"targetInfos":[
                {"targetId":"A","type":"page","title":"ok","url":"https://example.com/p?token=1"},
                {"targetId":"B","type":"page","title":"other","url":"https://evil.example/"},
                {"targetId":"C","type":"service_worker","title":"sw","url":"https://example.com/sw.js"},
            ]}),
        )])
        .await;
        let mut conn = CdpConnection::connect_validated(&url).await.unwrap();
        let tabs = list_tabs(&mut conn, &origins()).await.unwrap();
        assert_eq!(tabs["pages"].as_array().unwrap().len(), 1);
        assert_eq!(tabs["pages"][0]["pageId"], "A");
        assert_eq!(tabs["pages"][0]["url"], "https://example.com/p");
    }

    #[tokio::test]
    async fn snapshot_refuses_unauthorized_pages_and_foreign_frames() {
        let targets = json!({"targetInfos":[
            {"targetId":"A","type":"page","title":"ok","url":"https://example.com/"}]});
        let url = fake_kernel(vec![("Target.getTargets", targets.clone())]).await;
        let mut conn = CdpConnection::connect_validated(&url).await.unwrap();
        let denied = snapshot(&mut conn, &origins(), "NOPE").await;
        assert!(matches!(denied, Err(McpToolError::Upstream(m)) if m == code::PAGE_NOT_AUTHORIZED));

        let url = fake_kernel(vec![
            ("Target.getTargets", targets),
            ("Target.attachToTarget", json!({"sessionId":"S"})),
            ("DOM.getDocument", json!({"root":{"nodeName":"#document","backendNodeId":1,"children":[]}})),
            (
                "Page.getFrameTree",
                json!({"frameTree":{"frame":{"url":"https://example.com/"},
                       "childFrames":[{"frame":{"url":"https://ads.evil.example/"}}]}}),
            ),
        ])
        .await;
        let mut conn = CdpConnection::connect_validated(&url).await.unwrap();
        let denied = snapshot(&mut conn, &origins(), "A").await;
        assert!(matches!(denied, Err(McpToolError::Upstream(m)) if m == code::FRAME_NOT_AUTHORIZED));
    }

    #[tokio::test]
    async fn snapshot_returns_outline_when_page_is_stable() {
        let url = fake_kernel(vec![
            (
                "Target.getTargets",
                json!({"targetInfos":[{"targetId":"A","type":"page","title":"t","url":"https://example.com/x"}]}),
            ),
            ("Target.attachToTarget", json!({"sessionId":"S"})),
            ("DOM.getDocument", json!({"root":{"nodeName":"#document","backendNodeId":1,"children":[]}})),
            (
                "Page.getFrameTree",
                json!({"frameTree":{"frame":{"url":"https://example.com/x"}}}),
            ),
            (
                "Accessibility.getFullAXTree",
                json!({"nodes":[{"nodeId":"1","role":{"value":"heading"},"name":{"value":"Hello"}}]}),
            ),
            (
                "Target.getTargetInfo",
                json!({"targetInfo":{"url":"https://example.com/x"}}),
            ),
        ])
        .await;
        let mut conn = CdpConnection::connect_validated(&url).await.unwrap();
        let out = snapshot(&mut conn, &origins(), "A").await.unwrap();
        assert_eq!(out["nodes"][0]["name"], "Hello");
        assert_eq!(out["truncated"], false);
        assert_eq!(out["url"], "https://example.com/x");
    }

    #[tokio::test]
    async fn snapshot_fails_with_retry_when_the_page_moved() {
        let url = fake_kernel(vec![
            (
                "Target.getTargets",
                json!({"targetInfos":[{"targetId":"A","type":"page","title":"t","url":"https://example.com/x"}]}),
            ),
            ("Target.attachToTarget", json!({"sessionId":"S"})),
            ("DOM.getDocument", json!({"root":{"nodeName":"#document","backendNodeId":1,"children":[]}})),
            ("Page.getFrameTree", json!({"frameTree":{"frame":{"url":"https://example.com/y"}}})),
            ("Accessibility.getFullAXTree", json!({"nodes":[]})),
            ("Target.getTargetInfo", json!({"targetInfo":{"url":"https://example.com/y"}})),
        ])
        .await;
        let mut conn = CdpConnection::connect_validated(&url).await.unwrap();
        let moved = snapshot(&mut conn, &origins(), "A").await;
        assert!(matches!(moved, Err(McpToolError::Upstream(m)) if m == code::PAGE_CHANGED));
    }
}
