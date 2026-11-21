use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum NetworkMode {
    #[default]
    Direct,
    SystemProxy,
    Relay,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RelayGroupKind {
    Local,
    Subscription,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayNode {
    pub id: String,
    pub name: String,
    pub protocol: String,
    pub server: String,
    pub port: u16,
    /// 标准 Mihomo proxy 配置对象（JSON 存储，生成配置时转为 YAML）
    pub raw_proxy: JsonValue,
    #[serde(default)]
    pub latency_ms: Option<u32>,
    #[serde(default)]
    pub country_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayGroup {
    pub id: String,
    pub name: String,
    pub kind: RelayGroupKind,
    #[serde(default)]
    pub subscription_url: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub nodes: Vec<RelayNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkRelayConfig {
    #[serde(default)]
    pub mode: NetworkMode,
    #[serde(default)]
    pub selected_group_id: Option<String>,
    #[serde(default)]
    pub selected_node_id: Option<String>,
    #[serde(default)]
    pub groups: Vec<RelayGroup>,
    #[serde(default)]
    pub custom_core_path: Option<String>,
}

impl Default for NetworkRelayConfig {
    fn default() -> Self {
        Self {
            mode: NetworkMode::Direct,
            selected_group_id: None,
            selected_node_id: None,
            groups: vec![default_local_group()],
            custom_core_path: None,
        }
    }
}

pub const DEFAULT_LOCAL_GROUP_ID: &str = "default-local-group";

pub fn default_local_group() -> RelayGroup {
    RelayGroup {
        id: DEFAULT_LOCAL_GROUP_ID.to_string(),
        name: "默认分组".to_string(),
        kind: RelayGroupKind::Local,
        subscription_url: None,
        updated_at: None,
        nodes: Vec::new(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemProxyInfo {
    pub enabled: bool,
    pub server: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub scheme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayCoreStatus {
    pub installed: bool,
    pub running: bool,
    pub core_path: String,
    pub mixed_port: u16,
    pub controller_port: u16,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkRelayState {
    pub config: NetworkRelayConfig,
    pub core_status: RelayCoreStatus,
    pub system_proxy: SystemProxyInfo,
    pub active_node: Option<RelayNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayDelayResult {
    pub node_id: String,
    pub name: String,
    pub available: bool,
    pub delay_ms: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddSubscriptionRequest {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddGroupRequest {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddNodesRequest {
    pub group_id: String,
    /// 支持多行分享链接（vmess:// vless:// trojan:// ss:// socks5:// http:// hysteria2://）
    pub raw_links: Option<String>,
    /// 或者手动表单添加单个 HTTP/SOCKS5 节点
    pub manual_node: Option<ManualNodeInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualNodeInput {
    pub name: String,
    pub protocol: String, // http | https | socks5
    pub server: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
}
