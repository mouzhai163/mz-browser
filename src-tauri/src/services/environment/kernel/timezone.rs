//! 时区自动检测模块

use super::types::{ProxyConfig, TIMEZONE_DETECTION_TIMEOUT_SECS};

/// 检测时区
///
/// # 逻辑
/// - 有代理配置：仅通过该代理检测，失败不回退系统代理或直连
/// - 无代理配置：使用系统代理（reqwest 自动检测）
///
/// # 返回
/// - `Some(timezone)`: 检测成功
/// - `None`: 所有检测都失败
pub async fn detect_timezone(proxy: Option<&ProxyConfig>) -> Option<String> {
    if let Some(proxy_cfg) = proxy {
        detect_with_proxy(proxy_cfg).await
    } else {
        detect_with_system_proxy().await
    }
}
/// 使用配置的代理检测时区
async fn detect_with_proxy(proxy_cfg: &ProxyConfig) -> Option<String> {
    let infra_proxy_cfg = proxy_cfg.to_infrastructure_proxy_config();
    let proxy_client = match crate::infrastructure::proxy::client::build_proxy_client(
        &infra_proxy_cfg,
        Some(TIMEZONE_DETECTION_TIMEOUT_SECS),
    ) {
        Ok(client) => client,
        Err(_) => {
            return None;
        }
    };

    let proxy_result = crate::infrastructure::proxy::detector::detect_ip_with_timeout(
        proxy_client,
        TIMEZONE_DETECTION_TIMEOUT_SECS,
    )
    .await;

    if proxy_result.success {
        Some(proxy_result.timezone).filter(|timezone| !timezone.trim().is_empty())
    } else {
        None
    }
}

/// 使用系统代理检测时区
async fn detect_with_system_proxy() -> Option<String> {
    let result = crate::infrastructure::proxy::detector::detect_with_system_proxy(
        TIMEZONE_DETECTION_TIMEOUT_SECS,
    )
    .await;

    if result.success {
        Some(result.timezone).filter(|timezone| !timezone.trim().is_empty())
    } else {
        None
    }
}
