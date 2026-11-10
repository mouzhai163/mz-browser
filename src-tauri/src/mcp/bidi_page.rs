//! MCP 页面工具的 Firefox 版本（WebDriver BiDi）。
//!
//! 和 Chromium 版（cdp.rs / cdp_act.rs）对外完全一样：同样的输出格式、同样只碰 http(s) 页面、
//! 同样不给出密码框和一次性验证码等敏感字段（除非开了完全页面访问）。
//! Firefox 没有 CDP 的无障碍树，页面大纲由一段固定的脚本在隔离沙箱里生成，页面脚本看不到它；
//! 元素用 BiDi 的 sharedId 标识，点击和输入走 BiDi 的 input.performActions。
//! 连接地址是运行时的共用会话转发端口（见 runtime 的 gecko_relay）。

use std::time::Duration;

use futures::{SinkExt, StreamExt};
use serde_json::{Value, json};
use tokio::net::TcpStream;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async, tungstenite::Message};

use super::cdp::{MAX_SNAPSHOT_NODES, authorized_url, code, public_url, truncate};
use super::cdp_act::MAX_TYPED_CHARS;
use super::error::McpToolError;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const COMMAND_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_TABS: usize = 100;
/// 隔离沙箱的名字：脚本在这里运行，页面自己的脚本看不到
const SANDBOX: &str = "mz-mcp";

/// BiDi 的按键码（WebDriver 规范），和 Chromium 版允许的按键一一对应
const ALLOWED_KEYS: [(&str, &str); 13] = [
    ("Enter", "\u{E007}"),
    ("Tab", "\u{E004}"),
    ("Escape", "\u{E00C}"),
    ("Backspace", "\u{E003}"),
    ("Delete", "\u{E017}"),
    ("ArrowUp", "\u{E013}"),
    ("ArrowDown", "\u{E015}"),
    ("ArrowLeft", "\u{E012}"),
    ("ArrowRight", "\u{E014}"),
    ("PageUp", "\u{E00E}"),
    ("PageDown", "\u{E00F}"),
    ("Home", "\u{E011}"),
    ("End", "\u{E010}"),
];

/// 页面大纲：每项是 [元素, 角色, 名称, 可编辑, 敏感, 值, 父项序号]。
/// 敏感字段（密码、一次性验证码、银行卡）在非完全访问时整个不出现；可编辑字段的内容只在完全访问时给出。
const OUTLINE_SCRIPT: &str = r#"function (full, max) {
  const SECRET_AUTOCOMPLETE = ['current-password', 'new-password', 'one-time-code', 'cc-number', 'cc-csc', 'cc-exp'];
  const TEXT_TYPES = ['', 'text', 'search', 'email', 'url', 'tel', 'number', 'password', 'date', 'datetime-local', 'month', 'time', 'week'];
  const IMPLICIT = { A: 'link', BUTTON: 'button', SELECT: 'combobox', TEXTAREA: 'textbox', IMG: 'img',
    H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading', H5: 'heading', H6: 'heading',
    NAV: 'navigation', MAIN: 'main', FORM: 'form', UL: 'list', OL: 'list', LI: 'listitem', TABLE: 'table',
    DIALOG: 'dialog', LABEL: 'LabelText', OPTION: 'option', SUMMARY: 'button' };
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'SVG']);
  const clip = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const hidden = (el) => {
    const cs = getComputedStyle(el);
    return cs.display === 'none' || cs.visibility === 'hidden' || el.getClientRects().length === 0;
  };
  const isSecret = (el) => {
    if (el.tagName !== 'INPUT') return false;
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/);
    return el.type === 'password' || ac.some((t) => SECRET_AUTOCOMPLETE.includes(t));
  };
  const isEditable = (el) => el.isContentEditable || el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && TEXT_TYPES.includes(el.type));
  const roleOf = (el) => {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit.split(/\s+/)[0];
    if (el.tagName === 'INPUT') {
      if (['checkbox', 'radio'].includes(el.type)) return el.type;
      if (['button', 'submit', 'reset', 'image', 'file', 'color'].includes(el.type)) return 'button';
      if (el.type === 'range') return 'slider';
      if (el.type === 'hidden') return '';
      if (el.type === 'search') return 'searchbox';
      return 'textbox';
    }
    if (el.tagName === 'A' && !el.hasAttribute('href')) return '';
    if (el.isContentEditable) return 'textbox';
    return IMPLICIT[el.tagName] || '';
  };
  const ownText = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.data).join(' ');
  const nameOf = (el, role) => {
    const label = el.getAttribute('aria-label');
    if (label) return label;
    const by = el.getAttribute('aria-labelledby');
    if (by) return by.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((n) => n.textContent).join(' ');
    if (el.labels && el.labels.length) return Array.from(el.labels).map((l) => l.textContent).join(' ');
    if (el.tagName === 'IMG') return el.getAttribute('alt') || el.getAttribute('title') || '';
    if (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type)) return el.value || '';
    if (isEditable(el)) return el.getAttribute('placeholder') || el.getAttribute('title') || '';
    if (role && role !== 'LabelText') return el.innerText || el.getAttribute('title') || '';
    return ownText(el);
  };
  const out = [];
  const indexOf = new Map();
  let total = 0;
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (el) => SKIP.has(el.tagName.toUpperCase()) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    if (el.nodeType !== 1 || hidden(el)) continue;
    const role = roleOf(el);
    const text = role ? '' : clip(ownText(el), 300);
    if (!role && !text) continue;
    const secret = isSecret(el);
    if (secret && !full) continue;
    total++;
    if (out.length >= max) continue;
    const editable = isEditable(el);
    let name = role ? clip(nameOf(el, role), 300) : text;
    if (editable && !full) name = '[editable field]';
    let value = null;
    if (full && editable) value = el.isContentEditable ? clip(el.innerText, 1000) : String(el.value || '').slice(0, 1000);
    let parent = -1;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (indexOf.has(p)) { parent = indexOf.get(p); break; }
    }
    indexOf.set(el, out.length);
    out.push([el, role || 'text', name, editable, secret, value, parent]);
  }
  return [out, total];
}"#;

pub fn is_gecko_endpoint(value: &str) -> bool {
    reqwest::Url::parse(value).is_ok_and(|url| url.path() == "/session")
}

/// 只接受运行时给出的本机共用会话地址
fn validate_endpoint(value: &str) -> Result<reqwest::Url, McpToolError> {
    let url = reqwest::Url::parse(value).map_err(|_| upstream(code::INVALID_ENDPOINT))?;
    if url.scheme() != "ws"
        || url.host_str() != Some("127.0.0.1")
        || url.port().is_none()
        || url.path() != "/session"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(upstream(code::INVALID_ENDPOINT));
    }
    Ok(url)
}

fn upstream(code: &str) -> McpToolError {
    McpToolError::upstream(code)
}

fn invalid(message: &str) -> McpToolError {
    McpToolError::invalid_params(message)
}

type Socket = WebSocketStream<MaybeTlsStream<TcpStream>>;

/// 一条短连接，命令严格按顺序发
pub struct BidiPage {
    socket: Socket,
    next_id: u64,
    full_access: bool,
}

impl BidiPage {
    pub async fn connect(endpoint: &str, full_access: bool) -> Result<Self, McpToolError> {
        let url = validate_endpoint(endpoint)?;
        let (socket, _) = tokio::time::timeout(CONNECT_TIMEOUT, connect_async(url.as_str()))
            .await
            .map_err(|_| upstream(code::CONNECTION_TIMEOUT))?
            .map_err(|_| upstream(code::CONNECTION_FAILED))?;
        Ok(Self { socket, next_id: 1, full_access })
    }

    async fn send(&mut self, method: &str, params: Value) -> Result<Value, McpToolError> {
        let id = self.next_id;
        self.next_id += 1;
        let message = json!({ "id": id, "method": method, "params": params }).to_string();
        self.socket
            .send(Message::Text(message.into()))
            .await
            .map_err(|_| upstream(code::SEND_FAILED))?;
        let wait = async {
            while let Some(message) = self.socket.next().await {
                let Ok(Message::Text(text)) = message else { continue };
                let Ok(value) = serde_json::from_str::<Value>(text.as_str()) else { continue };
                if value.get("id").and_then(Value::as_u64) != Some(id) {
                    continue; // 事件，或者别的请求的响应
                }
                return if value.get("type").and_then(Value::as_str) == Some("success") {
                    Ok(value.get("result").cloned().unwrap_or(Value::Null))
                } else {
                    Err(upstream(code::COMMAND_FAILED))
                };
            }
            Err(upstream(code::CONNECTION_CLOSED))
        };
        tokio::time::timeout(COMMAND_TIMEOUT, wait)
            .await
            .map_err(|_| upstream(code::COMMAND_TIMEOUT))?
    }

    pub async fn close(mut self) {
        let _ = self.socket.close(None).await;
    }

    /// 在隔离沙箱里调用一个固定的函数；参数和返回值都按 BiDi 的序列化格式
    async fn call(&mut self, context: &str, function: &str, arguments: Vec<Value>) -> Result<Value, McpToolError> {
        let result = self
            .send(
                "script.callFunction",
                json!({
                    "functionDeclaration": function,
                    "awaitPromise": false,
                    "target": { "context": context, "sandbox": SANDBOX },
                    "arguments": arguments,
                    "serializationOptions": { "maxDomDepth": 0, "maxObjectDepth": 4 },
                    "resultOwnership": "none",
                }),
            )
            .await?;
        if result.get("type").and_then(Value::as_str) != Some("success") {
            return Err(upstream(code::COMMAND_FAILED));
        }
        Ok(result.get("result").cloned().unwrap_or(Value::Null))
    }
}

struct Context {
    id: String,
    url: String,
    children: Vec<Value>,
}

async fn top_contexts(page: &mut BidiPage) -> Result<Vec<Context>, McpToolError> {
    let tree = page.send("browsingContext.getTree", json!({})).await?;
    Ok(tree
        .get("contexts")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|context| {
            Some(Context {
                id: context.get("context")?.as_str()?.to_string(),
                url: context.get("url").and_then(Value::as_str).unwrap_or("").to_string(),
                children: context.get("children").and_then(Value::as_array).cloned().unwrap_or_default(),
            })
        })
        .collect())
}

/// 页面和它所有的 iframe 都必须是 http(s) 页面
fn assert_frames(children: &[Value], origins: &[String]) -> Result<(), McpToolError> {
    for child in children {
        let url = child.get("url").and_then(Value::as_str).unwrap_or("");
        if !authorized_url(url, origins) {
            return Err(upstream(code::FRAME_NOT_AUTHORIZED));
        }
        if let Some(grandchildren) = child.get("children").and_then(Value::as_array) {
            assert_frames(grandchildren, origins)?;
        }
    }
    Ok(())
}

async fn authorized_page(page: &mut BidiPage, origins: &[String], page_id: &str) -> Result<Context, McpToolError> {
    let context = top_contexts(page)
        .await?
        .into_iter()
        .find(|context| context.id == page_id && authorized_url(&context.url, origins))
        .ok_or_else(|| upstream(code::PAGE_NOT_AUTHORIZED))?;
    assert_frames(&context.children, origins)?;
    Ok(context)
}

async fn title(page: &mut BidiPage, context: &str) -> String {
    page.call(context, "function () { return document.title; }", vec![])
        .await
        .ok()
        .and_then(|value| value.get("value").and_then(Value::as_str).map(ToOwned::to_owned))
        .unwrap_or_default()
}

pub async fn list_tabs(page: &mut BidiPage, origins: &[String]) -> Result<Value, McpToolError> {
    let contexts: Vec<Context> = top_contexts(page)
        .await?
        .into_iter()
        .filter(|context| authorized_url(&context.url, origins))
        .take(MAX_TABS)
        .collect();
    let mut pages = Vec::with_capacity(contexts.len());
    for context in contexts {
        let title = title(page, &context.id).await;
        pages.push(json!({ "pageId": context.id, "title": truncate(&title, 256), "url": public_url(&context.url) }));
    }
    Ok(json!({ "pages": pages }))
}

/// 一项大纲：元素的 sharedId 和它在大纲里的样子
struct OutlineNode {
    shared_id: String,
    role: String,
    name: String,
    editable: bool,
    secret: bool,
    value: Option<String>,
    parent: i64,
}

fn remote_str(value: &Value) -> String {
    value.get("value").and_then(Value::as_str).unwrap_or("").to_string()
}

async fn outline(page: &mut BidiPage, context: &str) -> Result<(Vec<OutlineNode>, u64), McpToolError> {
    let full = page.full_access;
    let result = page
        .call(
            context,
            OUTLINE_SCRIPT,
            vec![json!({ "type": "boolean", "value": full }), json!({ "type": "number", "value": MAX_SNAPSHOT_NODES })],
        )
        .await?;
    let pair = result.get("value").and_then(Value::as_array).ok_or_else(|| upstream(code::COMMAND_FAILED))?;
    let items = pair.first().and_then(|items| items.get("value")).and_then(Value::as_array).cloned().unwrap_or_default();
    let total = pair.get(1).and_then(|total| total.get("value")).and_then(Value::as_u64).unwrap_or(0);
    let mut nodes = Vec::with_capacity(items.len());
    for item in items {
        let Some(fields) = item.get("value").and_then(Value::as_array) else { continue };
        let Some(shared_id) = fields.first().and_then(|node| node.get("sharedId")).and_then(Value::as_str) else { continue };
        let flag = |index: usize| fields.get(index).and_then(|field| field.get("value")).and_then(Value::as_bool).unwrap_or(false);
        nodes.push(OutlineNode {
            shared_id: shared_id.to_string(),
            role: fields.get(1).map(remote_str).unwrap_or_default(),
            name: fields.get(2).map(remote_str).unwrap_or_default(),
            editable: flag(3),
            secret: flag(4),
            value: fields.get(5).filter(|value| value.get("type").and_then(Value::as_str) == Some("string")).map(remote_str),
            parent: fields.get(6).and_then(|field| field.get("value")).and_then(Value::as_i64).unwrap_or(-1),
        });
    }
    Ok((nodes, total))
}

pub async fn snapshot(page: &mut BidiPage, origins: &[String], page_id: &str) -> Result<Value, McpToolError> {
    let context = authorized_page(page, origins, page_id).await?;
    let (nodes, total) = outline(page, &context.id).await?;
    // 读大纲期间页面跳走了，结果不能用
    let after = authorized_page(page, origins, page_id).await?;
    if after.url != context.url {
        return Err(upstream(code::PAGE_CHANGED));
    }
    let full = page.full_access;
    let entries: Vec<Value> = nodes
        .iter()
        .enumerate()
        .map(|(index, node)| {
            let children: Vec<String> = nodes
                .iter()
                .filter(|child| child.parent == index as i64)
                .take(20)
                .map(|child| truncate(&child.shared_id, 100))
                .collect();
            let mut entry = json!({
                "id": truncate(&node.shared_id, 100),
                "role": truncate(&node.role, 100),
                "name": node.name,
                "children": children,
            });
            if full {
                if let Some(value) = &node.value {
                    entry["value"] = json!(value);
                }
                if node.secret {
                    entry["protected"] = json!(true);
                }
            }
            entry
        })
        .collect();
    Ok(json!({
        "pageId": context.id,
        "url": public_url(&context.url),
        "nodes": entries,
        "truncated": total > MAX_SNAPSHOT_NODES as u64,
    }))
}

pub async fn read(endpoint: &str, origins: &[String], page_id: Option<&str>, full_access: bool) -> Result<Value, McpToolError> {
    let mut page = BidiPage::connect(endpoint, full_access).await?;
    let result = match page_id {
        None => list_tabs(&mut page, origins).await,
        Some(page_id) => snapshot(&mut page, origins, page_id).await,
    };
    page.close().await;
    result
}

async fn current_state(page: &mut BidiPage, origins: &[String], page_id: &str) -> Result<Value, McpToolError> {
    let url = top_contexts(page)
        .await?
        .into_iter()
        .find(|context| context.id == page_id)
        .map(|context| context.url)
        .unwrap_or_default();
    if authorized_url(&url, origins) {
        Ok(json!({ "ok": true, "pageId": page_id, "url": public_url(&url) }))
    } else {
        Ok(json!({
            "ok": true,
            "pageId": page_id,
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

pub async fn navigate(page: &mut BidiPage, origins: &[String], page_id: &str, url: &str) -> Result<Value, McpToolError> {
    require_authorized_url(url, origins)?;
    let context = authorized_page(page, origins, page_id).await?;
    page.send("browsingContext.navigate", json!({ "context": context.id, "url": url, "wait": "interactive" }))
        .await
        .map_err(|_| upstream("NAVIGATION_FAILED"))?;
    current_state(page, origins, &context.id).await
}

pub async fn open_tab(page: &mut BidiPage, origins: &[String], url: &str) -> Result<Value, McpToolError> {
    require_authorized_url(url, origins)?;
    let created = page.send("browsingContext.create", json!({ "type": "tab" })).await?;
    let context = created
        .get("context")
        .and_then(Value::as_str)
        .ok_or_else(|| upstream(code::COMMAND_FAILED))?
        .to_string();
    page.send("browsingContext.navigate", json!({ "context": context, "url": url, "wait": "none" })).await?;
    Ok(json!({ "ok": true, "pageId": context, "url": public_url(url) }))
}

/// 在当前大纲里找元素：只能操作快照里看得到的元素（敏感字段在非完全访问时根本不在大纲里）
async fn find_node(page: &mut BidiPage, context: &str, node_id: &str) -> Result<OutlineNode, McpToolError> {
    let (nodes, _) = outline(page, context).await?;
    nodes
        .into_iter()
        .find(|node| node.shared_id == node_id)
        .ok_or_else(|| invalid("Element not found; take a new snapshot and use a current id"))
}

fn element(shared_id: &str) -> Value {
    json!({ "sharedId": shared_id })
}

/// 输入事件只发给前台标签页，先切过去，再把元素滚进视口
async fn prepare_element(page: &mut BidiPage, context: &str, shared_id: &str) -> Result<(), McpToolError> {
    page.send("browsingContext.activate", json!({ "context": context })).await?;
    tokio::time::sleep(Duration::from_millis(150)).await;
    page.call(
        context,
        "function (el) { el.scrollIntoView({ block: 'center', inline: 'center' }); }",
        vec![element(shared_id)],
    )
    .await?;
    Ok(())
}

pub async fn click(page: &mut BidiPage, origins: &[String], page_id: &str, node_id: &str) -> Result<Value, McpToolError> {
    let context = authorized_page(page, origins, page_id).await?;
    let node = find_node(page, &context.id, node_id).await?;
    prepare_element(page, &context.id, &node.shared_id).await?;
    page.send(
        "input.performActions",
        json!({ "context": context.id, "actions": [{
            "type": "pointer", "id": "mz-mouse", "parameters": { "pointerType": "mouse" },
            "actions": [
                { "type": "pointerMove", "x": 0, "y": 0, "origin": { "type": "element", "element": element(&node.shared_id) } },
                { "type": "pointerDown", "button": 0 },
                { "type": "pointerUp", "button": 0 },
            ],
        }]}),
    )
    .await
    .map_err(|_| invalid("Element is not visible"))?;
    current_state(page, origins, &context.id).await
}

async fn press(page: &mut BidiPage, context: &str, keys: &[&str]) -> Result<(), McpToolError> {
    let actions: Vec<Value> = keys
        .iter()
        .flat_map(|key| [json!({ "type": "keyDown", "value": key }), json!({ "type": "keyUp", "value": key })])
        .collect();
    page.send(
        "input.performActions",
        json!({ "context": context, "actions": [{ "type": "key", "id": "mz-keyboard", "actions": actions }] }),
    )
    .await?;
    Ok(())
}

pub async fn press_key(page: &mut BidiPage, origins: &[String], page_id: &str, key: &str) -> Result<Value, McpToolError> {
    let (_, code) = ALLOWED_KEYS
        .iter()
        .find(|(name, _)| *name == key)
        .copied()
        .ok_or_else(|| invalid("Key is not allowed"))?;
    let context = authorized_page(page, origins, page_id).await?;
    page.send("browsingContext.activate", json!({ "context": context.id })).await?;
    press(page, &context.id, &[code]).await?;
    current_state(page, origins, &context.id).await
}

pub async fn type_text(
    page: &mut BidiPage,
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
    let context = authorized_page(page, origins, page_id).await?;
    let node = find_node(page, &context.id, node_id).await?;
    if !node.editable {
        return Err(invalid("Element is not an editable field"));
    }
    prepare_element(page, &context.id, &node.shared_id).await?;
    // 先聚焦；要清空时把现有内容全选，接着输入的文字会替换掉它
    let focus = if clear {
        "function (el) { el.focus(); if (typeof el.select === 'function') { el.select(); } else { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }"
    } else {
        "function (el) { el.focus(); }"
    };
    page.call(&context.id, focus, vec![element(&node.shared_id)]).await?;
    let chars: Vec<String> = text.chars().map(String::from).collect();
    let keys: Vec<&str> = chars.iter().map(String::as_str).collect();
    press(page, &context.id, &keys).await?;
    if submit {
        press(page, &context.id, &["\u{E007}"]).await?;
    }
    let mut state = current_state(page, origins, &context.id).await?;
    state["typedChars"] = json!(text.chars().count());
    Ok(state)
}

/// 读输入框（包括密码框）的真实内容，只给完全页面访问用
pub async fn read_field(page: &mut BidiPage, origins: &[String], page_id: &str, node_id: &str) -> Result<Value, McpToolError> {
    if !page.full_access {
        return Err(invalid("Full page access is disabled"));
    }
    let context = authorized_page(page, origins, page_id).await?;
    let node = find_node(page, &context.id, node_id).await?;
    if !node.editable {
        return Err(invalid("Element is not an editable field"));
    }
    let value = page
        .call(
            &context.id,
            "function (el) { return typeof el.value === 'string' ? el.value : (el.isContentEditable ? el.innerText : ''); }",
            vec![element(&node.shared_id)],
        )
        .await?;
    let mut state = current_state(page, origins, &context.id).await?;
    state["value"] = json!(truncate(value.get("value").and_then(Value::as_str).unwrap_or(""), 4000));
    state["isPassword"] = json!(node.secret);
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_local_shared_session_is_accepted() {
        assert!(validate_endpoint("ws://127.0.0.1:51234/session").is_ok());
        for bad in [
            "ws://localhost:51234/session",
            "wss://127.0.0.1:51234/session",
            "ws://127.0.0.1/session",
            "ws://127.0.0.1:51234/session/abc",
            "ws://127.0.0.1:51234/session?x=1",
            "ws://user@127.0.0.1:51234/session",
            "ws://127.0.0.1:29200/devtools/browser/abc",
        ] {
            assert!(validate_endpoint(bad).is_err(), "{bad}");
        }
        assert!(is_gecko_endpoint("ws://127.0.0.1:51234/session"));
        assert!(!is_gecko_endpoint("ws://127.0.0.1:29200/devtools/browser/abc"));
    }

    #[test]
    fn iframes_must_be_web_pages_too() {
        let ok = vec![json!({ "url": "https://example.com/a", "children": [] })];
        assert!(assert_frames(&ok, &[]).is_ok());
        let nested = vec![json!({ "url": "https://example.com/a", "children": [{ "url": "file:///c:/x" }] })];
        assert!(assert_frames(&nested, &[]).is_err());
    }
}
