//! 代理类型定义

use serde::{Deserialize, Serialize};

/// 代理密码结构体
///
/// 兼容旧结构；当前仅使用明文密码。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyPassword {
    /// 密码值（明文或密文）
    pub value: String,
    /// 是否已加密（保留兼容字段，默认 false）
    #[serde(default)]
    pub encrypted: bool,
}

impl ProxyPassword {
    /// 创建明文密码
    pub fn plain(password: String) -> Self {
        Self {
            value: password,
            encrypted: false,
        }
    }

    /// 获取明文密码
    pub fn get_plain_password(&self) -> Result<String, String> {
        Ok(self.value.clone())
    }
}

/// 代理类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProxyType {
    Http,
    Https,
    Socks5,
}

impl std::fmt::Display for ProxyType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProxyType::Http => write!(f, "http"),
            ProxyType::Https => write!(f, "https"),
            ProxyType::Socks5 => write!(f, "socks5"),
        }
    }
}

/// 代理配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    /// 代理类型
    pub proxy_type: ProxyType,
    /// 主机地址
    pub host: String,
    /// 端口
    pub port: u16,
    /// 用户名（可选）
    #[serde(default)]
    pub username: Option<String>,
    /// 密码（支持明文和加密两种格式）
    #[serde(default)]
    pub password: Option<ProxyPassword>,
}

impl ProxyConfig {
    /// 构建代理 URL
    ///
    pub fn to_url(&self) -> Result<String, String> {
        let scheme = match self.proxy_type {
            ProxyType::Http => "http",
            ProxyType::Https => "https",
            // SOCKS5 使用远程 DNS 解析 (socks5h)
            ProxyType::Socks5 => "socks5h",
        };

        if let (Some(username), Some(password_struct)) = (&self.username, &self.password) {
            let password = password_struct.get_plain_password()?;
            Ok(format!(
                "{}://{}:{}@{}:{}",
                scheme, username, password, self.host, self.port
            ))
        } else {
            Ok(format!("{}://{}:{}", scheme, self.host, self.port))
        }
    }
}

/// IP 检测 API 配置
#[derive(Debug, Clone)]
pub struct IpApiConfig {
    /// API URL
    pub url: &'static str,
    /// IP 字段名
    pub ip_field: &'static str,
    /// 国家字段名
    pub country_field: Option<&'static str>,
    /// 国家代码字段名
    pub country_code_field: Option<&'static str>,
    /// 城市字段名
    pub city_field: Option<&'static str>,
    /// 地区字段名
    pub region_field: Option<&'static str>,
    /// ISP 字段名
    pub isp_field: Option<&'static str>,
    /// 时区字段名
    pub timezone_field: Option<&'static str>,
    /// 纬度字段名
    pub latitude_field: Option<&'static str>,
    /// 经度字段名
    pub longitude_field: Option<&'static str>,
    /// 状态字段名（用于检查 API 是否成功）
    pub status_field: Option<&'static str>,
    /// 成功状态值
    pub status_success_value: Option<&'static str>,
}

/// IP 信息
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IpInfo {
    /// IP 地址
    pub ip: String,
    /// 国家
    #[serde(default)]
    pub country: String,
    /// 国家代码
    #[serde(default)]
    pub country_code: String,
    /// 城市
    #[serde(default)]
    pub city: String,
    /// 地区
    #[serde(default)]
    pub region: String,
    /// ISP
    #[serde(default)]
    pub isp: String,
    /// 时区
    #[serde(default)]
    pub timezone: String,
    /// 纬度
    #[serde(default)]
    pub latitude: String,
    /// 经度
    #[serde(default)]
    pub longitude: String,
}

/// 代理测试结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyTestResult {
    /// 是否成功
    pub success: bool,
    /// IP 信息（成功时）
    #[serde(default)]
    pub ip_info: Option<IpInfo>,
    /// 延迟（毫秒）
    #[serde(default)]
    pub latency_ms: Option<u64>,
    /// 错误信息（失败时）
    #[serde(default)]
    pub error: Option<String>,
    /// 时区（便捷访问）
    #[serde(default)]
    pub timezone: String,
    /// 消息（便捷访问错误信息）
    #[serde(default)]
    pub message: String,
}

impl ProxyTestResult {
    /// 创建成功结果
    pub fn success(ip_info: IpInfo, latency_ms: u64) -> Self {
        let timezone = ip_info.timezone.clone();
        Self {
            success: true,
            ip_info: Some(ip_info),
            latency_ms: Some(latency_ms),
            error: None,
            timezone,
            message: String::new(),
        }
    }

    /// 创建失败结果
    pub fn failure(error: impl Into<String>) -> Self {
        let error_msg = error.into();
        Self {
            success: false,
            ip_info: None,
            latency_ms: None,
            error: Some(error_msg.clone()),
            timezone: String::new(),
            message: error_msg,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proxy_config_deserialize_plain_password() {
        let json = r#"{
            "proxy_type": "socks5",
            "host": "example.com",
            "port": 1080,
            "username": "user",
            "password": {
                "value": "plain_pass",
                "encrypted": false
            }
        }"#;

        let config: ProxyConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.host, "example.com");
        assert!(config.password.is_some());

        let password = config.password.as_ref().unwrap();
        assert_eq!(password.value, "plain_pass");
        assert_eq!(password.encrypted, false);
        assert_eq!(password.get_plain_password().unwrap(), "plain_pass");
    }

    #[test]
    fn test_proxy_config_deserialize_encrypted_password() {
        let json = r#"{
            "proxy_type": "socks5",
            "host": "example.com",
            "port": 1080,
            "username": "user",
            "password": {
                "value": "encrypted_base64",
                "encrypted": true
            }
        }"#;

        let config: ProxyConfig = serde_json::from_str(json).unwrap();
        assert!(config.password.is_some());

        let password = config.password.as_ref().unwrap();
        assert_eq!(password.value, "encrypted_base64");
        assert_eq!(password.encrypted, true);
        assert_eq!(password.get_plain_password().unwrap(), "encrypted_base64");
    }

    #[test]
    fn test_proxy_config_deserialize_password_default_plain() {
        // 测试默认 encrypted = false
        let json = r#"{
            "proxy_type": "socks5",
            "host": "example.com",
            "port": 1080,
            "username": "user",
            "password": {
                "value": "some_password"
            }
        }"#;

        let config: ProxyConfig = serde_json::from_str(json).unwrap();
        let password = config.password.as_ref().unwrap();
        assert_eq!(password.encrypted, false);
    }

    #[test]
    fn test_proxy_config_deserialize_no_password() {
        let json = r#"{
            "proxy_type": "http",
            "host": "example.com",
            "port": 8080
        }"#;

        let config: ProxyConfig = serde_json::from_str(json).unwrap();
        assert!(config.password.is_none());
    }

    #[test]
    fn test_proxy_config_deserialize_null_password() {
        let json = r#"{
            "proxy_type": "http",
            "host": "example.com",
            "port": 8080,
            "password": null
        }"#;

        let config: ProxyConfig = serde_json::from_str(json).unwrap();
        assert!(config.password.is_none());
    }
}
