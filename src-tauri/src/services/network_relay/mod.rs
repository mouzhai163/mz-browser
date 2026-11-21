pub mod chain_forwarder;
pub mod core_process;
pub mod parser;
pub mod system_proxy;
pub mod types;

use std::path::PathBuf;
use std::time::Duration;

use chrono::Utc;
use futures::{StreamExt, stream};
use reqwest::Client;
use tauri::AppHandle;
use uuid::Uuid;

use crate::infrastructure::persistence::tauri_store;
use crate::services::environment::ProxyConfig;

use self::chain_forwarder::{ChainForwarderManager, PreProxy, TargetProxy};
use self::core_process::ManagedMihomoCore;
use self::parser::{build_manual_node, parse_share_links, parse_subscription_content};
use self::system_proxy::detect_system_proxy;
use self::types::{
    AddGroupRequest, AddNodesRequest, AddSubscriptionRequest, DEFAULT_LOCAL_GROUP_ID, NetworkMode,
    NetworkRelayConfig, NetworkRelayState, RelayDelayResult, RelayGroup, RelayGroupKind, RelayNode,
    default_local_group,
};

const NETWORK_RELAY_STORE_KEY: &str = "network.relay_config";

pub struct NetworkRelayManager {
    core: ManagedMihomoCore,
    forwarder: ChainForwarderManager,
}

impl NetworkRelayManager {
    pub fn new() -> Self {
        Self {
            core: ManagedMihomoCore::new(),
            forwarder: ChainForwarderManager::new(),
        }
    }

    /// 获取完整网络配置状态（中转模式下如内核已安装但尚未启动，则自动拉起）
    pub async fn get_state(&self, app: &AppHandle) -> NetworkRelayState {
        let config = load_config(app);
        if config.mode == NetworkMode::Relay && self.core.running_mixed_port().await.is_none() {
            if let Ok(path) =
                ManagedMihomoCore::resolve_core_path(config.custom_core_path.as_deref())
            {
                if path.is_file() {
                    let nodes = collect_all_nodes(&config);
                    let _ = self
                        .core
                        .sync_and_start(
                            config.custom_core_path.as_deref(),
                            &nodes,
                            config.selected_node_id.as_deref(),
                        )
                        .await;
                }
            }
        }
        let core_status = self.core.status(config.custom_core_path.as_deref()).await;
        let system_proxy = detect_system_proxy();
        let active_node = find_selected_node(&config).cloned();

        NetworkRelayState {
            config,
            core_status,
            system_proxy,
            active_node,
        }
    }

    /// 切换网络模式（直接连接 / 系统代理 / 中转节点）
    pub async fn set_mode(
        &self,
        app: &AppHandle,
        mode: NetworkMode,
    ) -> Result<NetworkRelayState, String> {
        let mut config = load_config(app);
        config.mode = mode;

        // 切到中转模式且内核已安装时，自动启动托管内核；否则停止旧转发端口
        self.forwarder.stop_all().await;

        if mode == NetworkMode::Relay {
            let nodes = collect_all_nodes(&config);
            let core_path =
                ManagedMihomoCore::resolve_core_path(config.custom_core_path.as_deref())?;
            if core_path.is_file() {
                if let Err(err) = self
                    .core
                    .sync_and_start(
                        config.custom_core_path.as_deref(),
                        &nodes,
                        config.selected_node_id.as_deref(),
                    )
                    .await
                {
                    log::warn!("auto start managed mihomo failed: {err}");
                }
            }
        } else {
            self.core.stop().await;
        }

        save_config(app, &config)?;
        Ok(self.get_state(app).await)
    }

    /// 选中某个中转节点
    pub async fn select_node(
        &self,
        app: &AppHandle,
        group_id: String,
        node_id: String,
    ) -> Result<NetworkRelayState, String> {
        let mut config = load_config(app);
        let exists = config
            .groups
            .iter()
            .find(|g| g.id == group_id)
            .is_some_and(|g| g.nodes.iter().any(|n| n.id == node_id));
        if !exists {
            return Err("未找到指定的中转节点".to_string());
        }

        config.selected_group_id = Some(group_id);
        config.selected_node_id = Some(node_id.clone());
        save_config(app, &config)?;

        if config.mode == NetworkMode::Relay {
            let core_path =
                ManagedMihomoCore::resolve_core_path(config.custom_core_path.as_deref())?;
            if core_path.is_file() {
                if self.core.running_mixed_port().await.is_some() {
                    if self.core.switch_active_node(&node_id).await.is_err() {
                        let nodes = collect_all_nodes(&config);
                        self.core
                            .sync_and_start(
                                config.custom_core_path.as_deref(),
                                &nodes,
                                Some(&node_id),
                            )
                            .await?;
                    }
                } else {
                    let nodes = collect_all_nodes(&config);
                    self.core
                        .sync_and_start(config.custom_core_path.as_deref(), &nodes, Some(&node_id))
                        .await?;
                }
            }
        }

        Ok(self.get_state(app).await)
    }

    /// 添加订阅分组（拉取订阅并解析节点）
    pub async fn add_subscription(
        &self,
        app: &AppHandle,
        request: AddSubscriptionRequest,
    ) -> Result<NetworkRelayState, String> {
        let url = request.url.trim().to_string();
        if url.is_empty() || (!url.starts_with("http://") && !url.starts_with("https://")) {
            return Err("请输入有效的 http:// 或 https:// 订阅链接".to_string());
        }
        let name = if request.name.trim().is_empty() {
            "自定义订阅".to_string()
        } else {
            request.name.trim().to_string()
        };

        let content = fetch_subscription_text(&url).await?;
        let nodes = parse_subscription_content(&content)?;

        let mut config = load_config(app);
        let group_id = Uuid::new_v4().to_string();
        let first_node_id = nodes.first().map(|n| n.id.clone());

        config.groups.push(RelayGroup {
            id: group_id.clone(),
            name,
            kind: RelayGroupKind::Subscription,
            subscription_url: Some(url),
            updated_at: Some(now_iso()),
            nodes,
        });

        // 如果当前还没选中任何节点，自动选中第一个
        if config.selected_node_id.is_none() {
            if let Some(nid) = first_node_id {
                config.selected_group_id = Some(group_id);
                config.selected_node_id = Some(nid);
            }
        }

        save_config(app, &config)?;
        self.sync_core_if_running(&config).await;
        Ok(self.get_state(app).await)
    }

    /// 刷新订阅分组
    pub async fn refresh_subscription(
        &self,
        app: &AppHandle,
        group_id: String,
    ) -> Result<NetworkRelayState, String> {
        let mut config = load_config(app);
        let url = config
            .groups
            .iter()
            .find(|g| g.id == group_id)
            .and_then(|g| g.subscription_url.clone())
            .ok_or_else(|| "未找到该订阅分组或缺少订阅链接".to_string())?;

        let content = fetch_subscription_text(&url).await?;
        let nodes = parse_subscription_content(&content)?;

        if let Some(group) = config.groups.iter_mut().find(|g| g.id == group_id) {
            let prev_selected_name = config
                .selected_node_id
                .as_deref()
                .and_then(|id| group.nodes.iter().find(|n| n.id == id))
                .map(|n| n.name.clone());

            group.nodes = nodes;
            group.updated_at = Some(now_iso());

            // 尝试按节点名称保持原选中状态
            if config.selected_group_id.as_deref() == Some(group_id.as_str()) {
                let matched_id = prev_selected_name
                    .and_then(|name| {
                        group.nodes.iter().find(|n| n.name == name).map(|n| n.id.clone())
                    })
                    .or_else(|| group.nodes.first().map(|n| n.id.clone()));
                config.selected_node_id = matched_id;
            }
        }

        save_config(app, &config)?;
        self.sync_core_if_running(&config).await;
        Ok(self.get_state(app).await)
    }

    /// 新建本地分组
    pub async fn add_group(
        &self,
        app: &AppHandle,
        request: AddGroupRequest,
    ) -> Result<NetworkRelayState, String> {
        let name = request.name.trim().to_string();
        if name.is_empty() {
            return Err("分组名称不能为空".to_string());
        }

        let mut config = load_config(app);
        config.groups.push(RelayGroup {
            id: Uuid::new_v4().to_string(),
            name,
            kind: RelayGroupKind::Local,
            subscription_url: None,
            updated_at: Some(now_iso()),
            nodes: Vec::new(),
        });
        save_config(app, &config)?;
        Ok(self.get_state(app).await)
    }

    /// 删除分组（默认分组不可删除）
    pub async fn delete_group(
        &self,
        app: &AppHandle,
        group_id: String,
    ) -> Result<NetworkRelayState, String> {
        if group_id == DEFAULT_LOCAL_GROUP_ID {
            return Err("默认分组不可删除".to_string());
        }

        let mut config = load_config(app);
        config.groups.retain(|g| g.id != group_id);
        if config.selected_group_id.as_deref() == Some(group_id.as_str()) {
            config.selected_group_id = None;
            config.selected_node_id = None;
        }
        save_config(app, &config)?;
        self.sync_core_if_running(&config).await;
        Ok(self.get_state(app).await)
    }

    /// 向指定分组添加节点（支持分享链接批量导入或手动表单）
    pub async fn add_nodes(
        &self,
        app: &AppHandle,
        request: AddNodesRequest,
    ) -> Result<NetworkRelayState, String> {
        let mut new_nodes = Vec::new();
        if let Some(raw) = request.raw_links.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            let parsed = parse_share_links(raw);
            if parsed.is_empty() {
                return Err("未能识别有效的节点分享链接（支持 vmess/vless/trojan/ss/hysteria2/socks5/http）".to_string());
            }
            new_nodes.extend(parsed);
        }
        if let Some(manual) = request.manual_node.as_ref() {
            new_nodes.push(build_manual_node(manual)?);
        }
        if new_nodes.is_empty() {
            return Err("请填写节点链接或手动配置".to_string());
        }

        let mut config = load_config(app);
        let target_group_id = request.group_id;
        let first_added_id = new_nodes.first().map(|n| n.id.clone());

        let group = config
            .groups
            .iter_mut()
            .find(|g| g.id == target_group_id)
            .ok_or_else(|| "目标分组不存在".to_string())?;
        group.nodes.extend(new_nodes);
        group.updated_at = Some(now_iso());

        if config.selected_node_id.is_none() {
            if let Some(nid) = first_added_id {
                config.selected_group_id = Some(group.id.clone());
                config.selected_node_id = Some(nid);
            }
        }

        save_config(app, &config)?;
        self.sync_core_if_running(&config).await;
        Ok(self.get_state(app).await)
    }

    /// 删除节点
    pub async fn delete_node(
        &self,
        app: &AppHandle,
        group_id: String,
        node_id: String,
    ) -> Result<NetworkRelayState, String> {
        let mut config = load_config(app);
        if let Some(group) = config.groups.iter_mut().find(|g| g.id == group_id) {
            group.nodes.retain(|n| n.id != node_id);
        }
        if config.selected_node_id.as_deref() == Some(node_id.as_str()) {
            config.selected_node_id = None;
        }
        save_config(app, &config)?;
        self.sync_core_if_running(&config).await;
        Ok(self.get_state(app).await)
    }

    /// 一键下载并安装内置 Mihomo 内核
    pub async fn install_core(&self, app: &AppHandle) -> Result<NetworkRelayState, String> {
        let path = self.core.install_builtin_core().await?;
        let mut config = load_config(app);
        config.custom_core_path = None;
        save_config(app, &config)?;

        if config.mode == NetworkMode::Relay {
            let nodes = collect_all_nodes(&config);
            let _ = self
                .core
                .sync_and_start(
                    Some(&path.to_string_lossy()),
                    &nodes,
                    config.selected_node_id.as_deref(),
                )
                .await;
        }

        Ok(self.get_state(app).await)
    }

    /// 手动指定本地 mihomo.exe 路径
    pub async fn set_custom_core_path(
        &self,
        app: &AppHandle,
        core_path: String,
    ) -> Result<NetworkRelayState, String> {
        let path = PathBuf::from(core_path.trim());
        if !path.is_file() {
            return Err("指定的内核文件不存在".to_string());
        }

        let mut config = load_config(app);
        config.custom_core_path = Some(path.to_string_lossy().into_owned());
        save_config(app, &config)?;

        self.core.stop().await;
        if config.mode == NetworkMode::Relay {
            let nodes = collect_all_nodes(&config);
            self.core
                .sync_and_start(
                    config.custom_core_path.as_deref(),
                    &nodes,
                    config.selected_node_id.as_deref(),
                )
                .await?;
        }

        Ok(self.get_state(app).await)
    }

    /// 测试单个中转节点延迟
    pub async fn test_node_delay(
        &self,
        app: &AppHandle,
        group_id: String,
        node_id: String,
    ) -> Result<RelayDelayResult, String> {
        let mut config = load_config(app);
        self.ensure_core_ready(&config).await?;

        let node_name = config
            .groups
            .iter()
            .find(|g| g.id == group_id)
            .and_then(|g| g.nodes.iter().find(|n| n.id == node_id))
            .map(|n| n.name.clone())
            .ok_or_else(|| "未找到指定节点".to_string())?;

        let delay_ms = self.core.test_node_delay(&node_id).await?;
        if let Some(node) = config
            .groups
            .iter_mut()
            .find(|g| g.id == group_id)
            .and_then(|g| g.nodes.iter_mut().find(|n| n.id == node_id))
        {
            node.latency_ms = delay_ms;
        }
        let _ = save_config(app, &config);

        Ok(RelayDelayResult {
            node_id,
            name: node_name,
            available: delay_ms.is_some(),
            delay_ms,
        })
    }

    /// 批量测试分组内所有节点延迟
    pub async fn test_group_delays(
        &self,
        app: &AppHandle,
        group_id: String,
    ) -> Result<Vec<RelayDelayResult>, String> {
        let mut config = load_config(app);
        self.ensure_core_ready(&config).await?;

        let targets: Vec<(String, String)> = config
            .groups
            .iter()
            .find(|g| g.id == group_id)
            .ok_or_else(|| "未找到指定分组".to_string())?
            .nodes
            .iter()
            .map(|n| (n.id.clone(), n.name.clone()))
            .collect();

        let results = stream::iter(targets.into_iter().map(|(node_id, name)| async move {
            let delay_ms = self.core.test_node_delay(&node_id).await.ok().flatten();
            RelayDelayResult {
                node_id,
                name,
                available: delay_ms.is_some(),
                delay_ms,
            }
        }))
        .buffered(6)
        .collect::<Vec<_>>()
        .await;

        if let Some(group) = config.groups.iter_mut().find(|g| g.id == group_id) {
            for res in &results {
                if let Some(node) = group.nodes.iter_mut().find(|n| n.id == res.node_id) {
                    node.latency_ms = res.delay_ms;
                }
            }
        }
        let _ = save_config(app, &config);

        Ok(results)
    }

    /// 核心出口解析：把环境/测速原本的 `target_proxy` 结合当前全局「网络配置」包装成最终生效的 `ProxyConfig`
    ///
    /// - Direct: 原样返回 target_proxy
    /// - SystemProxy: 客户端 -> 系统代理 -> (target_proxy) -> 目标网站
    /// - Relay: 客户端 -> 中转节点(Mihomo) -> (target_proxy) -> 目标网站
    pub async fn resolve_effective_proxy(
        &self,
        app: &AppHandle,
        target_proxy: Option<ProxyConfig>,
    ) -> Result<Option<ProxyConfig>, String> {
        let config = load_config(app);
        match config.mode {
            NetworkMode::Direct => Ok(target_proxy),
            NetworkMode::SystemProxy => {
                let sys = detect_system_proxy();
                if !sys.enabled {
                    return Err(
                        "当前网络模式为「系统代理」，但未检测到已开启的系统代理".to_string()
                    );
                }
                let host = sys.host.ok_or("系统代理地址无效")?;
                let port = sys.port.ok_or("系统代理端口无效")?;

                match target_proxy {
                    None => Ok(Some(ProxyConfig {
                        host,
                        port,
                        proxy_type: sys.scheme,
                        username: None,
                        password: None,
                    })),
                    Some(target) => {
                        let pre = if sys.scheme == "socks5" {
                            PreProxy::Socks5 { host, port }
                        } else {
                            PreProxy::Http { host, port }
                        };
                        let local_port = self
                            .forwarder
                            .ensure_chain_port(pre, to_target_proxy(&target)?)
                            .await?;
                        Ok(Some(ProxyConfig {
                            host: "127.0.0.1".to_string(),
                            port: local_port,
                            proxy_type: "http".to_string(),
                            username: None,
                            password: None,
                        }))
                    }
                }
            }
            NetworkMode::Relay => {
                if find_selected_node(&config).is_none() {
                    return Err(
                        "当前为「中转节点」模式，请先在代理中心 -> 网络配置中选择一个中转节点"
                            .to_string(),
                    );
                }
                self.ensure_core_ready(&config).await?;
                let mixed_port =
                    self.core.running_mixed_port().await.ok_or("内置中转内核未运行")?;

                match target_proxy {
                    None => Ok(Some(ProxyConfig {
                        host: "127.0.0.1".to_string(),
                        port: mixed_port,
                        proxy_type: "http".to_string(),
                        username: None,
                        password: None,
                    })),
                    Some(target) => {
                        let pre = PreProxy::Socks5 {
                            host: "127.0.0.1".to_string(),
                            port: mixed_port,
                        };
                        let local_port = self
                            .forwarder
                            .ensure_chain_port(pre, to_target_proxy(&target)?)
                            .await?;
                        Ok(Some(ProxyConfig {
                            host: "127.0.0.1".to_string(),
                            port: local_port,
                            proxy_type: "http".to_string(),
                            username: None,
                            password: None,
                        }))
                    }
                }
            }
        }
    }

    /// 供代理测速服务（使用 infrastructure::proxy::ProxyConfig）复用
    pub async fn resolve_effective_infra_proxy(
        &self,
        app: &AppHandle,
        target: crate::infrastructure::proxy::ProxyConfig,
    ) -> Result<crate::infrastructure::proxy::ProxyConfig, String> {
        let env_proxy = ProxyConfig {
            host: target.host,
            port: target.port,
            proxy_type: target.proxy_type.to_string(),
            username: target.username,
            password: target.password,
        };
        let resolved = self
            .resolve_effective_proxy(app, Some(env_proxy))
            .await?
            .ok_or("解析有效代理失败")?;
        Ok(resolved.to_infrastructure_proxy_config())
    }

    /// 应用退出时清理所有托管进程和转发端口
    pub async fn shutdown(&self) {
        self.forwarder.stop_all().await;
        self.core.stop().await;
    }

    async fn ensure_core_ready(&self, config: &NetworkRelayConfig) -> Result<(), String> {
        if self.core.running_mixed_port().await.is_some() {
            return Ok(());
        }
        let nodes = collect_all_nodes(config);
        self.core
            .sync_and_start(
                config.custom_core_path.as_deref(),
                &nodes,
                config.selected_node_id.as_deref(),
            )
            .await?;
        Ok(())
    }

    async fn sync_core_if_running(&self, config: &NetworkRelayConfig) {
        if config.mode == NetworkMode::Relay {
            let core_path =
                ManagedMihomoCore::resolve_core_path(config.custom_core_path.as_deref());
            if let Ok(path) = core_path {
                if path.is_file() {
                    let nodes = collect_all_nodes(config);
                    let _ = self
                        .core
                        .sync_and_start(
                            config.custom_core_path.as_deref(),
                            &nodes,
                            config.selected_node_id.as_deref(),
                        )
                        .await;
                }
            }
        }
    }
}

impl Default for NetworkRelayManager {
    fn default() -> Self {
        Self::new()
    }
}

fn to_target_proxy(proxy: &ProxyConfig) -> Result<TargetProxy, String> {
    let password = match proxy.password.as_ref() {
        Some(p) => Some(p.get_plain_password().map_err(|e| format!("代理密码解密失败: {e}"))?),
        None => None,
    };
    Ok(TargetProxy {
        scheme: proxy.proxy_type.clone(),
        host: proxy.host.clone(),
        port: proxy.port,
        username: proxy.username.clone(),
        password,
    })
}

fn collect_all_nodes(config: &NetworkRelayConfig) -> Vec<RelayNode> {
    config.groups.iter().flat_map(|g| g.nodes.iter().cloned()).collect()
}

fn find_selected_node(config: &NetworkRelayConfig) -> Option<&RelayNode> {
    let node_id = config.selected_node_id.as_deref()?;
    config.groups.iter().flat_map(|g| g.nodes.iter()).find(|n| n.id == node_id)
}

fn load_config(app: &AppHandle) -> NetworkRelayConfig {
    let mut cfg: NetworkRelayConfig = tauri_store::get_store_key(app, NETWORK_RELAY_STORE_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    if !cfg.groups.iter().any(|g| g.id == DEFAULT_LOCAL_GROUP_ID) {
        cfg.groups.insert(0, default_local_group());
    }
    cfg
}

fn save_config(app: &AppHandle, config: &NetworkRelayConfig) -> Result<(), String> {
    let val = serde_json::to_value(config).map_err(|e| e.to_string())?;
    tauri_store::set_store_key(app, NETWORK_RELAY_STORE_KEY, val)
}

async fn fetch_subscription_text(url: &str) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("clash-verge/v2.0.0")
        .build()
        .map_err(|e| format!("构建请求客户端失败: {e}"))?;

    let resp = client.get(url).send().await.map_err(|e| format!("拉取订阅链接失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("订阅服务器返回错误状态: {}", resp.status()));
    }

    resp.text().await.map_err(|e| format!("读取订阅内容失败: {e}"))
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}
