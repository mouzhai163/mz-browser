use std::collections::{HashMap, HashSet};

use chrono::Utc;
use futures::{StreamExt, stream};
use serde_json::json;
use serde_yaml::{Mapping, Number, Sequence, Value};
use uuid::Uuid;

use crate::infrastructure::mihomo::{
    ApplyMihomoNodeSelectionRequest, MihomoClient, MihomoConnectionConfig, MihomoConnectionInfo,
    MihomoGroupOverview, MihomoLocalProxy, MihomoNodeOverview, MihomoNodeSelectionSnapshot,
    MihomoOverview, MihomoProviderOverview, MihomoProxyDelayResult, MihomoStatus,
    RawProxiesResponse, RawProxy, UpdateMihomoLocalProxyRequest, detect_default_mihomo_config_path,
};
use crate::infrastructure::persistence::tauri_store;

const DEFAULT_DELAY_TEST_URL: &str = "https://www.apple.com/library/test/success.html";
const DEFAULT_DELAY_TIMEOUT_MS: u64 = 5000;
const MIHOMO_SELECTION_STORE_KEY: &str = "mihomo.local_node_selection";
const MIHOMO_LOCAL_PROXIES_STORE_KEY: &str = "mihomo.local_proxies";
const MIHOMO_CONNECTION_CONFIG_STORE_KEY: &str = "mihomo.connection_config";
const LOCAL_PROXY_HOST: &str = "127.0.0.1";
const LOCAL_PROXY_SCHEME: &str = "http";
const LOCAL_PROXY_LISTENER_TYPE: &str = "http";
const LOCAL_PROXY_STATUS_UNKNOWN: &str = "unknown";
const LOCAL_PROXY_PORT_BASE: u16 = 17601;
const SIMPRINT_LISTENER_PREFIX: &str = "simprint-";

pub struct MihomoManager;

impl MihomoManager {
    pub fn new() -> Self {
        Self
    }

    pub async fn attach(
        &self,
        app: &tauri::AppHandle,
        config: MihomoConnectionConfig,
    ) -> Result<MihomoStatus, String> {
        let normalized_config = normalize_connection_config(config);
        let client = MihomoClient::new(&normalized_config).map_err(|error| error.to_string())?;
        let _ = build_overview(&normalized_config, &client)
            .await
            .map_err(|error| error.to_string())?;

        let controller = normalized_config.controller.clone();
        let config_path = normalized_config.config_path.clone();
        persist_connection_config(app, &normalized_config)?;

        Ok(MihomoStatus {
            attached: true,
            controller: Some(controller),
            config_path: Some(config_path),
        })
    }

    pub async fn status(&self, app: &tauri::AppHandle) -> MihomoStatus {
        let persisted = load_connection_config(app);
        let attached = if let Some(config) = persisted.as_ref() {
            match MihomoClient::new(config) {
                Ok(client) => client.fetch_version().await.is_ok(),
                Err(_) => false,
            }
        } else {
            false
        };

        MihomoStatus {
            attached,
            controller: persisted.as_ref().map(|config| config.controller.clone()),
            config_path: persisted.as_ref().map(|config| config.config_path.clone()),
        }
    }

    pub async fn connection_info(&self, app: &tauri::AppHandle) -> MihomoConnectionInfo {
        let persisted = load_connection_config(app);

        MihomoConnectionInfo {
            attached: persisted.is_some(),
            controller: persisted.as_ref().map(|config| config.controller.clone()),
            secret: persisted.as_ref().map(|config| config.secret.clone()),
            config_path: persisted.as_ref().map(|config| config.config_path.clone()),
        }
    }

    pub async fn overview(&self, app: &tauri::AppHandle) -> Result<MihomoOverview, String> {
        let config = require_connection_config(app)?;

        let client = MihomoClient::new(&config).map_err(|error| error.to_string())?;
        build_overview(&config, &client).await.map_err(|error| error.to_string())
    }

    pub async fn test_proxy_delay(
        &self,
        app: &tauri::AppHandle,
        proxy_name: String,
    ) -> Result<MihomoProxyDelayResult, String> {
        let config = require_connection_config(app)?;
        let client = MihomoClient::new(&config).map_err(|error| error.to_string())?;

        let delay_ms = client
            .test_proxy_delay(
                &proxy_name,
                DEFAULT_DELAY_TEST_URL,
                DEFAULT_DELAY_TIMEOUT_MS,
            )
            .await
            .ok()
            .flatten();

        Ok(MihomoProxyDelayResult {
            name: proxy_name,
            available: delay_ms.is_some(),
            delay_ms,
        })
    }

    pub async fn test_group_delays(
        &self,
        app: &tauri::AppHandle,
        group_name: String,
    ) -> Result<Vec<MihomoProxyDelayResult>, String> {
        let config = require_connection_config(app)?;
        let client = MihomoClient::new(&config).map_err(|error| error.to_string())?;
        let proxies = client.fetch_proxies().await.map_err(|error| error.to_string())?;

        let group = proxies
            .proxies
            .get(&group_name)
            .ok_or_else(|| format!("未找到策略组: {group_name}"))?;

        let leaf_nodes = group
            .all
            .iter()
            .filter(|candidate| {
                proxies
                    .proxies
                    .get(*candidate)
                    .is_some_and(|proxy| proxy.all.is_empty() && proxy.now.is_none())
            })
            .cloned()
            .collect::<Vec<_>>();

        let results = stream::iter(leaf_nodes.into_iter().map(|node_name| {
            let client = client.clone();
            async move {
                let delay_ms = client
                    .test_proxy_delay(&node_name, DEFAULT_DELAY_TEST_URL, DEFAULT_DELAY_TIMEOUT_MS)
                    .await
                    .ok()
                    .flatten();

                MihomoProxyDelayResult {
                    name: node_name,
                    available: delay_ms.is_some(),
                    delay_ms,
                }
            }
        }))
        .buffered(6)
        .collect::<Vec<_>>()
        .await;

        Ok(results)
    }

    pub async fn get_node_selection(
        &self,
        app: &tauri::AppHandle,
    ) -> Result<MihomoNodeSelectionSnapshot, String> {
        let config = require_connection_config(app)?;
        Ok(load_selection_snapshot(app)
            .filter(|snapshot| snapshot.controller == config.controller)
            .unwrap_or_else(|| empty_selection_snapshot(config.controller)))
    }

    pub async fn apply_node_selection(
        &self,
        app: &tauri::AppHandle,
        request: ApplyMihomoNodeSelectionRequest,
    ) -> Result<Vec<MihomoLocalProxy>, String> {
        let config = require_connection_config(app)?;
        let controller = config.controller.clone();
        let client = MihomoClient::new(&config).map_err(|error| error.to_string())?;
        let proxies = client.fetch_proxies().await.map_err(|error| error.to_string())?;
        let available_nodes = collect_leaf_node_names(&proxies);
        let selected_node_names = normalize_selected_node_names(request.selected_node_names);

        for node_name in &selected_node_names {
            if !available_nodes.contains(node_name) {
                return Err(format!("未找到节点: {node_name}"));
            }
        }

        let proxies = compile_local_proxies(&controller, &selected_node_names);
        sync_local_listeners(&client, &config.config_path, &proxies).await?;
        persist_selection_snapshot(
            app,
            &MihomoNodeSelectionSnapshot {
                controller: controller.clone(),
                selected_node_names,
                updated_at: now_iso_string(),
            },
        )?;
        persist_local_proxies(app, &proxies)?;

        Ok(proxies)
    }

    pub async fn get_local_proxies(
        &self,
        app: &tauri::AppHandle,
    ) -> Result<Vec<MihomoLocalProxy>, String> {
        let config = require_connection_config(app)?;
        Ok(load_local_proxies(app)
            .into_iter()
            .filter(|proxy| proxy.controller == config.controller)
            .collect())
    }

    pub async fn update_local_proxy(
        &self,
        app: &tauri::AppHandle,
        request: UpdateMihomoLocalProxyRequest,
    ) -> Result<MihomoLocalProxy, String> {
        let config = require_connection_config(app)?;
        let mut proxies = load_local_proxies(app);
        let proxy = proxies
            .iter_mut()
            .find(|proxy| proxy.controller == config.controller && proxy.id == request.id)
            .ok_or_else(|| "未找到对应的本地节点代理".to_string())?;

        proxy.status = normalize_local_proxy_status(&request.status);
        proxy.latency_ms = request.latency_ms;
        proxy.country = request.country.and_then(non_empty_string);
        proxy.country_code = request.country_code.and_then(non_empty_string);
        proxy.city = request.city.and_then(non_empty_string);
        proxy.updated_at = now_iso_string();

        let updated_proxy = proxy.clone();
        persist_local_proxies(app, &proxies)?;
        Ok(updated_proxy)
    }

    pub async fn ensure_local_proxy_listeners(
        &self,
        app: &tauri::AppHandle,
    ) -> Result<bool, String> {
        let config = require_connection_config(app)?;
        let proxies = load_local_proxies(app)
            .into_iter()
            .filter(|proxy| proxy.controller == config.controller)
            .collect::<Vec<_>>();

        if proxies.is_empty() {
            return Ok(false);
        }

        let client = MihomoClient::new(&config).map_err(|error| error.to_string())?;
        sync_local_listeners(&client, &config.config_path, &proxies).await?;
        Ok(true)
    }
}

async fn build_overview(
    config: &MihomoConnectionConfig,
    client: &MihomoClient,
) -> anyhow::Result<MihomoOverview> {
    let version = client.fetch_version().await?;
    let providers = client.fetch_providers().await?;
    let proxies = client.fetch_proxies().await?;

    let mut provider_nodes = HashMap::new();
    let mut provider_items = Vec::new();
    for (provider_key, provider) in providers.providers {
        let name = provider.name.unwrap_or_else(|| provider_key.clone());
        provider_items.push(MihomoProviderOverview {
            name: name.clone(),
            provider_type: provider.r#type,
            vehicle_type: provider.vehicle_type,
            updated_at: provider.updated_at,
            node_count: provider.proxies.len(),
        });

        for proxy in provider.proxies {
            provider_nodes.insert(proxy.name, name.clone());
        }
    }
    let groups = normalize_groups(&proxies);
    let mut nodes = Vec::new();
    for (name, proxy) in proxies.proxies {
        nodes.push(MihomoNodeOverview {
            source_provider: provider_nodes.get(&name).cloned(),
            name,
            node_type: proxy.r#type,
            alive: proxy.alive,
            udp: proxy.udp,
        });
    }

    Ok(MihomoOverview {
        controller: config.controller.clone(),
        version: version.version,
        providers: provider_items,
        groups,
        nodes,
    })
}

fn normalize_groups(proxies: &RawProxiesResponse) -> Vec<MihomoGroupOverview> {
    let mut groups: Vec<MihomoGroupOverview> = Vec::new();
    let mut group_names: HashSet<String> = HashSet::new();

    for (name, proxy) in &proxies.proxies {
        if !is_group_proxy(proxy) || name == "GLOBAL" {
            continue;
        }

        group_names.insert(name.clone());
        groups.push(MihomoGroupOverview {
            name: name.clone(),
            group_type: proxy.r#type.clone(),
            selected: proxy.now.clone(),
            candidates: proxy.all.clone(),
        });
    }

    let mut ordered_groups = Vec::with_capacity(groups.len());
    let mut inserted: HashSet<String> = HashSet::new();

    if let Some(global) = proxies.proxies.get("GLOBAL") {
        for candidate in &global.all {
            if !group_names.contains(candidate.as_str()) || !inserted.insert(candidate.clone()) {
                continue;
            }

            if let Some(group) = groups.iter().find(|group| group.name == *candidate) {
                ordered_groups.push(group.clone());
            }
        }
    }

    for group in groups {
        if inserted.insert(group.name.clone()) {
            ordered_groups.push(group);
        }
    }

    ordered_groups
}

fn is_group_proxy(proxy: &RawProxy) -> bool {
    !proxy.all.is_empty() || proxy.now.is_some()
}

fn collect_leaf_node_names(proxies: &RawProxiesResponse) -> HashSet<String> {
    proxies
        .proxies
        .iter()
        .filter_map(|(name, proxy)| {
            if proxy.all.is_empty() && proxy.now.is_none() {
                Some(name.clone())
            } else {
                None
            }
        })
        .collect()
}

fn normalize_selected_node_names(node_names: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();

    for node_name in node_names {
        let trimmed = node_name.trim();
        if trimmed.is_empty() {
            continue;
        }

        if seen.insert(trimmed.to_string()) {
            normalized.push(trimmed.to_string());
        }
    }

    normalized
}

fn compile_local_proxies(
    controller: &str,
    selected_node_names: &[String],
) -> Vec<MihomoLocalProxy> {
    let now = now_iso_string();

    selected_node_names
        .iter()
        .enumerate()
        .map(|(index, node_name)| MihomoLocalProxy {
            id: Uuid::new_v4().to_string(),
            controller: controller.to_string(),
            name: node_name.clone(),
            node_name: node_name.clone(),
            listener_name: format!("simprint-node-{:03}", index + 1),
            listen_host: LOCAL_PROXY_HOST.to_string(),
            listen_port: LOCAL_PROXY_PORT_BASE.saturating_add(index as u16),
            listener_type: LOCAL_PROXY_LISTENER_TYPE.to_string(),
            proxy_scheme: LOCAL_PROXY_SCHEME.to_string(),
            status: LOCAL_PROXY_STATUS_UNKNOWN.to_string(),
            latency_ms: None,
            country: None,
            country_code: None,
            city: None,
            created_at: now.clone(),
            updated_at: now.clone(),
        })
        .collect()
}

async fn sync_local_listeners(
    client: &MihomoClient,
    config_path: &str,
    proxies: &[MihomoLocalProxy],
) -> Result<(), String> {
    let original = tokio::fs::read_to_string(config_path)
        .await
        .map_err(|error| format!("读取 Mihomo 配置文件失败: {error}"))?;
    let next = merge_simprint_listeners(&original, proxies)?;

    if next != original {
        tokio::fs::write(config_path, &next)
            .await
            .map_err(|error| format!("写入 Mihomo 配置文件失败: {error}"))?;
    }

    if let Err(error) = client.reload_config(config_path).await {
        if next != original {
            let restore_result = tokio::fs::write(config_path, &original).await;
            return match restore_result {
                Ok(_) => Err(format!("Mihomo 重载失败，已恢复原配置: {error}")),
                Err(restore_error) => Err(format!(
                    "Mihomo 重载失败，且恢复原配置失败: {error}; restore={restore_error}"
                )),
            };
        }

        return Err(format!("Mihomo 重载失败: {error}"));
    }

    Ok(())
}

fn merge_simprint_listeners(
    original: &str,
    proxies: &[MihomoLocalProxy],
) -> Result<String, String> {
    let mut root = serde_yaml::from_str::<Value>(original)
        .map_err(|error| format!("解析 Mihomo 配置文件失败: {error}"))?;
    let mapping = root
        .as_mapping_mut()
        .ok_or_else(|| "Mihomo 配置文件根节点不是对象".to_string())?;
    let listeners_key = Value::String("listeners".to_string());

    let mut preserved = Sequence::new();
    if let Some(existing) = mapping.get(&listeners_key) {
        let sequence = existing
            .as_sequence()
            .ok_or_else(|| "Mihomo 配置中的 listeners 字段不是数组".to_string())?;
        for item in sequence {
            if !is_simprint_listener(item) {
                preserved.push(item.clone());
            }
        }
    }

    for proxy in proxies {
        preserved.push(build_listener_value(proxy));
    }

    if preserved.is_empty() {
        mapping.remove(&listeners_key);
    } else {
        mapping.insert(listeners_key, Value::Sequence(preserved));
    }

    serde_yaml::to_string(&root).map_err(|error| format!("生成 Mihomo 配置文件失败: {error}"))
}

fn is_simprint_listener(value: &Value) -> bool {
    value
        .as_mapping()
        .and_then(|mapping| mapping.get(&Value::String("name".to_string())))
        .and_then(Value::as_str)
        .is_some_and(|name| name.starts_with(SIMPRINT_LISTENER_PREFIX))
}

fn build_listener_value(proxy: &MihomoLocalProxy) -> Value {
    let mut mapping = Mapping::new();
    mapping.insert(
        Value::String("name".to_string()),
        Value::String(proxy.listener_name.clone()),
    );
    mapping.insert(
        Value::String("type".to_string()),
        Value::String(proxy.listener_type.clone()),
    );
    mapping.insert(
        Value::String("port".to_string()),
        Value::Number(Number::from(proxy.listen_port as u64)),
    );
    mapping.insert(
        Value::String("listen".to_string()),
        Value::String(proxy.listen_host.clone()),
    );
    mapping.insert(
        Value::String("proxy".to_string()),
        Value::String(proxy.node_name.clone()),
    );
    mapping.insert(
        Value::String("users".to_string()),
        Value::Sequence(Sequence::new()),
    );
    Value::Mapping(mapping)
}

fn load_selection_snapshot(app: &tauri::AppHandle) -> Option<MihomoNodeSelectionSnapshot> {
    let value = tauri_store::get_store_key(app, MIHOMO_SELECTION_STORE_KEY)?;
    serde_json::from_value(value).ok()
}

fn load_connection_config(app: &tauri::AppHandle) -> Option<MihomoConnectionConfig> {
    let value = tauri_store::get_store_key(app, MIHOMO_CONNECTION_CONFIG_STORE_KEY)?;
    serde_json::from_value(value).ok().map(normalize_connection_config)
}

fn require_connection_config(app: &tauri::AppHandle) -> Result<MihomoConnectionConfig, String> {
    load_connection_config(app).ok_or_else(|| "当前未连接 Mihomo，请先完成连接配置".to_string())
}

fn persist_connection_config(
    app: &tauri::AppHandle,
    config: &MihomoConnectionConfig,
) -> Result<(), String> {
    tauri_store::set_store_key(
        app,
        MIHOMO_CONNECTION_CONFIG_STORE_KEY,
        serde_json::to_value(config).map_err(|error| error.to_string())?,
    )
}

fn persist_selection_snapshot(
    app: &tauri::AppHandle,
    snapshot: &MihomoNodeSelectionSnapshot,
) -> Result<(), String> {
    tauri_store::set_store_key(
        app,
        MIHOMO_SELECTION_STORE_KEY,
        serde_json::to_value(snapshot).map_err(|error| error.to_string())?,
    )
}

fn empty_selection_snapshot(controller: String) -> MihomoNodeSelectionSnapshot {
    MihomoNodeSelectionSnapshot {
        controller,
        selected_node_names: Vec::new(),
        updated_at: now_iso_string(),
    }
}

fn load_local_proxies(app: &tauri::AppHandle) -> Vec<MihomoLocalProxy> {
    tauri_store::get_store_key(app, MIHOMO_LOCAL_PROXIES_STORE_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default()
}

fn persist_local_proxies(
    app: &tauri::AppHandle,
    proxies: &[MihomoLocalProxy],
) -> Result<(), String> {
    tauri_store::set_store_key(app, MIHOMO_LOCAL_PROXIES_STORE_KEY, json!(proxies))
}

fn now_iso_string() -> String {
    Utc::now().to_rfc3339()
}

fn normalize_connection_config(config: MihomoConnectionConfig) -> MihomoConnectionConfig {
    let controller = config.controller.trim().to_string();
    let secret = config.secret.trim().to_string();
    let config_path = {
        let trimmed = config.config_path.trim();
        if trimmed.is_empty() {
            detect_default_mihomo_config_path()
        } else {
            trimmed.to_string()
        }
    };

    MihomoConnectionConfig {
        controller,
        secret,
        config_path,
    }
}

fn normalize_local_proxy_status(status: &str) -> String {
    match status.trim() {
        "healthy" => "healthy".to_string(),
        "unreachable" => "unreachable".to_string(),
        _ => "unknown".to_string(),
    }
}

fn non_empty_string(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

impl Default for MihomoManager {
    fn default() -> Self {
        Self::new()
    }
}
