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

    pub async fn reload_config(&self, config_path: &str) -> Result<()> {
        let payload = serde_json::json!({
            "path": config_path,
            "payload": "",
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
            .with_context(|| format!("请求 Mihomo 接口失败: {path_label}"))?
            .error_for_status()
            .with_context(|| format!("Mihomo 接口返回异常状态: {path_label}"))?;

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
            .with_context(|| format!("请求 Mihomo 接口失败: {path_label}"))?
            .error_for_status()
            .with_context(|| format!("Mihomo 接口返回异常状态: {path_label}"))?;

        let _ = response.bytes().await;
        Ok(())
    }
}
