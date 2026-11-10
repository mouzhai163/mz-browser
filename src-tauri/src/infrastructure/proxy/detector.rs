//! IP 检测服务
//!
//! 使用多个 IP 检测 API 端点，支持故障切换

use reqwest::Client;
use serde_json::Value;
use std::time::Instant;

use super::types::{IpApiConfig, IpInfo, ProxyTestResult};

/// IP 检测 API 列表（多个端点用于冗余）
/// 注意：使用 HTTPS 协议以提高兼容性
const IP_APIS: &[IpApiConfig] = &[
    // realip.cc - 中国服务，完整地理位置信息，通过 SOCKS5 测试成功
    IpApiConfig {
        url: "https://realip.cc/",
        ip_field: "ip",
        country_field: Some("country"),
        country_code_field: Some("iso_code"),
        city_field: Some("city"),
        region_field: Some("province"),
        isp_field: Some("isp"),
        timezone_field: Some("time_zone"),
        latitude_field: Some("latitude"),
        longitude_field: Some("longitude"),
        status_field: None,
        status_success_value: None,
    },
    // ipapi.co - 完整地理位置信息，1000 请求/天免费
    IpApiConfig {
        url: "https://ipapi.co/json/",
        ip_field: "ip",
        country_field: Some("country_name"),
        country_code_field: Some("country_code"),
        city_field: Some("city"),
        region_field: Some("region"),
        isp_field: Some("org"),
        timezone_field: Some("timezone"),
        latitude_field: Some("latitude"),
        longitude_field: Some("longitude"),
        status_field: None,
        status_success_value: None,
    },
    // iprust.io - 轻量级 IP 检测服务
    IpApiConfig {
        url: "https://iprust.io/ip.json",
        ip_field: "ip",
        country_field: Some("country_long"),
        country_code_field: Some("country_short"),
        city_field: Some("city"),
        region_field: Some("region"),
        isp_field: None,
        timezone_field: Some("timezone"),
        latitude_field: Some("latitude"),
        longitude_field: Some("longitude"),
        status_field: None,
        status_success_value: None,
    },
    // api.ip.sb - 完整地理位置和 ISP 信息
    IpApiConfig {
        url: "https://api.ip.sb/geoip/",
        ip_field: "ip",
        country_field: Some("country"),
        country_code_field: Some("country_code"),
        city_field: None,
        region_field: None,
        isp_field: Some("isp"),
        timezone_field: Some("timezone"),
        latitude_field: Some("latitude"),
        longitude_field: Some("longitude"),
        status_field: None,
        status_success_value: None,
    },
];

/// 默认请求超时（秒）
const DEFAULT_TIMEOUT_SECS: u64 = 10;

/// 第一个成功结果到了以后，再等优先级更高的服务多久
const PREFERENCE_GRACE: std::time::Duration = std::time::Duration::from_millis(300);

/// IP 检测器
pub struct IpDetector {
    client: Client,
    timeout_secs: u64,
}

impl IpDetector {
    /// 创建 IP 检测器
    pub fn new(client: Client) -> Self {
        Self {
            client,
            timeout_secs: DEFAULT_TIMEOUT_SECS,
        }
    }

    /// 创建 IP 检测器（带自定义超时）
    pub fn with_timeout(client: Client, timeout_secs: u64) -> Self {
        Self {
            client,
            timeout_secs,
        }
    }

    /// 检测 IP 信息：所有 API 同时请求，不再一个失败了才试下一个（以前一个慢服务就能拖住 7 秒）。
    /// 第一个成功结果到了以后再等 [`PREFERENCE_GRACE`]，在已成功的结果里按 [`IP_APIS`] 的顺序挑，
    /// 这样速度接近最快的服务，同一个出口每次又尽量用同一个服务的数据（各家 IP 库的城市、坐标略有不同）
    pub async fn detect(&self) -> ProxyTestResult {
        self.detect_from(IP_APIS).await
    }

    async fn detect_from(&self, apis: &[IpApiConfig]) -> ProxyTestResult {
        use futures::stream::{FuturesUnordered, StreamExt};

        let start = Instant::now();
        let mut pending: FuturesUnordered<_> = apis
            .iter()
            .enumerate()
            .map(|(index, api)| async move {
                log::debug!("请求 IP API #{}: {}", index + 1, api.url);
                (index, self.try_api(api).await)
            })
            .collect();

        let mut results: Vec<Option<IpInfo>> = vec![None; apis.len()];
        let mut finished = vec![false; apis.len()];
        let mut grace_deadline: Option<tokio::time::Instant> = None;
        loop {
            let next = match grace_deadline {
                Some(deadline) => match tokio::time::timeout_at(deadline, pending.next()).await {
                    Ok(next) => next,
                    Err(_) => break,
                },
                None => pending.next().await,
            };
            let Some((index, result)) = next else { break };
            finished[index] = true;
            match result {
                Ok(ip_info) => {
                    log::debug!(
                        "IP API #{} 成功: {}（{} ms）",
                        index + 1,
                        ip_info.ip,
                        start.elapsed().as_millis()
                    );
                    results[index] = Some(ip_info);
                    grace_deadline
                        .get_or_insert_with(|| tokio::time::Instant::now() + PREFERENCE_GRACE);
                }
                Err(e) => log::debug!("IP API #{} 失败: {}", index + 1, e),
            }
            // 目前最优先的成功结果前面没有还在请求的服务了，就不用再等
            if let Some(best) = results.iter().position(Option::is_some) {
                if finished[..best].iter().all(|done| *done) {
                    break;
                }
            }
        }

        match results.into_iter().flatten().next() {
            Some(ip_info) => ProxyTestResult::success(ip_info, start.elapsed().as_millis() as u64),
            None => ProxyTestResult::failure("所有 IP 检测服务均失败"),
        }
    }

    /// 尝试单个 API
    async fn try_api(&self, api: &IpApiConfig) -> Result<IpInfo, String> {
        let response = self
            .client
            .get(api.url)
            .timeout(std::time::Duration::from_secs(self.timeout_secs))
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP 状态码: {}", response.status()));
        }

        let text = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

        let json: Value =
            serde_json::from_str(&text).map_err(|e| format!("JSON 解析失败: {}", e))?;

        let obj = json.as_object().ok_or("响应不是 JSON 对象")?;

        // 检查状态字段（如果有）
        if let (Some(status_field), Some(success_value)) =
            (api.status_field, api.status_success_value)
        {
            if let Some(status) = obj.get(status_field) {
                let status_str = status.as_str().unwrap_or("");
                if status_str != success_value {
                    return Err(format!("API 返回错误状态: {}", status_str));
                }
            }
        }

        // 提取 IP（必需字段）
        let ip = self.get_string_field(obj, api.ip_field).ok_or("未找到 IP 字段")?;

        if ip.is_empty() {
            return Err("IP 字段为空".to_string());
        }

        // 提取可选字段
        let ip_info = IpInfo {
            ip,
            country: api
                .country_field
                .and_then(|f| self.get_string_field(obj, f))
                .unwrap_or_default(),
            country_code: api
                .country_code_field
                .and_then(|f| self.get_string_field(obj, f))
                .unwrap_or_default(),
            city: api.city_field.and_then(|f| self.get_string_field(obj, f)).unwrap_or_default(),
            region: api
                .region_field
                .and_then(|f| self.get_string_field(obj, f))
                .unwrap_or_default(),
            isp: api.isp_field.and_then(|f| self.get_string_field(obj, f)).unwrap_or_default(),
            timezone: api
                .timezone_field
                .and_then(|f| self.get_string_field(obj, f))
                .unwrap_or_default(),
            latitude: api
                .latitude_field
                .and_then(|f| self.get_coordinate_field(obj, f))
                .unwrap_or_default(),
            longitude: api
                .longitude_field
                .and_then(|f| self.get_coordinate_field(obj, f))
                .unwrap_or_default(),
        };

        Ok(ip_info)
    }

    /// 从 JSON 对象中获取字符串字段（支持嵌套路径，如 "location.city"）
    fn get_string_field(&self, obj: &serde_json::Map<String, Value>, path: &str) -> Option<String> {
        let parts: Vec<&str> = path.split('.').collect();
        let mut current: &Value = &Value::Object(obj.clone());

        for part in parts {
            current = current.get(part)?;
        }

        current.as_str().map(|s| s.to_string())
    }

    fn get_coordinate_field(
        &self,
        obj: &serde_json::Map<String, Value>,
        path: &str,
    ) -> Option<String> {
        let mut current = obj.get(path.split('.').next()?)?;
        for part in path.split('.').skip(1) {
            current = current.get(part)?;
        }
        match current {
            Value::String(value) => Some(value.trim().to_string()),
            Value::Number(value) => Some(value.to_string()),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn geoip_coordinates_support_numbers_strings_and_zero() {
        let detector = IpDetector::new(Client::new());
        let value = serde_json::json!({"lat": 0, "lon": -73.9, "location": {"lat": " 35.1 "}, "invalid": false});
        let object = value.as_object().unwrap();
        assert_eq!(
            detector.get_coordinate_field(object, "lat").as_deref(),
            Some("0")
        );
        assert_eq!(
            detector.get_coordinate_field(object, "lon").as_deref(),
            Some("-73.9")
        );
        assert_eq!(
            detector.get_coordinate_field(object, "location.lat").as_deref(),
            Some("35.1")
        );
        assert!(detector.get_coordinate_field(object, "invalid").is_none());
        assert!(detector.get_coordinate_field(object, "missing").is_none());
    }

    /// 本地假 GeoIP 服务：延迟 `delay_ms` 后返回 `ip`（为 None 时返回 500）
    async fn fake_api(delay_ms: u64, ip: Option<&'static str>) -> IpApiConfig {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            while let Ok((mut socket, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let mut buffer = [0u8; 1024];
                    let _ = socket.read(&mut buffer).await;
                    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                    let response = match ip {
                        Some(ip) => {
                            let body = format!(r#"{{"ip":"{ip}","timezone":"UTC"}}"#);
                            format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len())
                        }
                        None => "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_string(),
                    };
                    let _ = socket.write_all(response.as_bytes()).await;
                });
            }
        });
        IpApiConfig {
            url: Box::leak(format!("http://127.0.0.1:{port}/").into_boxed_str()),
            ip_field: "ip",
            country_field: None,
            country_code_field: None,
            city_field: None,
            region_field: None,
            isp_field: None,
            timezone_field: Some("timezone"),
            latitude_field: None,
            longitude_field: None,
            status_field: None,
            status_success_value: None,
        }
    }

    async fn run(apis: Vec<IpApiConfig>) -> (Option<String>, u128) {
        let detector = IpDetector::with_timeout(Client::builder().no_proxy().build().unwrap(), 5);
        let start = Instant::now();
        let result = detector.detect_from(&apis).await;
        (result.ip_info.map(|info| info.ip), start.elapsed().as_millis())
    }

    #[tokio::test]
    async fn a_slow_first_service_no_longer_delays_detection() {
        let (ip, elapsed) = run(vec![fake_api(3000, Some("1.1.1.1")).await, fake_api(50, Some("2.2.2.2")).await]).await;
        assert_eq!(ip.as_deref(), Some("2.2.2.2"));
        assert!(elapsed < 1500, "took {elapsed} ms");
    }

    #[tokio::test]
    async fn the_preferred_service_wins_when_it_answers_within_the_grace_window() {
        let (ip, _) = run(vec![fake_api(150, Some("1.1.1.1")).await, fake_api(20, Some("2.2.2.2")).await]).await;
        assert_eq!(ip.as_deref(), Some("1.1.1.1"));
    }

    #[tokio::test]
    async fn failed_services_are_skipped_without_waiting() {
        let (ip, elapsed) = run(vec![
            fake_api(10, None).await,
            fake_api(30, Some("2.2.2.2")).await,
            fake_api(3000, Some("3.3.3.3")).await,
        ])
        .await;
        assert_eq!(ip.as_deref(), Some("2.2.2.2"));
        assert!(elapsed < 1000, "a lower-priority slow service must not hold the result: {elapsed} ms");
    }

    #[tokio::test]
    async fn all_failures_report_failure() {
        let (ip, _) = run(vec![fake_api(10, None).await, fake_api(10, None).await]).await;
        assert!(ip.is_none());
    }
}

/// 使用指定客户端检测 IP
pub async fn detect_ip(client: Client) -> ProxyTestResult {
    let detector = IpDetector::new(client);
    detector.detect().await
}

/// 使用指定客户端和超时检测 IP
pub async fn detect_ip_with_timeout(client: Client, timeout_secs: u64) -> ProxyTestResult {
    let detector = IpDetector::with_timeout(client, timeout_secs);
    detector.detect().await
}

/// 使用系统代理检测 IP（不禁用代理，让 reqwest 自动使用系统代理）
pub async fn detect_with_system_proxy(timeout_secs: u64) -> ProxyTestResult {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
    {
        Ok(c) => c,
        Err(e) => return ProxyTestResult::failure(format!("创建客户端失败: {}", e)),
    };

    detect_ip_with_timeout(client, timeout_secs).await
}

/// 直接检测本机 IP（不使用代理）
pub async fn detect_direct_ip() -> ProxyTestResult {
    detect_direct_ip_with_timeout(DEFAULT_TIMEOUT_SECS).await
}

/// 直接检测本机 IP（不使用代理，带超时）
pub async fn detect_direct_ip_with_timeout(timeout_secs: u64) -> ProxyTestResult {
    let client = match reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
    {
        Ok(c) => c,
        Err(e) => return ProxyTestResult::failure(format!("创建客户端失败: {}", e)),
    };

    detect_ip_with_timeout(client, timeout_secs).await
}
