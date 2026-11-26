//! 内核下载代理配置
//!
//! 配置存放在应用统一的 `config/store.json` 中。密码落盘前使用当前 Windows 用户的 DPAPI 保护，
//! 后端读取后只用于构建 reqwest client，不把明文密码返回给前端。

use crate::infrastructure::persistence::tauri_store::{get_store_key_checked, keys, set_store_key};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KernelDownloadProxyMode {
    /// 保持 reqwest 默认行为：环境变量优先，其次系统代理，最后直连。
    #[default]
    System,
    /// 明确禁用系统代理和环境变量代理。
    Direct,
    /// 使用这里保存的独立代理。
    Custom,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KernelDownloadProxyType {
    #[default]
    Http,
    Https,
    Socks5,
}

impl KernelDownloadProxyType {
    fn scheme(self) -> &'static str {
        match self {
            Self::Http => "http",
            Self::Https => "https",
            // socks5h 让代理解析目标域名，避免本地 DNS 泄漏和污染影响。
            Self::Socks5 => "socks5h",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelDownloadSettings {
    #[serde(default)]
    pub proxy_mode: KernelDownloadProxyMode,
    #[serde(default)]
    pub proxy_type: KernelDownloadProxyType,
    #[serde(default)]
    pub proxy_host: String,
    #[serde(default)]
    pub proxy_port: String,
    #[serde(default)]
    pub proxy_username: String,
    #[serde(default)]
    pub proxy_password: String,
}

impl Default for KernelDownloadSettings {
    fn default() -> Self {
        Self {
            proxy_mode: KernelDownloadProxyMode::System,
            proxy_type: KernelDownloadProxyType::Http,
            proxy_host: String::new(),
            proxy_port: String::new(),
            proxy_username: String::new(),
            proxy_password: String::new(),
        }
    }
}

/// 前端提交完整配置。proxyPassword 为 None 表示保留已有密码，Some("") 表示清除。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelDownloadSettingsInput {
    #[serde(default)]
    pub proxy_mode: KernelDownloadProxyMode,
    #[serde(default)]
    pub proxy_type: KernelDownloadProxyType,
    #[serde(default)]
    pub proxy_host: String,
    #[serde(default)]
    pub proxy_port: String,
    #[serde(default)]
    pub proxy_username: String,
    #[serde(default)]
    pub proxy_password: Option<String>,
}

/// 返回给前端的配置。永远不会带明文密码。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelDownloadSettingsView {
    pub proxy_mode: KernelDownloadProxyMode,
    pub proxy_type: KernelDownloadProxyType,
    pub proxy_host: String,
    pub proxy_port: String,
    pub proxy_username: String,
    pub has_proxy_password: bool,
}

fn settings_view(settings: &KernelDownloadSettings) -> KernelDownloadSettingsView {
    KernelDownloadSettingsView {
        proxy_mode: settings.proxy_mode,
        proxy_type: settings.proxy_type,
        proxy_host: settings.proxy_host.clone(),
        proxy_port: settings.proxy_port.clone(),
        proxy_username: settings.proxy_username.clone(),
        has_proxy_password: !settings.proxy_password.is_empty(),
    }
}

fn normalize_settings(settings: &mut KernelDownloadSettings) {
    settings.proxy_host = settings.proxy_host.trim().to_string();
    settings.proxy_port = settings.proxy_port.trim().to_string();
    settings.proxy_username = settings.proxy_username.trim().to_string();
}

fn validate_settings(settings: &KernelDownloadSettings) -> Result<(), String> {
    if settings.proxy_mode != KernelDownloadProxyMode::Custom {
        return Ok(());
    }

    if settings.proxy_host.is_empty() {
        return Err("使用自定义代理时需要填写代理地址".to_string());
    }
    if settings.proxy_host.chars().any(char::is_whitespace) || settings.proxy_host.contains('/') {
        return Err("代理地址只需要填写主机名或 IP，不要包含协议或路径".to_string());
    }

    let port = settings
        .proxy_port
        .parse::<u16>()
        .map_err(|_| "代理端口必须是 1-65535 之间的数字".to_string())?;
    if port == 0 {
        return Err("代理端口必须是 1-65535 之间的数字".to_string());
    }

    if !settings.proxy_password.is_empty() && settings.proxy_username.is_empty() {
        return Err("填写代理密码时也需要填写用户名".to_string());
    }

    Ok(())
}

pub fn load_kernel_download_settings(
    app: &tauri::AppHandle,
) -> Result<KernelDownloadSettings, String> {
    let Some(value) = get_store_key_checked(app, keys::KERNEL_DOWNLOAD)? else {
        return Ok(KernelDownloadSettings::default());
    };

    let mut settings = serde_json::from_value::<KernelDownloadSettings>(value)
        .map_err(|error| format!("内核下载代理配置格式无效: {error}"))?;
    settings.proxy_password =
        business::secret::reveal(&settings.proxy_password).unwrap_or_default();
    normalize_settings(&mut settings);
    Ok(settings)
}

pub fn get_kernel_download_settings_view(
    app: &tauri::AppHandle,
) -> Result<KernelDownloadSettingsView, String> {
    load_kernel_download_settings(app).map(|settings| settings_view(&settings))
}

pub fn update_kernel_download_settings(
    app: &tauri::AppHandle,
    input: KernelDownloadSettingsInput,
) -> Result<KernelDownloadSettingsView, String> {
    let current = load_kernel_download_settings(app)?;
    let proxy_password = match input.proxy_password {
        None => current.proxy_password,
        Some(password) => password,
    };
    let mut next = KernelDownloadSettings {
        proxy_mode: input.proxy_mode,
        proxy_type: input.proxy_type,
        proxy_host: input.proxy_host,
        proxy_port: input.proxy_port,
        proxy_username: input.proxy_username,
        proxy_password,
    };
    normalize_settings(&mut next);
    validate_settings(&next)?;

    let mut stored = next.clone();
    stored.proxy_password = business::secret::protect(&next.proxy_password);
    let value = serde_json::to_value(stored).map_err(|error| error.to_string())?;
    set_store_key(app, keys::KERNEL_DOWNLOAD, value)?;

    Ok(settings_view(&next))
}

/// 为自定义代理生成不包含在日志中的代理 URL。调用方不得把这个 URL 写入日志或事件。
pub fn custom_proxy_url(settings: &KernelDownloadSettings) -> Result<Option<String>, String> {
    if settings.proxy_mode != KernelDownloadProxyMode::Custom {
        return Ok(None);
    }
    validate_settings(settings)?;

    let host = if settings.proxy_host.parse::<std::net::Ipv6Addr>().is_ok() {
        format!("[{}]", settings.proxy_host)
    } else {
        settings.proxy_host.clone()
    };
    let base = format!(
        "{}://{}:{}",
        settings.proxy_type.scheme(),
        host,
        settings.proxy_port
    );
    let mut url = reqwest::Url::parse(&base).map_err(|_| "代理地址格式无效".to_string())?;

    if !settings.proxy_username.is_empty() {
        url.set_username(&settings.proxy_username)
            .map_err(|_| "代理用户名格式无效".to_string())?;
        if !settings.proxy_password.is_empty() {
            url.set_password(Some(&settings.proxy_password))
                .map_err(|_| "代理密码格式无效".to_string())?;
        }
    }

    Ok(Some(url.to_string()))
}

/// 按配置构造 reqwest client builder。显式 custom/direct 都会关闭 reqwest 的系统代理自动探测。
pub fn client_builder_for_settings(
    settings: &KernelDownloadSettings,
) -> Result<reqwest::ClientBuilder, String> {
    match settings.proxy_mode {
        KernelDownloadProxyMode::System => Ok(reqwest::Client::builder()),
        KernelDownloadProxyMode::Direct => Ok(reqwest::Client::builder().no_proxy()),
        KernelDownloadProxyMode::Custom => {
            let proxy_url = custom_proxy_url(settings)?.ok_or("自定义代理配置无效")?;
            let proxy =
                reqwest::Proxy::all(&proxy_url).map_err(|_| "自定义代理配置无效".to_string())?;
            Ok(reqwest::Client::builder().proxy(proxy))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        KernelDownloadProxyMode, KernelDownloadProxyType, KernelDownloadSettings,
        client_builder_for_settings, custom_proxy_url, validate_settings,
    };

    fn custom_settings() -> KernelDownloadSettings {
        KernelDownloadSettings {
            proxy_mode: KernelDownloadProxyMode::Custom,
            proxy_type: KernelDownloadProxyType::Http,
            proxy_host: "127.0.0.1".to_string(),
            proxy_port: "7890".to_string(),
            proxy_username: String::new(),
            proxy_password: String::new(),
        }
    }

    #[test]
    fn custom_proxy_url_supports_auth_and_encodes_credentials() {
        let mut settings = custom_settings();
        settings.proxy_username = "user@example.com".to_string();
        settings.proxy_password = "pa:ss/word".to_string();

        assert_eq!(
            custom_proxy_url(&settings).unwrap(),
            Some("http://user%40example.com:pa%3Ass%2Fword@127.0.0.1:7890/".to_string())
        );
    }

    #[test]
    fn socks5_uses_remote_dns_scheme() {
        let mut settings = custom_settings();
        settings.proxy_type = KernelDownloadProxyType::Socks5;

        assert_eq!(
            custom_proxy_url(&settings).unwrap(),
            Some("socks5h://127.0.0.1:7890".to_string())
        );
    }

    #[test]
    fn ipv6_host_is_bracketed() {
        let mut settings = custom_settings();
        settings.proxy_host = "::1".to_string();

        assert_eq!(
            custom_proxy_url(&settings).unwrap(),
            Some("http://[::1]:7890/".to_string())
        );
    }

    #[test]
    fn invalid_custom_proxy_is_rejected() {
        let mut settings = custom_settings();
        settings.proxy_host = String::new();
        assert!(validate_settings(&settings).is_err());

        let mut settings = custom_settings();
        settings.proxy_port = "not-a-port".to_string();
        assert!(validate_settings(&settings).is_err());

        let mut settings = custom_settings();
        settings.proxy_password = "secret".to_string();
        assert!(validate_settings(&settings).is_err());
    }

    #[test]
    fn system_and_direct_modes_do_not_require_custom_proxy_fields() {
        for mode in [
            KernelDownloadProxyMode::System,
            KernelDownloadProxyMode::Direct,
        ] {
            let settings = KernelDownloadSettings {
                proxy_mode: mode,
                ..KernelDownloadSettings::default()
            };
            assert!(validate_settings(&settings).is_ok());
            assert!(client_builder_for_settings(&settings).is_ok());
        }
    }
}
