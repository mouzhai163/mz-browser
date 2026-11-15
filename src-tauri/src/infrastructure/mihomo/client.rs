use anyhow::{Context, Result, anyhow};
use reqwest::{Client, Url, header};
use serde_json::Value;
use std::time::Duration;

use super::models::{
    MihomoConnectionConfig, RawGroupsResponse, RawProvidersResponse, RawProxiesResponse,
    RawVersionResponse,
};

#[derive(Clone)]
pub struct MihomoClient {
    base_url: Url,
    secret: String,
    http: Client,
}

impl MihomoClient {
    pub fn new(config: &MihomoConnectionConfig) -> Result<Self> {
        let controller = config.controller.trim();
        if controller.is_empty() {
            return Err(anyhow!("请输入 Mihomo external-controller 地址"));
        }

        let normalized = if controller.starts_with("http://") || controller.starts_with("https://")
        {
            controller.to_string()
        } else {
            format!("http://{controller}")
        };

        let mut base_url =
            Url::parse(&normalized).with_context(|| "Mihomo external-controller 地址无效")?;
        if !base_url.path().ends_with('/') {
            let path = format!("{}/", base_url.path().trim_end_matches('/'));
            base_url.set_path(&path);
        }

        let http = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .context("创建 Mihomo HTTP 客户端失败")?;

        Ok(Self {
            base_url,
            secret: config.secret.trim().to_string(),
            http,
        })
    }

    pub async fn fetch_version(&self) -> Result<RawVersionResponse> {
        self.get_json_segments(&["version"], &[]).await
    }

    pub async fn fetch_providers(&self) -> Result<RawProvidersResponse> {
        self.get_json_segments(&["providers", "proxies"], &[]).await
    }

    pub async fn fetch_groups(&self) -> Result<RawGroupsResponse> {
        self.get_json_segments(&["group"], &[]).await
    }

    pub async fn fetch_proxies(&self) -> Result<RawProxiesResponse> {
        self.get_json_segments(&["proxies"], &[]).await
    }

    pub async fn test_proxy_delay(
        &self,
        proxy_name: &str,
        test_url: &str,
        timeout_ms: u64,
    ) -> Result<Option<u64>> {
        let payload = self
            .get_json_segments::<Value>(
                &["proxies", proxy_name, "delay"],
                &[
                    ("url", test_url.to_string()),
                    ("timeout", timeout_ms.to_string()),
                ],
            )
            .await?;

        Ok(payload.get("delay").and_then(|value| {
            value.as_u64().or_else(|| {
                value
                    .as_i64()
                    .and_then(|delay| if delay >= 0 { Some(delay as u64) } else { None })
            })
        }))
    }

    pub async fn reload_config(&self, config_yaml: &str) -> Result<()> {
        if config_yaml.trim().is_empty() {
            return Err(anyhow!("Mihomo 配置内容为空，拒绝重载"));
        }
        // Service-mode Mihomo uses a separate runtime directory. Send the YAML
        // through the supported payload API instead of asking the service to
        // read a user-directory path outside its allowed filesystem roots.
        let payload = serde_json::json!({
            "path": "",
            "payload": config_yaml,
        });
        self.put_json_segments_without_body(
            &["configs"],
            &[("force", "true".to_string())],
            &payload,
        )
        .await
    }

    async fn get_json_segments<T>(&self, segments: &[&str], query: &[(&str, String)]) -> Result<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let mut url = self.base_url.clone();
        {
            let mut path_segments =
                url.path_segments_mut().map_err(|_| anyhow!("构建 Mihomo 请求地址失败"))?;
            path_segments.pop_if_empty();
            for segment in segments {
                path_segments.push(segment);
            }
        }
        if !query.is_empty() {
            let mut query_pairs = url.query_pairs_mut();
            for (key, value) in query {
                query_pairs.append_pair(key, value);
            }
        }
        let mut request = self.http.get(url);
        let path_label = format!("/{}", segments.join("/"));

        if !self.secret.is_empty() {
            request = request.header(header::AUTHORIZATION, format!("Bearer {}", self.secret));
        }

        let response = request
            .send()
            .await
            .with_context(|| format!("请求 Mihomo 接口失败: {path_label}"))?;
        let response = self.check_response(response, &path_label).await?;

        response
            .json::<T>()
            .await
            .with_context(|| format!("解析 Mihomo 接口响应失败: {path_label}"))
    }

    async fn put_json_segments_without_body(
        &self,
        segments: &[&str],
        query: &[(&str, String)],
        payload: &Value,
    ) -> Result<()> {
        let mut url = self.base_url.clone();
        {
            let mut path_segments =
                url.path_segments_mut().map_err(|_| anyhow!("构建 Mihomo 请求地址失败"))?;
            path_segments.pop_if_empty();
            for segment in segments {
                path_segments.push(segment);
            }
        }
        if !query.is_empty() {
            let mut query_pairs = url.query_pairs_mut();
            for (key, value) in query {
                query_pairs.append_pair(key, value);
            }
        }
        let mut request = self.http.put(url).json(payload);
        let path_label = format!("/{}", segments.join("/"));

        if !self.secret.is_empty() {
            request = request.header(header::AUTHORIZATION, format!("Bearer {}", self.secret));
        }

        let response = request
            .send()
            .await
            .with_context(|| format!("请求 Mihomo 接口失败: {path_label}"))?;
        let response = self.check_response(response, &path_label).await?;

        let _ = response.bytes().await;
        Ok(())
    }

    async fn check_response(
        &self,
        mut response: reqwest::Response,
        path_label: &str,
    ) -> Result<reqwest::Response> {
        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }

        // Only retain a bounded error response, never a successful configuration
        // document (which can contain credentials).
        const MAX_ERROR_BYTES: usize = 8192;
        let mut body = Vec::new();
        while body.len() < MAX_ERROR_BYTES {
            match response.chunk().await {
                Ok(Some(chunk)) => {
                    let remaining = MAX_ERROR_BYTES - body.len();
                    body.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
                }
                _ => break,
            }
        }
        Err(anyhow!(format_api_error(
            path_label,
            status,
            &body,
            &self.secret
        )))
    }
}

fn format_api_error(path: &str, status: reqwest::StatusCode, body: &[u8], secret: &str) -> String {
    // Mihomo returns {"message": "..."}. Do not expose arbitrary response fields
    // or HTML bodies, and redact the controller secret if the server echoes it.
    let message = serde_json::from_slice::<Value>(body)
        .ok()
        .and_then(|value| value.get("message").and_then(Value::as_str).map(str::to_owned))
        .unwrap_or_default();
    let message = if secret.is_empty() {
        message
    } else {
        message.replace(secret, "[REDACTED]")
    };
    let message: String = message.chars().take(1024).collect();
    if message.trim().is_empty() {
        format!("Mihomo 接口返回异常状态: {path}，HTTP {status}")
    } else {
        format!("Mihomo 接口返回异常状态: {path}，HTTP {status}；{message}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_YAML: &str = "mode: rule\nlisteners:\n  - name: mz-node-001\n    type: http\n    port: 17601\n    listen: 127.0.0.1\n    proxy: DIRECT\n";

    async fn mock_controller(response: &'static str) -> MihomoClient {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            let mut buffer = [0; 4096];
            loop {
                let size = stream.read(&mut buffer).await.unwrap();
                assert!(size > 0, "request ended before its body arrived");
                request.extend_from_slice(&buffer[..size]);
                assert!(request.len() < 8192);
                let Some(header_end) = request.windows(4).position(|part| part == b"\r\n\r\n")
                else {
                    continue;
                };
                let headers = String::from_utf8_lossy(&request[..header_end]);
                assert!(headers.starts_with("PUT /configs?force=true "));
                let body_len: usize = headers
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        name.eq_ignore_ascii_case("content-length")
                            .then(|| value.trim().parse().unwrap())
                    })
                    .unwrap();
                let body_start = header_end + 4;
                if request.len() < body_start + body_len {
                    continue;
                }
                let body: Value =
                    serde_json::from_slice(&request[body_start..body_start + body_len]).unwrap();
                assert_eq!(body["path"], "");
                assert_eq!(body["payload"], TEST_YAML);
                break;
            }
            stream.write_all(response.as_bytes()).await.unwrap();
        });
        MihomoClient::new(&MihomoConnectionConfig {
            controller: address.to_string(),
            secret: String::new(),
            config_path: "unused.yaml".to_string(),
        })
        .unwrap()
    }

    #[tokio::test]
    async fn reload_surfaces_controller_error_body() {
        let client = mock_controller("HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"message\":\"path rejected by SAFE_PATHS\"}").await;
        let error = client.reload_config(TEST_YAML).await.unwrap_err().to_string();
        assert!(error.contains("HTTP 400"));
        assert!(error.contains("path rejected by SAFE_PATHS"));
    }

    #[tokio::test]
    async fn reload_accepts_no_content_success() {
        let client = mock_controller("HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n").await;
        client.reload_config(TEST_YAML).await.unwrap();
    }

    #[tokio::test]
    async fn reload_rejects_empty_payload_instead_of_reloading_default_path() {
        let client = MihomoClient::new(&MihomoConnectionConfig {
            controller: "127.0.0.1:9".to_string(),
            secret: String::new(),
            config_path: "unused.yaml".to_string(),
        })
        .unwrap();
        let error = client.reload_config(" \n").await.unwrap_err().to_string();
        assert!(error.contains("配置内容为空"));
    }

    #[test]
    fn includes_http_status_and_mihomo_error_reason() {
        let result = format_api_error(
            "/configs",
            reqwest::StatusCode::BAD_REQUEST,
            br#"{"message":"path is not subpath of home directory or SAFE_PATHS"}"#,
            "",
        );
        assert!(result.contains("HTTP 400"));
        assert!(result.contains("SAFE_PATHS"));
        assert!(result.contains("/configs"));
    }

    #[test]
    fn preserves_status_when_body_is_not_json() {
        let result = format_api_error(
            "/configs",
            reqwest::StatusCode::FORBIDDEN,
            b"<html>denied</html>",
            "",
        );
        assert!(result.contains("HTTP 403"));
        assert!(!result.contains("<html>"));
    }

    #[test]
    fn redacts_secret_and_ignores_other_fields() {
        let result = format_api_error(
            "/configs",
            reqwest::StatusCode::UNAUTHORIZED,
            br#"{"message":"invalid test-secret","secret":"other-sensitive-data"}"#,
            "test-secret",
        );
        assert!(result.contains("[REDACTED]"));
        assert!(!result.contains("test-secret"));
        assert!(!result.contains("other-sensitive-data"));
    }

    #[test]
    fn limits_error_message_length() {
        let body = serde_json::to_vec(&serde_json::json!({"message": "x".repeat(5000)})).unwrap();
        let result = format_api_error("/configs", reqwest::StatusCode::BAD_REQUEST, &body, "");
        assert!(result.chars().count() < 1200);
    }
}
