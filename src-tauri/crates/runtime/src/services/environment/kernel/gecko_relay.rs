//! 让多个客户端共用 Firefox 环境唯一的 BiDi 会话。
//!
//! Firefox 一个浏览器只允许一个 BiDi 会话，这个会话由运行时持有（见 gecko.rs）。
//! MCP 和 RPA 都连这里：每个客户端以为自己有一个会话，命令转发到运行时的连接上，
//! 响应按客户端自己的 id 送回；事件发给所有客户端。
//! 结束会话、关闭浏览器这类会影响别的客户端的命令不转发。

use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::http::StatusCode;

use super::bidi::BidiConnection;

/// 浏览器页面里能连过来的来源：软件自己的界面（RPA 在 WebView 里直接连）。
/// 本机原生客户端（MCP）不带 Origin。其他网页一律拒绝，防止网站连上本机端口控制浏览器。
const ALLOWED_ORIGINS: [&str; 4] = [
    "tauri://localhost",
    "http://tauri.localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];

/// 这些命令会结束或改动所有客户端共用的会话
const BLOCKED: [&str; 2] = ["browser.close", "session.end"];

pub struct Relay {
    pub port: u16,
    task: JoinHandle<()>,
}

impl Drop for Relay {
    fn drop(&mut self) {
        self.task.abort();
    }
}

pub fn relay_url(port: u16) -> String {
    format!("ws://127.0.0.1:{port}/session")
}

pub async fn start(bidi: Arc<BidiConnection>, capabilities: Value) -> Result<Relay, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|error| format!("BiDi 转发端口启动失败：{error}"))?;
    let port = listener.local_addr().map_err(|error| error.to_string())?.port();
    let task = tokio::spawn(async move {
        loop {
            let Ok((stream, _)) = listener.accept().await else { continue };
            let bidi = bidi.clone();
            let capabilities = capabilities.clone();
            tokio::spawn(async move {
                let _ = serve(stream, bidi, capabilities).await;
            });
        }
    });
    Ok(Relay { port, task })
}

fn check_request(request: &Request, response: Response) -> Result<Response, ErrorResponse> {
    let reject = |status: StatusCode| {
        let mut error = ErrorResponse::new(None);
        *error.status_mut() = status;
        Err(error)
    };
    if request.uri().path() != "/session" || request.uri().query().is_some() {
        return reject(StatusCode::NOT_FOUND);
    }
    if let Some(origin) = request.headers().get("origin") {
        let allowed = origin.to_str().is_ok_and(|origin| ALLOWED_ORIGINS.contains(&origin));
        if !allowed {
            return reject(StatusCode::FORBIDDEN);
        }
    }
    Ok(response)
}

async fn serve(stream: TcpStream, bidi: Arc<BidiConnection>, capabilities: Value) -> Result<(), String> {
    let socket = tokio_tungstenite::accept_hdr_async(stream, check_request)
        .await
        .map_err(|error| error.to_string())?;
    let (mut sink, mut source) = socket.split();
    let (outgoing, mut outgoing_rx) = mpsc::unbounded_channel::<String>();

    let writer = tokio::spawn(async move {
        while let Some(text) = outgoing_rx.recv().await {
            if sink.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
    });
    let events = {
        let outgoing = outgoing.clone();
        let mut events = bidi.subscribe();
        tokio::spawn(async move {
            while let Ok(event) = events.recv().await {
                if outgoing.send(event.to_string()).is_err() {
                    break;
                }
            }
        })
    };

    // 这个客户端订阅的事件，断开时取消，不留给别人
    let subscriptions = Arc::new(tokio::sync::Mutex::new(Vec::<String>::new()));
    while let Some(Ok(message)) = source.next().await {
        let Message::Text(text) = message else { continue };
        let Ok(command) = serde_json::from_str::<Value>(text.as_str()) else { continue };
        let Some(id) = command.get("id").cloned() else { continue };
        let method = command.get("method").and_then(Value::as_str).unwrap_or("").to_string();
        let params = command.get("params").cloned().unwrap_or_else(|| json!({}));

        if method == "session.new" {
            let reply = json!({ "type": "success", "id": id, "result": {
                "sessionId": "mz-shared", "capabilities": capabilities,
            }});
            let _ = outgoing.send(reply.to_string());
            continue;
        }
        if BLOCKED.contains(&method.as_str()) {
            let reply = json!({ "type": "error", "id": id, "error": "unsupported operation",
                "message": format!("{method} is not allowed on a shared session") });
            let _ = outgoing.send(reply.to_string());
            continue;
        }

        let bidi = bidi.clone();
        let outgoing = outgoing.clone();
        let subscriptions = subscriptions.clone();
        tokio::spawn(async move {
            let mut reply = match bidi.send_raw(&method, params).await {
                Ok(response) => response,
                Err(message) => json!({ "type": "error", "error": "unknown error", "message": message }),
            };
            if method == "session.subscribe" {
                if let Some(subscription) = reply.pointer("/result/subscription").and_then(Value::as_str) {
                    subscriptions.lock().await.push(subscription.to_string());
                }
            }
            reply["id"] = id;
            let _ = outgoing.send(reply.to_string());
        });
    }

    events.abort();
    writer.abort();
    let subscriptions = std::mem::take(&mut *subscriptions.lock().await);
    if !subscriptions.is_empty() {
        let _ = bidi.call("session.unsubscribe", json!({ "subscriptions": subscriptions })).await;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;

    /// 假浏览器：回显 method，对 session.subscribe 给一个订阅号，并主动发一个事件
    async fn fake_browser() -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let socket = tokio_tungstenite::accept_async(stream).await.unwrap();
            let (mut sink, mut source) = socket.split();
            while let Some(Ok(Message::Text(text))) = source.next().await {
                let command: Value = serde_json::from_str(text.as_str()).unwrap();
                let method = command["method"].as_str().unwrap().to_string();
                let result = if method == "session.subscribe" {
                    json!({ "subscription": "sub-1" })
                } else {
                    json!({ "echo": method })
                };
                let reply = json!({ "type": "success", "id": command["id"], "result": result });
                sink.send(Message::Text(reply.to_string().into())).await.unwrap();
                let event = json!({ "type": "event", "method": "log.entryAdded", "params": {} });
                sink.send(Message::Text(event.to_string().into())).await.unwrap();
            }
        });
        port
    }

    async fn call(socket: &mut tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<TcpStream>>, id: u64, method: &str) -> Value {
        socket
            .send(Message::Text(json!({ "id": id, "method": method, "params": {} }).to_string().into()))
            .await
            .unwrap();
        loop {
            let Message::Text(text) = socket.next().await.unwrap().unwrap() else { continue };
            let value: Value = serde_json::from_str(text.as_str()).unwrap();
            if value.get("id") == Some(&json!(id)) {
                return value;
            }
        }
    }

    #[tokio::test]
    async fn clients_keep_their_own_ids_and_cannot_end_the_shared_session() {
        let browser = fake_browser().await;
        let bidi = BidiConnection::connect(&format!("ws://127.0.0.1:{browser}/session")).await.unwrap();
        let relay = start(bidi, json!({ "browserName": "firefox" })).await.unwrap();
        let (mut client, _) = tokio_tungstenite::connect_async(relay_url(relay.port)).await.unwrap();

        let reply = call(&mut client, 7, "session.new").await;
        assert_eq!(reply["result"]["capabilities"]["browserName"], "firefox");
        let reply = call(&mut client, 8, "browsingContext.getTree").await;
        assert_eq!(reply["type"], "success");
        assert_eq!(reply["result"]["echo"], "browsingContext.getTree");
        assert_eq!(call(&mut client, 9, "browser.close").await["type"], "error");
        assert_eq!(call(&mut client, 10, "session.end").await["type"], "error");
    }

    #[tokio::test]
    async fn web_pages_cannot_connect_but_the_app_can() {
        let browser = fake_browser().await;
        let bidi = BidiConnection::connect(&format!("ws://127.0.0.1:{browser}/session")).await.unwrap();
        let relay = start(bidi, json!({})).await.unwrap();

        let mut request = relay_url(relay.port).into_client_request().unwrap();
        request.headers_mut().insert("origin", "https://evil.example".parse().unwrap());
        assert!(tokio_tungstenite::connect_async(request).await.is_err());

        let mut request = relay_url(relay.port).into_client_request().unwrap();
        request.headers_mut().insert("origin", "http://tauri.localhost".parse().unwrap());
        assert!(tokio_tungstenite::connect_async(request).await.is_ok());

        let wrong_path = format!("ws://127.0.0.1:{}/other", relay.port);
        assert!(tokio_tungstenite::connect_async(wrong_path).await.is_err());
    }
}
