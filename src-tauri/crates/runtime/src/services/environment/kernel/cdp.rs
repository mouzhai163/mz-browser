use crate::app::{Result, RuntimeError};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::net::TcpListener;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

const CDP_HOST: &str = "127.0.0.1";
const CDP_PORT_START: u16 = 29200;
const CDP_PORT_END: u16 = 29499;
const DEBUG_TOKEN_PARAM: &str = "mz_token";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CdpEndpointInfo {
    pub env_uuid: String,
    pub host: String,
    pub port: u16,
    pub version_url: String,
    pub list_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub browser_ws_url: Option<String>,
}

/// 一个环境的调试端口和访问令牌
#[derive(Clone)]
struct CdpSlot {
    port: u16,
    token: String,
}

/// 访问令牌：内核校验调试端口的每个请求，本机其他程序不知道令牌就连不上。
fn new_debug_token() -> String {
    rand::random::<[u8; 32]>().iter().map(|byte| format!("{byte:02x}")).collect()
}

pub struct CdpEndpointManager {
    slots: Arc<RwLock<HashMap<String, CdpSlot>>>,
}

impl CdpEndpointManager {
    pub fn new() -> Self {
        Self {
            slots: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn allocate(&self, env_uuid: &str) -> Result<CdpSlot> {
        {
            let slots = self.slots.read().await;
            if let Some(slot) = slots.get(env_uuid) {
                return Ok(slot.clone());
            }
        }

        let mut slots = self.slots.write().await;
        if let Some(slot) = slots.get(env_uuid) {
            return Ok(slot.clone());
        }

        let used_ports: HashSet<u16> = slots.values().map(|slot| slot.port).collect();
        let port = find_available_port(&used_ports).ok_or_else(|| {
            RuntimeError::Internal("No available CDP port in configured range".into())
        })?;
        let slot = CdpSlot { port, token: new_debug_token() };
        slots.insert(env_uuid.to_string(), slot.clone());
        Ok(slot)
    }

    pub async fn allocate_port(&self, env_uuid: &str) -> Result<u16> {
        Ok(self.allocate(env_uuid).await?.port)
    }

    /// 分配调试端口和访问令牌
    pub async fn allocate_with_token(&self, env_uuid: &str) -> Result<(u16, String)> {
        let slot = self.allocate(env_uuid).await?;
        Ok((slot.port, slot.token))
    }

    pub async fn remove(&self, env_uuid: &str) {
        let mut slots = self.slots.write().await;
        slots.remove(env_uuid);
    }

    pub async fn clear_all(&self) {
        let mut slots = self.slots.write().await;
        slots.clear();
    }

    pub async fn get_port(&self, env_uuid: &str) -> Option<u16> {
        let slots = self.slots.read().await;
        slots.get(env_uuid).map(|slot| slot.port)
    }

    pub async fn get_endpoint(&self, env_uuid: &str) -> Option<CdpEndpointInfo> {
        let CdpSlot { port, token } = self.slots.read().await.get(env_uuid)?.clone();
        let version_url = debug_url(port, "version", &token);
        let list_url = debug_url(port, "list", &token);
        let browser_ws_url = query_browser_ws_url(&version_url).await;

        Some(CdpEndpointInfo {
            env_uuid: env_uuid.to_string(),
            host: CDP_HOST.to_string(),
            port,
            version_url,
            list_url,
            browser_ws_url,
        })
    }
}

impl Default for CdpEndpointManager {
    fn default() -> Self {
        Self::new()
    }
}

fn find_available_port(used_ports: &HashSet<u16>) -> Option<u16> {
    for port in CDP_PORT_START..=CDP_PORT_END {
        if used_ports.contains(&port) {
            continue;
        }

        if TcpListener::bind((CDP_HOST, port)).is_ok() {
            return Some(port);
        }
    }

    None
}

/// DevTools 接口地址。旧内核不校验令牌，查询串会被忽略。
pub(super) fn debug_url(port: u16, command: &str, token: &str) -> String {
    format!("http://{CDP_HOST}:{port}/json/{command}?{DEBUG_TOKEN_PARAM}={token}")
}

async fn query_browser_ws_url(version_url: &str) -> Option<String> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(1))
        .build()
        .ok()?;
    let response = client.get(version_url).send().await.ok()?;
    let payload = response.json::<serde_json::Value>().await.ok()?;
    payload
        .get("webSocketDebuggerUrl")
        .and_then(|value| value.as_str())
        .map(ToOwned::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn each_environment_gets_its_own_stable_token() {
        let manager = CdpEndpointManager::new();
        let (port, token) = manager.allocate_with_token("env-1").await.unwrap();
        assert_eq!(token.len(), 64);
        assert!(token.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(manager.allocate_with_token("env-1").await.unwrap(), (port, token.clone()));
        assert_ne!(manager.allocate_with_token("env-2").await.unwrap().1, token);
    }

    #[tokio::test]
    async fn endpoint_urls_carry_the_token() {
        let manager = CdpEndpointManager::new();
        let (port, token) = manager.allocate_with_token("env-1").await.unwrap();
        let endpoint = manager.get_endpoint("env-1").await.unwrap();
        assert_eq!(endpoint.version_url, format!("http://127.0.0.1:{port}/json/version?mz_token={token}"));
        assert_eq!(endpoint.list_url, format!("http://127.0.0.1:{port}/json/list?mz_token={token}"));
    }
}
