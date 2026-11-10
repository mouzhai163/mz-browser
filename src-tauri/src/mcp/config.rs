use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::infrastructure::persistence::tauri_store::{get_store_key_checked, keys, set_store_key};

pub const DEFAULT_MCP_PORT: i32 = 37110;

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    pub enabled: bool,
    #[serde(default)]
    pub access_token: String,
    #[serde(default)]
    pub allowed_environment_uuids: Vec<String>,
    /// Read tabs and page outlines of authorized environments (read-only).
    #[serde(default)]
    pub page_tools_enabled: bool,
    /// Manage environments, groups, proxies, tags and kernels (full management, like the local
    /// API). Not limited to the authorized environments.
    #[serde(default)]
    pub manage_tools_enabled: bool,
    /// Click, type, navigate and press keys in authorized pages. Needs `page_tools_enabled`.
    #[serde(default)]
    pub act_tools_enabled: bool,
    /// Highest tier, for personal agent development: page reads include the real content of
    /// input and password fields and actions may target them. Needs `act_tools_enabled`.
    #[serde(default)]
    pub full_page_access_enabled: bool,
    /// Start the MCP service automatically when the app starts. Off by default.
    #[serde(default)]
    pub auto_start: bool,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            access_token: new_access_token(),
            allowed_environment_uuids: vec![],
            page_tools_enabled: false,
            manage_tools_enabled: false,
            act_tools_enabled: false,
            full_page_access_enabled: false,
            auto_start: false,
        }
    }
}

impl McpConfig {
    pub fn authorizes_environment(&self, id: &str) -> bool {
        self.enabled && self.allowed_environment_uuids.iter().any(|allowed| allowed == id)
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.access_token.len() != 64
            || !self.access_token.bytes().all(|byte| byte.is_ascii_hexdigit())
        {
            return Err("MCP 凭证无效，请重新生成".into());
        }
        if self.act_tools_enabled && !self.page_tools_enabled {
            return Err("开启页面操作前需要先开启页面读取".into());
        }
        if self.full_page_access_enabled && !self.act_tools_enabled {
            return Err("开启完全页面访问前需要先开启页面操作".into());
        }
        if self.allowed_environment_uuids.len() > 50 {
            return Err("MCP 授权环境最多 50 个".into());
        }
        for id in &self.allowed_environment_uuids {
            if uuid::Uuid::parse_str(id).is_err() {
                return Err("MCP 环境 UUID 无效".into());
            }
        }
        Ok(())
    }

    pub fn endpoint(&self) -> String {
        format!("http://127.0.0.1:{}/mcp", DEFAULT_MCP_PORT)
    }

    pub fn health_url(&self) -> String {
        format!("http://127.0.0.1:{}/health", DEFAULT_MCP_PORT)
    }

    pub fn runtime(&self) -> Result<McpRuntimeConfig, String> {
        self.validate()?;

        Ok(McpRuntimeConfig {
            port: DEFAULT_MCP_PORT as u16,
        })
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMcpConfigRequest {
    pub enabled: Option<bool>,
    pub allowed_environment_uuids: Option<Vec<String>>,
    pub page_tools_enabled: Option<bool>,
    pub manage_tools_enabled: Option<bool>,
    pub act_tools_enabled: Option<bool>,
    pub full_page_access_enabled: Option<bool>,
    pub auto_start: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpRuntimeSnapshot {
    pub enabled: bool,
    pub running: bool,
    pub endpoint: String,
    pub health_url: String,
    pub authentication_required: bool,
    pub allowed_environment_uuids: Vec<String>,
    pub page_tools_enabled: bool,
    pub manage_tools_enabled: bool,
    pub act_tools_enabled: bool,
    pub full_page_access_enabled: bool,
    pub auto_start: bool,
}

#[derive(Debug, Clone)]
pub struct McpRuntimeConfig {
    pub port: u16,
}

#[derive(Debug, Clone)]
pub struct McpManagerStatus {
    pub running: bool,
}

#[derive(Clone)]
pub struct McpServerRuntimeConfig {
    pub port: u16,
    pub access: McpConfig,
    pub read_slots: std::sync::Arc<tokio::sync::Semaphore>,
}

impl McpServerRuntimeConfig {
    pub fn endpoint(&self) -> String {
        format!("http://127.0.0.1:{}/mcp", self.port)
    }
}

pub fn load_config(app: &AppHandle) -> Result<McpConfig, String> {
    match get_store_key_checked(app, keys::MCP)? {
        Some(value) => {
            let mut config = serde_json::from_value::<McpConfig>(value)
                .map_err(|error| format!("MCP 配置格式无效: {error}"))?;
            if config.access_token.is_empty() {
                config.access_token = new_access_token();
                save_config(app, &config)?;
            }
            config.validate()?;
            Ok(config)
        }
        None => {
            let config = McpConfig::default();
            save_config(app, &config)?;
            Ok(config)
        }
    }
}

pub fn save_config(app: &AppHandle, config: &McpConfig) -> Result<(), String> {
    config.validate()?;
    let value = serde_json::to_value(config).map_err(|error| error.to_string())?;
    set_store_key(app, keys::MCP, value)
}

pub fn update_config(
    app: &AppHandle,
    request: UpdateMcpConfigRequest,
) -> Result<McpConfig, String> {
    let mut config = load_config(app)?;

    if let Some(enabled) = request.enabled {
        config.enabled = enabled;
    }
    if let Some(ids) = request.allowed_environment_uuids {
        config.allowed_environment_uuids =
            ids.into_iter().map(|id| id.trim().to_string()).collect();
        config.allowed_environment_uuids.sort();
        config.allowed_environment_uuids.dedup();
    }
    if let Some(enabled) = request.page_tools_enabled {
        config.page_tools_enabled = enabled;
        if !enabled {
            // page actions cannot outlive page reading
            config.act_tools_enabled = false;
            config.full_page_access_enabled = false;
        }
    }
    if let Some(enabled) = request.manage_tools_enabled {
        config.manage_tools_enabled = enabled;
    }
    if let Some(enabled) = request.act_tools_enabled {
        config.act_tools_enabled = enabled;
        if !enabled {
            config.full_page_access_enabled = false;
        }
    }
    if let Some(enabled) = request.full_page_access_enabled {
        config.full_page_access_enabled = enabled;
    }
    if let Some(auto_start) = request.auto_start {
        config.auto_start = auto_start;
    }

    save_config(app, &config)?;
    Ok(config)
}

pub fn snapshot_from_config(config: McpConfig, status: McpManagerStatus) -> McpRuntimeSnapshot {
    let endpoint = config.endpoint();
    let health_url = config.health_url();

    McpRuntimeSnapshot {
        enabled: config.enabled,
        running: status.running,
        endpoint,
        health_url,
        authentication_required: true,
        allowed_environment_uuids: config.allowed_environment_uuids,
        page_tools_enabled: config.page_tools_enabled,
        manage_tools_enabled: config.manage_tools_enabled,
        act_tools_enabled: config.act_tools_enabled,
        full_page_access_enabled: config.full_page_access_enabled,
        auto_start: config.auto_start,
    }
}

pub fn new_access_token() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_authenticated_and_deny_all_environments() {
        let config = McpConfig::default();
        config.validate().unwrap();
        assert!(!config.enabled && !config.page_tools_enabled);
        assert!(!config.manage_tools_enabled && !config.act_tools_enabled && !config.auto_start);
        assert!(!config.full_page_access_enabled);
        assert!(config.allowed_environment_uuids.is_empty());
        assert_ne!(config.access_token, McpConfig::default().access_token);
        let snapshot = snapshot_from_config(config.clone(), McpManagerStatus { running: false });
        assert!(!serde_json::to_string(&snapshot).unwrap().contains(&config.access_token));
    }

    #[test]
    fn old_configs_without_tier_flags_load_as_read_only() {
        let old = serde_json::json!({
            "enabled": true,
            "accessToken": "a".repeat(64),
            "allowedEnvironmentUuids": [],
            "pageToolsEnabled": true,
            "allowedOrigins": ["https://old.example"]
        });
        let config: McpConfig = serde_json::from_value(old).unwrap();
        config.validate().unwrap();
        assert!(config.page_tools_enabled && !config.manage_tools_enabled && !config.act_tools_enabled);
    }

    #[test]
    fn full_page_access_requires_page_actions_and_turns_off_with_them() {
        let mut config = McpConfig::default();
        config.full_page_access_enabled = true;
        assert!(config.validate().is_err());
        config.page_tools_enabled = true;
        config.act_tools_enabled = true;
        assert!(config.validate().is_ok());
    }

    #[test]
    fn page_actions_require_page_reading() {
        let mut config = McpConfig::default();
        config.act_tools_enabled = true;
        assert!(config.validate().is_err());
        config.page_tools_enabled = true;
        assert!(config.validate().is_ok());
    }

    #[test]
    fn environment_grants_are_exact_and_revocation_changes_the_runtime_policy() {
        let id = "11111111-1111-4111-8111-111111111111";
        let mut config = McpConfig::default();
        assert!(!config.authorizes_environment(id));
        config.enabled = true;
        config.allowed_environment_uuids.push(id.into());
        assert!(config.authorizes_environment(id));
        assert!(!config.authorizes_environment("22222222-2222-4222-8222-222222222222"));
        assert!(!config.authorizes_environment(&format!("{id} ")));
        let mut revoked = config.clone();
        revoked.allowed_environment_uuids.clear();
        assert!(!revoked.authorizes_environment(id));
        assert!(revoked != config);
    }
}
