/// 代理测试服务
///
/// 提供代理检测功能
use crate::core::error::Result;
use crate::infrastructure::proxy::{
    ProxyConfig, ProxyTestResult, build_proxy_client, detect_direct_ip, detect_ip,
};

pub struct ProxyService;

impl ProxyService {
    /// 测试代理连接
    ///
    /// 通过代理请求 IP 检测服务，返回检测到的 IP 信息和延迟
    pub async fn test_proxy(config: ProxyConfig) -> Result<ProxyTestResult> {
        log::info!(
            "开始测试代理: {}://{}:{}",
            config.proxy_type,
            config.host,
            config.port
        );

        // 构建代理客户端
        let client = match build_proxy_client(&config, Some(15)) {
            Ok(c) => c,
            Err(e) => {
                let result = ProxyTestResult::failure(e);
                log::warn!(
                    "代理测试失败: {}",
                    result.error.as_deref().unwrap_or("未知错误")
                );
                return Ok(result);
            }
        };

        // 执行 IP 检测
        let result = detect_ip(client).await;

        if result.success {
            log::info!(
                "代理测试成功: IP={}, 延迟={}ms",
                result.ip_info.as_ref().map(|i| i.ip.as_str()).unwrap_or("未知"),
                result.latency_ms.unwrap_or(0)
            );
        } else {
            log::warn!(
                "代理测试失败: {}",
                result.error.as_deref().unwrap_or("未知错误")
            );
        }

        Ok(result)
    }

    /// 测试直连 IP（不使用代理）
    ///
    /// 用于获取本机直连的 IP 信息，可与代理 IP 对比
    pub async fn test_direct_ip() -> Result<ProxyTestResult> {
        log::info!("开始检测直连 IP");

        let result = detect_direct_ip().await;

        if result.success {
            log::info!(
                "直连 IP 检测成功: IP={}, 延迟={}ms",
                result.ip_info.as_ref().map(|i| i.ip.as_str()).unwrap_or("未知"),
                result.latency_ms.unwrap_or(0)
            );
        } else {
            log::warn!(
                "直连 IP 检测失败: {}",
                result.error.as_deref().unwrap_or("未知错误")
            );
        }

        Ok(result)
    }
}
