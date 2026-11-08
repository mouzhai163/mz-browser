//! Page actions for the MCP "act" tier: navigate, open a tab, click, type, press a key.
//!
//! Every action first re-checks that the page and all of its frames are plain http(s) pages,
//! only acts on elements that came from the same privacy-reduced accessibility outline the
//! snapshot tool shows (so password fields and typed values are never reachable), and never
//! evaluates scripts.

use serde_json::{Value, json};

use super::cdp::{
    CdpConnection, PageInfo, assert_frames, authorized_pages, authorized_url, blocked_ids, code,
    node_ident, node_is_editable, public_url, truncate,
};
use super::error::McpToolError;

pub const MAX_TYPED_CHARS: usize = 2000;
const ALLOWED_KEYS: [(&str, &str, u32); 13] = [
    ("Enter", "Enter", 13),
    ("Tab", "Tab", 9),
    ("Escape", "Escape", 27),
    ("Backspace", "Backspace", 8),
    ("Delete", "Delete", 46),
    ("ArrowUp", "ArrowUp", 38),
    ("ArrowDown", "ArrowDown", 40),
    ("ArrowLeft", "ArrowLeft", 37),
    ("ArrowRight", "ArrowRight", 39),
    ("PageUp", "PageUp", 33),
    ("PageDown", "PageDown", 34),
    ("Home", "Home", 36),
    ("End", "End", 35),
];

fn upstream(code: &str) -> McpToolError {
    McpToolError::upstream(code)
}

fn invalid(message: &str) -> McpToolError {
    McpToolError::invalid_params(message)
}

/// Attaches to an authorized page and verifies the page and its frames. Returns the session id.
async fn attach_authorized(
    conn: &mut CdpConnection,
    origins: &[String],
    page_id: &str,
) -> Result<(PageInfo, String), McpToolError> {
    let pages = authorized_pages(conn, origins).await?;
    let page = pages
        .into_iter()
        .find(|p| p.target_id == page_id)
        .ok_or_else(|| upstream(code::PAGE_NOT_AUTHORIZED))?;
    let attached = conn
        .send("Target.attachToTarget", json!({ "targetId": page.target_id, "flatten": true }), None)
        .await?;
    let session = attached
        .get("sessionId")
        .and_then(Value::as_str)
        .ok_or_else(|| upstream(code::COMMAND_FAILED))?
        .to_string();
    conn.send("Page.enable", json!({}), Some(&session)).await?;
    let tree = conn.send("Page.getFrameTree", json!({}), Some(&session)).await?;
    assert_frames(tree.get("frameTree").unwrap_or(&Value::Null), origins)?;
    Ok((page, session))
}

/// Where the page is now, reported only while it is still a plain http(s) page.
async fn current_state(
    conn: &mut CdpConnection,
    origins: &[String],
    target_id: &str,
) -> Result<Value, McpToolError> {
    let info = conn.send("Target.getTargetInfo", json!({ "targetId": target_id }), None).await?;
    let url = info
        .get("targetInfo")
        .and_then(|t| t.get("url"))
        .and_then(Value::as_str)
        .unwrap_or("");
    if authorized_url(url, origins) {
        Ok(json!({ "ok": true, "pageId": target_id, "url": public_url(url) }))
    } else {
        Ok(json!({
            "ok": true,
            "pageId": target_id,
            "url": null,
            "note": "The page is no longer a plain web page; further tools will refuse it."
        }))
    }
}

fn require_authorized_url(url: &str, origins: &[String]) -> Result<(), McpToolError> {
    if url.len() > 2048 || !authorized_url(url, origins) {
        return Err(invalid("URL must be a plain http(s) address"));
    }
    Ok(())
}

pub async fn navigate(
    conn: &mut CdpConnection,
    origins: &[String],
    page_id: &str,
    url: &str,
) -> Result<Value, McpToolError> {
    require_authorized_url(url, origins)?;
    let (page, session) = attach_authorized(conn, origins, page_id).await?;
    let result = conn.send("Page.navigate", json!({ "url": url }), Some(&session)).await?;
    if result.get("errorText").and_then(Value::as_str).is_some() {
        return Err(upstream("NAVIGATION_FAILED"));
    }
    current_state(conn, origins, &page.target_id).await
}

pub async fn open_tab(
    conn: &mut CdpConnection,
    origins: &[String],
    url: &str,
) -> Result<Value, McpToolError> {
    require_authorized_url(url, origins)?;
    let created = conn.send("Target.createTarget", json!({ "url": url }), None).await?;
    let target_id = created
        .get("targetId")
        .and_then(Value::as_str)
        .ok_or_else(|| upstream(code::COMMAND_FAILED))?
        .to_string();
    Ok(json!({ "ok": true, "pageId": target_id, "url": public_url(url) }))
}

/// Looks the node up in the same reduced view the snapshot exposes.
async fn find_node(
    conn: &mut CdpConnection,
    session: &str,
    node_id: &str,
) -> Result<(Value, u64), McpToolError> {
    let ax = conn
        .send("Accessibility.getFullAXTree", json!({ "depth": 8 }), Some(session))
        .await?;
    let nodes = ax.get("nodes").and_then(Value::as_array).cloned().unwrap_or_default();
    let blocked = blocked_ids(&nodes);
    let node = nodes
        .into_iter()
        .find(|n| node_ident(n).as_deref() == Some(node_id))
        .filter(|n| {
            !blocked.contains(node_id) && n.get("ignored").and_then(Value::as_bool) != Some(true)
        })
        .ok_or_else(|| invalid("Element not found; take a new snapshot and use a current id"))?;
    let backend = node
        .get("backendDOMNodeId")
        .and_then(Value::as_u64)
        .ok_or_else(|| invalid("Element cannot be targeted"))?;
    Ok((node, backend))
}

fn quad_center(model: &Value) -> Option<(f64, f64)> {
    let quad = model.get("model")?.get("content")?.as_array()?;
    if quad.len() != 8 {
        return None;
    }
    let n: Vec<f64> = quad.iter().filter_map(Value::as_f64).collect();
    if n.len() != 8 {
        return None;
    }
    Some(((n[0] + n[2] + n[4] + n[6]) / 4.0, (n[1] + n[3] + n[5] + n[7]) / 4.0))
}

pub async fn click(
    conn: &mut CdpConnection,
    origins: &[String],
    page_id: &str,
    node_id: &str,
) -> Result<Value, McpToolError> {
    let (page, session) = attach_authorized(conn, origins, page_id).await?;
    let (_, backend) = find_node(conn, &session, node_id).await?;
    conn.send("DOM.enable", json!({}), Some(&session)).await?;
    let _ = conn
        .send("DOM.scrollIntoViewIfNeeded", json!({ "backendNodeId": backend }), Some(&session))
        .await;
    let model = conn
        .send("DOM.getBoxModel", json!({ "backendNodeId": backend }), Some(&session))
        .await?;
    let (x, y) = quad_center(&model).ok_or_else(|| invalid("Element is not visible"))?;
    for (kind, extra) in [("mouseMoved", false), ("mousePressed", true), ("mouseReleased", true)] {
        let mut params = json!({ "type": kind, "x": x, "y": y, "button": "none" });
        if extra {
            params["button"] = json!("left");
            params["clickCount"] = json!(1);
        }
        conn.send("Input.dispatchMouseEvent", params, Some(&session)).await?;
    }
    current_state(conn, origins, &page.target_id).await
}

async fn key_press(
    conn: &mut CdpConnection,
    session: &str,
    key: &str,
    code: &str,
    vk: u32,
) -> Result<(), McpToolError> {
    for kind in ["keyDown", "keyUp"] {
        let mut params = json!({
            "type": kind, "key": key, "code": code,
            "windowsVirtualKeyCode": vk, "nativeVirtualKeyCode": vk,
        });
        if key == "Enter" && kind == "keyDown" {
            params["text"] = json!("\r");
        }
        conn.send("Input.dispatchKeyEvent", params, Some(session)).await?;
    }
    Ok(())
}

pub async fn press_key(
    conn: &mut CdpConnection,
    origins: &[String],
    page_id: &str,
    key: &str,
) -> Result<Value, McpToolError> {
    let (_, code, vk) = ALLOWED_KEYS
        .iter()
        .find(|(name, _, _)| *name == key)
        .copied()
        .ok_or_else(|| invalid("Key is not allowed"))?;
    let (page, session) = attach_authorized(conn, origins, page_id).await?;
    key_press(conn, &session, key, code, vk).await?;
    current_state(conn, origins, &page.target_id).await
}

pub async fn type_text(
    conn: &mut CdpConnection,
    origins: &[String],
    page_id: &str,
    node_id: &str,
    text: &str,
    clear: bool,
    submit: bool,
) -> Result<Value, McpToolError> {
    if text.is_empty() || text.chars().count() > MAX_TYPED_CHARS {
        return Err(invalid("Text must be 1 to 2000 characters"));
    }
    let (page, session) = attach_authorized(conn, origins, page_id).await?;
    let (node, backend) = find_node(conn, &session, node_id).await?;
    if !node_is_editable(&node) {
        return Err(invalid("Element is not an editable field"));
    }
    conn.send("DOM.enable", json!({}), Some(&session)).await?;
    conn.send("DOM.focus", json!({ "backendNodeId": backend }), Some(&session)).await?;
    if clear {
        conn.send(
            "Input.dispatchKeyEvent",
            json!({
                "type": "keyDown", "key": "a", "code": "KeyA", "modifiers": 2,
                "windowsVirtualKeyCode": 65, "commands": ["selectAll"]
            }),
            Some(&session),
        )
        .await?;
    }
    conn.send("Input.insertText", json!({ "text": text }), Some(&session)).await?;
    if submit {
        key_press(conn, &session, "Enter", "Enter", 13).await?;
    }
    let mut state = current_state(conn, origins, &page.target_id).await?;
    state["typedChars"] = json!(text.chars().count());
    Ok(state)
}

/// Short, log-safe description (never includes typed text).
pub fn describe(action: &str, page_id: &str) -> String {
    format!("{action} page={}", truncate(page_id, 64))
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures::{SinkExt, StreamExt};
    use tokio::net::TcpListener;
    use tokio_tungstenite::{accept_async, tungstenite::Message};

    fn origins() -> Vec<String> {
        vec!["https://example.com".into()]
    }

    /// Scripted fake kernel that records every request it receives.
    async fn fake_kernel(
        replies: Vec<(&'static str, Value)>,
    ) -> (String, std::sync::Arc<std::sync::Mutex<Vec<Value>>>) {
        let log = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let seen = log.clone();
        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut ws = accept_async(stream).await.unwrap();
            while let Some(Ok(Message::Text(text))) = ws.next().await {
                let request: Value = serde_json::from_str(&text).unwrap();
                seen.lock().unwrap().push(request.clone());
                let method = request["method"].as_str().unwrap().to_string();
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
        (format!("ws://127.0.0.1:{port}/devtools/browser/test"), log)
    }

    fn page_replies() -> Vec<(&'static str, Value)> {
        vec![
            (
                "Target.getTargets",
                json!({"targetInfos":[
                    {"targetId":"A","type":"page","title":"t","url":"https://example.com/"},
                    {"targetId":"B","type":"page","title":"x","url":"https://evil.example/"}]}),
            ),
            ("Target.attachToTarget", json!({"sessionId":"S"})),
            ("Page.getFrameTree", json!({"frameTree":{"frame":{"url":"https://example.com/"}}})),
            ("Target.getTargetInfo", json!({"targetInfo":{"url":"https://example.com/next?q=1"}})),
            (
                "Accessibility.getFullAXTree",
                json!({"nodes":[
                    {"nodeId":"1","role":{"value":"button"},"name":{"value":"Go"},"backendDOMNodeId":11},
                    {"nodeId":"2","role":{"value":"textbox"},"name":{"value":"q"},"backendDOMNodeId":12},
                    {"nodeId":"3","role":{"value":"textbox"},"name":{"value":"pw"},"backendDOMNodeId":13,
                     "properties":[{"name":"protected","value":{"value":true}}]},
                    {"nodeId":"4","role":{"value":"StaticText"},"name":{"value":"typed"},"backendDOMNodeId":14}
                ]}),
            ),
            ("DOM.getBoxModel", json!({"model":{"content":[10.0,10.0,30.0,10.0,30.0,30.0,10.0,30.0]}})),
        ]
    }

    fn methods(log: &std::sync::Arc<std::sync::Mutex<Vec<Value>>>) -> Vec<String> {
        log.lock().unwrap().iter().map(|r| r["method"].as_str().unwrap().to_string()).collect()
    }

    #[test]
    fn quad_center_is_the_middle_of_the_box() {
        let model = json!({"model":{"content":[0.0,0.0,10.0,0.0,10.0,20.0,0.0,20.0]}});
        assert_eq!(quad_center(&model), Some((5.0, 10.0)));
        assert_eq!(quad_center(&json!({"model":{"content":[1.0]}})), None);
    }

    #[tokio::test]
    async fn click_sends_a_real_mouse_click_at_the_element_center() {
        let (url, log) = fake_kernel(page_replies()).await;
        let mut conn = CdpConnection::connect_validated(&url).await.unwrap();
        let out = click(&mut conn, &origins(), "A", "1").await.unwrap();
        assert_eq!(out["url"], "https://example.com/next");
        let sent = log.lock().unwrap().clone();
        let press = sent.iter().find(|r| r["params"]["type"] == "mousePressed").unwrap();
        assert_eq!(press["params"]["x"], 20.0);
        assert_eq!(press["params"]["y"], 20.0);
        assert!(methods(&log).contains(&"Input.dispatchMouseEvent".to_string()));
    }

    #[tokio::test]
    async fn actions_refuse_unauthorized_pages_and_never_touch_them() {
        let (url, log) = fake_kernel(page_replies()).await;
        let mut conn = CdpConnection::connect_validated(&url).await.unwrap();
        let denied = click(&mut conn, &origins(), "B", "1").await;
        assert!(matches!(denied, Err(McpToolError::Upstream(m)) if m == code::PAGE_NOT_AUTHORIZED));
        assert!(!methods(&log).iter().any(|m| m.starts_with("Input.") || m == "Target.attachToTarget"));
    }

    #[tokio::test]
    async fn typing_is_refused_for_password_fields_and_non_fields() {
        let (url, log) = fake_kernel(page_replies()).await;
        let mut conn = CdpConnection::connect_validated(&url).await.unwrap();
        for node in ["3", "1", "4", "99"] {
            let result = type_text(&mut conn, &origins(), "A", node, "hello", false, false).await;
            assert!(matches!(result, Err(McpToolError::InvalidParams(_))), "node {node}");
        }
        assert!(!methods(&log).contains(&"Input.insertText".to_string()));
    }

    #[tokio::test]
    async fn typing_into_a_text_field_focuses_then_inserts_and_can_submit() {
        let (url, log) = fake_kernel(page_replies()).await;
        let mut conn = CdpConnection::connect_validated(&url).await.unwrap();
        let out = type_text(&mut conn, &origins(), "A", "2", "hello", true, true).await.unwrap();
        assert_eq!(out["typedChars"], 5);
        let m = methods(&log);
        let focus = m.iter().position(|x| x == "DOM.focus").unwrap();
        let insert = m.iter().position(|x| x == "Input.insertText").unwrap();
        assert!(focus < insert);
        assert!(log.lock().unwrap().iter().any(|r| r["params"]["key"] == "Enter"));
    }

    #[tokio::test]
    async fn navigation_stays_on_allowed_sites() {
        let (url, _log) = fake_kernel(page_replies()).await;
        let mut conn = CdpConnection::connect_validated(&url).await.unwrap();
        for bad in ["https://evil.example/", "javascript:alert(1)", "file:///c:/x", "http://example.com/"] {
            let result = navigate(&mut conn, &origins(), "A", bad).await;
            assert!(matches!(result, Err(McpToolError::InvalidParams(_))), "{bad}");
        }
        assert!(navigate(&mut conn, &origins(), "A", "https://example.com/next").await.is_ok());
        assert!(open_tab(&mut conn, &origins(), "https://evil.example/").await.is_err());
    }

    /// Needs a running kernel: `MZ_LIVE_CDP_WS=ws://127.0.0.1:<port>/devtools/browser/<id>
    /// cargo test live_kernel_round_trip -- --ignored`.
    #[tokio::test]
    #[ignore = "needs a running MZ kernel"]
    async fn live_kernel_round_trip() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let ws = std::env::var("MZ_LIVE_CDP_WS").expect("MZ_LIVE_CDP_WS");
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let page = r#"<!doctype html><title>live</title><h1 id=out>idle</h1>
<input id=q aria-label="query"><input id=pw type=password aria-label="secret">
<button id=go onclick="document.getElementById('out').textContent='got:'+document.getElementById('q').value">Send</button>"#;
        tokio::spawn(async move {
            loop {
                let Ok((mut stream, _)) = listener.accept().await else { return };
                let mut buf = [0u8; 2048];
                let _ = stream.read(&mut buf).await;
                let body = page.as_bytes();
                let head = format!(
                    "HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: {}
Connection: close

",
                    body.len()
                );
                let _ = stream.write_all(head.as_bytes()).await;
                let _ = stream.write_all(body).await;
            }
        });
        let origin = format!("http://127.0.0.1:{port}");
        let origins = vec![origin.clone()];

        let mut conn = CdpConnection::connect(&ws).await.unwrap();
        let tab = open_tab(&mut conn, &origins, &format!("{origin}/")).await.unwrap();
        let page_id = tab["pageId"].as_str().unwrap().to_string();
        conn.close().await;
        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;

        let snap = |origins: Vec<String>, page_id: String, ws: String| async move {
            let mut conn = CdpConnection::connect(&ws).await.unwrap();
            let out = crate::mcp::cdp::snapshot(&mut conn, &origins, &page_id).await;
            conn.close().await;
            out
        };
        let first = snap(origins.clone(), page_id.clone(), ws.clone()).await.unwrap();
        let nodes = first["nodes"].as_array().unwrap();
        let find = |role: &str, name: &str| {
            nodes
                .iter()
                .find(|n| n["role"] == role && n["name"].as_str().unwrap_or("").contains(name))
                .map(|n| n["id"].as_str().unwrap().to_string())
        };
        let text = serde_json::to_string(&first).unwrap();
        assert!(text.contains("idle"), "{text}");
        let textbox = nodes.iter().find(|n| n["name"] == "[editable field]").expect("textbox");
        let button = find("button", "Send").expect("button");

        // the password field must be neither listed nor reachable
        let mut conn = CdpConnection::connect(&ws).await.unwrap();
        let pw_ids: Vec<String> = {
            let ax = conn.send("Target.attachToTarget", json!({"targetId": page_id, "flatten": true}), None).await.unwrap();
            let session = ax["sessionId"].as_str().unwrap().to_string();
            let tree = conn.send("Accessibility.getFullAXTree", json!({}), Some(&session)).await.unwrap();
            tree["nodes"].as_array().unwrap().iter()
                .filter(|n| n["properties"].as_array().is_some_and(|p| p.iter().any(|x| x["name"] == "protected")))
                .map(|n| n["nodeId"].as_str().unwrap().to_string())
                .collect()
        };
        for id in &pw_ids {
            let r = type_text(&mut conn, &origins, &page_id, id, "nope", false, false).await;
            assert!(r.is_err(), "password field {id} must be refused");
        }
        conn.close().await;

        let mut conn = CdpConnection::connect(&ws).await.unwrap();
        type_text(&mut conn, &origins, &page_id, textbox["id"].as_str().unwrap(), "hello", true, false)
            .await
            .unwrap();
        click(&mut conn, &origins, &page_id, &button).await.unwrap();
        conn.close().await;
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        let after = snap(origins.clone(), page_id.clone(), ws.clone()).await.unwrap();
        let text = serde_json::to_string(&after).unwrap();
        assert!(text.contains("got:hello"), "click+type did not reach the page: {text}");

        // leaving the allowed site is refused up front
        let mut conn = CdpConnection::connect(&ws).await.unwrap();
        assert!(navigate(&mut conn, &origins, &page_id, "https://example.org/").await.is_err());
        conn.close().await;
    }

    #[tokio::test]
    async fn only_listed_keys_can_be_pressed() {
        let (url, _log) = fake_kernel(page_replies()).await;
        let mut conn = CdpConnection::connect_validated(&url).await.unwrap();
        assert!(press_key(&mut conn, &origins(), "A", "Enter").await.is_ok());
        let result = press_key(&mut conn, &origins(), "A", "Control+C").await;
        assert!(matches!(result, Err(McpToolError::InvalidParams(_))));
    }
}
