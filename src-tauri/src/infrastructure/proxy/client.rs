//! 代理客户端构建
//!
//! 提供构建配置了代理的 HTTP 客户端功能

use reqwest::{Client, Proxy};
use std::time::Duration;

use super::types::ProxyConfig;

/// 默认超时时间（秒）
const DEFAULT_TIMEOUT_SECS: u64 = 30;

/// 构建配置了代理的 HTTP 客户端
///
/// # 参数
/// - `config`: 代理配置
/// - `timeout_secs`: 超时时间（秒），默认 30 秒
///
/// # 返回
/// 配置了代理的 `reqwest::Client`
pub fn build_proxy_client(
    config: &ProxyConfig,
    timeout_secs: Option<u64>,
) -> Result<Client, String> {
    let timeout = Duration::from_secs(timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS));
    let proxy_url = config.to_url()?; // 处理可能的解密错误
    let proxy = Proxy::all(&proxy_url).map_err(|e| format!("创建代理失败: {}", e))?;

    Client::builder()
        .proxy(proxy)
        .timeout(timeout)
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {}", e))
}

/// 构建无代理的 HTTP 客户端（用于对比测试）
pub fn build_direct_client(timeout_secs: Option<u64>) -> Result<Client, String> {
    let timeout = Duration::from_secs(timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS));

    Client::builder()
        .no_proxy()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::proxy::{ProxyPassword, ProxyType};

    #[test]
    fn test_proxy_url_generation() {
        let config = ProxyConfig {
            proxy_type: ProxyType::Http,
            host: "proxy.example.com".to_string(),
            port: 8080,
            username: None,
            password: None,
        };
        assert_eq!(config.to_url().unwrap(), "http://proxy.example.com:8080");

        let config_with_auth = ProxyConfig {
            proxy_type: ProxyType::Socks5,
            host: "socks.example.com".to_string(),
            port: 1080,
            username: Some("user".to_string()),
            password: Some(ProxyPassword::plain("pass".to_string())),
        };
        assert_eq!(
            config_with_auth.to_url().unwrap(),
            "socks5h://user:pass@socks.example.com:1080"
        );
    }
}
