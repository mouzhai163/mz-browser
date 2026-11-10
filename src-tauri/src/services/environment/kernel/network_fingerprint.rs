use crate::infrastructure::{
    proxy::{client::build_proxy_client, detector, types::IpInfo},
    runtime::FingerprintConfig,
};

use super::{
    language::infer_language_from_country_code,
    types::{ProxyConfig, TIMEZONE_DETECTION_TIMEOUT_SECS},
};

fn automatic(value: &Option<String>) -> bool {
    value
        .as_deref()
        .is_none_or(|value| value.trim().is_empty() || value.trim().eq_ignore_ascii_case("ip"))
}

fn automatic_geolocation(config: &FingerprintConfig) -> bool {
    config
        .geolocation
        .as_deref()
        .is_some_and(|value| value.trim().eq_ignore_ascii_case("ip"))
}

/// 按需解析语言、时区和定位；做了出口检测时返回检测到的出口 IP。
pub(super) async fn resolve_network_fingerprint(
    config: &mut FingerprintConfig,
    proxy: Option<&ProxyConfig>,
) -> Result<Option<String>, String> {
    if !automatic(&config.language)
        && !config
            .interface_language
            .as_deref()
            .is_some_and(|value| value.trim().is_empty() || value.trim().eq_ignore_ascii_case("ip"))
        && !automatic(&config.timezone)
        && !automatic_geolocation(config)
    {
        if config.interface_language.is_none() {
            config.interface_language = config.language.clone();
        }
        return Ok(None);
    }

    let info = detect_exit(proxy).await?;
    apply_network_info(config, &info)?;
    Ok(Some(info.ip.trim().to_string()).filter(|ip| !ip.is_empty()))
}

/// 出口 IP（WebRTC 选“替换”时要写进候选地址）。
pub(super) async fn detect_exit_ip(proxy: Option<&ProxyConfig>) -> Result<String, String> {
    let info = detect_exit(proxy).await?;
    Some(info.ip.trim().to_string())
        .filter(|ip| !ip.is_empty())
        .ok_or_else(|| "出口检测缺少 IP，已阻止启动".to_string())
}

async fn detect_exit(proxy: Option<&ProxyConfig>) -> Result<IpInfo, String> {
    // One GeoIP response supplies all automatic fields. A configured proxy is
    // mandatory for this request; no fallback to another network exit is allowed.
    let detected = if let Some(proxy) = proxy {
        let client = build_proxy_client(
            &proxy.to_infrastructure_proxy_config(),
            Some(TIMEZONE_DETECTION_TIMEOUT_SECS),
        )
        .map_err(|_| "代理检测客户端初始化失败，已阻止启动；未回退直连".to_string())?;
        detector::detect_ip_with_timeout(client, TIMEZONE_DETECTION_TIMEOUT_SECS).await
    } else {
        detector::detect_with_system_proxy(TIMEZONE_DETECTION_TIMEOUT_SECS).await
    };
    if !detected.success {
        return Err(
            "出口地区检测失败，已阻止启动；请检查代理或明确设置语言、时区和定位".to_string(),
        );
    }
    detected.ip_info.ok_or_else(|| "出口地区检测缺少结果，已阻止启动".to_string())
}

fn apply_network_info(config: &mut FingerprintConfig, info: &IpInfo) -> Result<(), String> {
    // Commit only after every requested field has been resolved successfully.
    let mut resolved = config.clone();
    if automatic(&resolved.language) {
        resolved.language = Some(
            infer_language_from_country_code(&info.country_code)
                .ok_or("无法从出口国家推断语言，请明确选择语言；已阻止启动")?,
        );
    }
    if resolved.interface_language.is_none() {
        resolved.interface_language = resolved.language.clone();
    } else if automatic(&resolved.interface_language) {
        resolved.interface_language = Some(
            infer_language_from_country_code(&info.country_code)
                .ok_or("无法从出口国家推断界面语言，请明确选择语言；已阻止启动")?,
        );
    }
    if automatic(&resolved.timezone) {
        let timezone = info.timezone.trim();
        if timezone.is_empty() || timezone.eq_ignore_ascii_case("ip") {
            return Err("出口检测缺少时区，请明确设置时区；已阻止启动".to_string());
        }
        resolved.timezone = Some(timezone.to_string());
    }
    if automatic_geolocation(&resolved) {
        let latitude: f64 =
            info.latitude.trim().parse().map_err(|_| "出口检测缺少有效纬度，已阻止启动")?;
        let longitude: f64 =
            info.longitude.trim().parse().map_err(|_| "出口检测缺少有效经度，已阻止启动")?;
        if !latitude.is_finite()
            || !longitude.is_finite()
            || !(-90.0..=90.0).contains(&latitude)
            || !(-180.0..=180.0).contains(&longitude)
        {
            return Err("出口定位坐标越界，已阻止启动".to_string());
        }
        resolved.geolocation = Some(format!("{latitude},{longitude}"));
    }
    *config = resolved;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> FingerprintConfig {
        serde_json::from_value(serde_json::json!({
            "language": "ip", "interface_language": "ip", "timezone": "ip", "geolocation": "ip"
        }))
        .unwrap()
    }

    fn info(country: &str, timezone: &str) -> IpInfo {
        serde_json::from_value(serde_json::json!({
            "ip": "203.0.113.1", "country_code": country, "timezone": timezone,
            "latitude": "0", "longitude": "0"
        }))
        .unwrap()
    }

    #[test]
    fn automatic_fields_use_the_same_exit_and_accept_zero_coordinates() {
        for (country, timezone, language) in [
            ("US", "America/New_York", "en-US"),
            ("GB", "Europe/London", "en-GB"),
            ("JP", "Asia/Tokyo", "ja-JP"),
            ("FR", "Europe/Paris", "fr-FR"),
        ] {
            let mut config = config();
            apply_network_info(&mut config, &info(country, timezone)).unwrap();
            assert_eq!(config.language.as_deref(), Some(language));
            assert_eq!(config.interface_language.as_deref(), Some(language));
            assert_eq!(config.timezone.as_deref(), Some(timezone));
            assert_eq!(config.geolocation.as_deref(), Some("0,0"));
        }
    }

    #[test]
    fn incomplete_results_do_not_partially_mutate_configuration() {
        let mut config = config();
        assert!(apply_network_info(&mut config, &info("US", "")).is_err());
        assert_eq!(config.language.as_deref(), Some("ip"));
        assert!(apply_network_info(&mut config, &info("unknown", "UTC")).is_err());
        let mut invalid = info("US", "UTC");
        invalid.latitude = "NaN".into();
        assert!(apply_network_info(&mut config, &invalid).is_err());
        invalid.latitude = "91".into();
        assert!(apply_network_info(&mut config, &invalid).is_err());
    }

    #[tokio::test]
    async fn explicit_configuration_does_not_require_a_network_probe() {
        let mut config = config();
        config.language = Some("fr-FR".into());
        config.interface_language = Some("en-GB".into());
        config.timezone = Some("Europe/Paris".into());
        config.geolocation = None;
        resolve_network_fingerprint(&mut config, None).await.unwrap();
        assert_eq!(config.interface_language.as_deref(), Some("en-GB"));
    }

    #[tokio::test]
    async fn missing_interface_language_inherits_an_explicit_language_without_network_access() {
        let mut config = config();
        config.language = Some("fr-FR".into());
        config.interface_language = None;
        config.timezone = Some("Europe/Paris".into());
        config.geolocation = None;
        resolve_network_fingerprint(&mut config, None).await.unwrap();
        assert_eq!(config.interface_language.as_deref(), Some("fr-FR"));
    }
}
