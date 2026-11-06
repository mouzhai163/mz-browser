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
    #[serde(default)]
    pub page_tools_enabled: bool,
    #[serde(default)]
    pub allowed_origins: Vec<String>,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            access_token: new_access_token(),
            allowed_environment_uuids: vec![],
            page_tools_enabled: false,
            allowed_origins: vec![],
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
        if self.allowed_environment_uuids.len() > 50 || self.allowed_origins.len() > 50 {
            return Err("MCP 环境或站点授权最多各 50 项".into());
        }
        for id in &self.allowed_environment_uuids {
            if uuid::Uuid::parse_str(id).is_err() {
                return Err("MCP 环境 UUID 无效".into());
            }
        }
        for origin in &self.allowed_origins {
            validate_origin(origin)?;
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
    pub allowed_origins: Option<Vec<String>>,
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
    pub allowed_origins: Vec<String>,
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
    pub local_api_api_key: String,
    pub access: McpConfig,
    pub owner_uuid: uuid::Uuid,
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
    }
    if let Some(origins) = request.allowed_origins {
        config.allowed_origins = origins
            .into_iter()
            .map(|origin| origin.trim().trim_end_matches('/').to_string())
            .collect();
        config.allowed_origins.sort();
        config.allowed_origins.dedup();
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
        allowed_origins: config.allowed_origins,
    }
}

pub fn new_access_token() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

fn validate_origin(value: &str) -> Result<(), String> {
    let url =
        reqwest::Url::parse(value).map_err(|_| "MCP 站点必须是完整 HTTP(S) origin".to_string())?;
    if value.contains('*')
        || !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.origin().ascii_serialization() != value
    {
        return Err(
            "MCP 站点仅允许精确 origin（协议、主机、端口），不允许路径、通配符或凭证".into(),
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_authenticated_and_deny_all_environments() {
        let config = McpConfig::default();
        config.validate().unwrap();
        assert!(!config.enabled && !config.page_tools_enabled);
        assert!(config.allowed_environment_uuids.is_empty());
        assert!(config.allowed_origins.is_empty());
        assert_ne!(config.access_token, McpConfig::default().access_token);
        let snapshot = snapshot_from_config(config.clone(), McpManagerStatus { running: false });
        assert!(!serde_json::to_string(&snapshot).unwrap().contains(&config.access_token));
    }

    #[test]
    fn origins_must_be_exact_and_do_not_allow_credentials_or_paths() {
        for origin in ["https://example.com", "http://127.0.0.1:8080"] {
            validate_origin(origin).unwrap();
        }
        for origin in [
            "*",
            "https://*.example.com",
            "file:///test",
            "https://example.com/path",
            "https://user:pass@example.com",
            "https://example.com?key=secret",
        ] {
            assert!(validate_origin(origin).is_err(), "{origin}");
        }
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
