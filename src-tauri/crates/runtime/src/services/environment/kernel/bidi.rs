//! 最小的 WebDriver BiDi 客户端：一条 WebSocket，命令按 id 配对，事件广播出去。
//!
//! Firefox 一个浏览器只允许一个 BiDi 会话，而且会话随创建它的连接一起结束，
//! 所以每个 Firefox 环境由运行时持有唯一的一条连接。

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use tokio::sync::{Mutex, broadcast, mpsc, oneshot};
use tokio_tungstenite::tungstenite::Message;

const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Value>>>>;

pub struct BidiConnection {
    outgoing: mpsc::UnboundedSender<Message>,
    pending: Pending,
    next_id: AtomicU64,
    events: broadcast::Sender<Value>,
    closed: Arc<AtomicBool>,
}

impl BidiConnection {
    pub async fn connect(url: &str) -> Result<Arc<Self>, String> {
        let (socket, _) = tokio_tungstenite::connect_async(url)
            .await
            .map_err(|error| format!("连接 BiDi 失败 {url}: {error}"))?;
        let (mut sink, mut stream) = socket.split();
        let (outgoing, mut outgoing_rx) = mpsc::unbounded_channel::<Message>();
        let pending: Pending = Arc::new(Mutex::new(HashMap::new()));
        let (events, _) = broadcast::channel(256);
        let closed = Arc::new(AtomicBool::new(false));

        tokio::spawn(async move {
            while let Some(message) = outgoing_rx.recv().await {
                if sink.send(message).await.is_err() {
                    break;
                }
            }
            let _ = sink.close().await;
        });

        {
            let pending = pending.clone();
            let events = events.clone();
            let closed = closed.clone();
            tokio::spawn(async move {
                while let Some(Ok(message)) = stream.next().await {
                    let Message::Text(text) = message else { continue };
                    let Ok(value) = serde_json::from_str::<Value>(text.as_str()) else { continue };
                    match value.get("id").and_then(Value::as_u64) {
                        Some(id) if value.get("type").and_then(Value::as_str) != Some("event") => {
                            if let Some(sender) = pending.lock().await.remove(&id) {
                                let _ = sender.send(value);
                            }
                        }
                        _ => {
                            let _ = events.send(value);
                        }
                    }
                }
                closed.store(true, Ordering::SeqCst);
                // 连接断了，等着的命令全部失败，不让调用方一直卡住
                pending.lock().await.clear();
            });
        }

        Ok(Arc::new(Self {
            outgoing,
            pending,
            next_id: AtomicU64::new(1),
            events,
            closed,
        }))
    }

    pub fn is_closed(&self) -> bool {
        self.closed.load(Ordering::SeqCst)
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Value> {
        self.events.subscribe()
    }

    /// 发一条命令，返回完整的响应（`type` 为 success 或 error）。
    pub async fn send_raw(&self, method: &str, params: Value) -> Result<Value, String> {
        if self.is_closed() {
            return Err("BiDi 连接已断开".into());
        }
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (sender, receiver) = oneshot::channel();
        self.pending.lock().await.insert(id, sender);
        let payload = json!({ "id": id, "method": method, "params": params }).to_string();
        if self.outgoing.send(Message::Text(payload.into())).is_err() {
            self.pending.lock().await.remove(&id);
            return Err("BiDi 连接已断开".into());
        }
        match tokio::time::timeout(COMMAND_TIMEOUT, receiver).await {
            Ok(Ok(response)) => Ok(response),
            Ok(Err(_)) => Err(format!("BiDi 连接在 {method} 返回前断开")),
            Err(_) => {
                self.pending.lock().await.remove(&id);
                Err(format!("BiDi 命令 {method} 超时"))
            }
        }
    }

    /// 发一条命令，成功时返回 `result`，失败时返回错误说明。
    pub async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let response = self.send_raw(method, params).await?;
        if response.get("type").and_then(Value::as_str) == Some("success") {
            return Ok(response.get("result").cloned().unwrap_or(Value::Null));
        }
        let error = response.get("error").and_then(Value::as_str).unwrap_or("unknown error");
        let message = response.get("message").and_then(Value::as_str).unwrap_or("");
        Err(format!("BiDi {method} 失败：{error} {message}").trim_end().to_string())
    }
}
