//! 代理模块
//!
//! 提供 HTTP/HTTPS/SOCKS5 代理支持和 IP 检测功能

pub mod client;
pub mod detector;
pub mod types;

// 重新导出常用类型
pub use client::{build_direct_client, build_proxy_client};
pub use detector::{IpDetector, detect_direct_ip, detect_ip};
pub use types::{IpInfo, ProxyConfig, ProxyPassword, ProxyTestResult, ProxyType};

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试代理 URL 生成
    #[test]
    fn test_proxy_url() {
        let config = ProxyConfig {
            proxy_type: ProxyType::Socks5,
            host: "proxy.example.com".to_string(),
            port: 1080,
            username: Some("user".to_string()),
            password: Some(ProxyPassword::plain("pass".to_string())),
        };

        let url = config.to_url().unwrap();
        // SOCKS5 应该使用 socks5h 协议（远程 DNS）
        assert_eq!(url, "socks5h://user:pass@proxy.example.com:1080");
    }

    /// 测试直连 IP 检测（不使用代理）
    #[tokio::test]
    #[ignore] // 默认跳过，需要网络访问
    async fn test_direct_ip_detection() {
        let result = detect_direct_ip().await;
        assert!(result.success || result.error.is_some());
    }
}
