/// 文件下载服务
///
/// 提供文件下载功能，支持重试和并发下载
use crate::core::error::Result;
use futures::StreamExt;
use reqwest::Client;
use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::time::Duration;
use tokio::time;

pub struct DownloadService;

impl DownloadService {
    /// 下载多个文件
    ///
    /// # 参数
    /// - `urls`: 下载地址列表
    /// - `save_paths`: 保存路径列表
    /// - `max_retries`: 最大重试次数（默认 3 次）
    /// - `retry_delay_ms`: 重试间隔（默认 500 毫秒）
    ///
    /// # 返回
    /// HashMap，key 为 URL，value 为是否下载成功
    pub async fn download_files(
        urls: Vec<String>,
        save_paths: Vec<String>,
        max_retries: Option<u32>,
        retry_delay_ms: Option<u64>,
    ) -> Result<HashMap<String, bool>> {
        if urls.len() != save_paths.len() {
            return Err("URLs 和保存路径数量不一致".into());
        }

        let retry_times = max_retries.unwrap_or(3);
        let retry_delay = Duration::from_millis(retry_delay_ms.unwrap_or(500));
        let client = Client::new();

        // 并发下载任务
        let tasks = urls.into_iter().zip(save_paths.into_iter()).map(|(url, path)| {
            let client = client.clone();
            async move {
                let success =
                    Self::download_with_retry(&client, &url, &path, retry_times, retry_delay).await;
                (url, success)
            }
        });

        let results = futures::future::join_all(tasks).await;
        Ok(results.into_iter().collect())
    }

    /// 下载指定资源（支持重试）
    async fn download_with_retry(
        client: &Client,
        url: &str,
        save_path: &str,
        max_retries: u32,
        delay: Duration,
    ) -> bool {
        for attempt in 1..=max_retries {
            match Self::download(client, url, save_path).await {
                Ok(_) => return true,
                Err(e) => {
                    log::warn!(
                        "下载失败 (尝试 {}/{}): {} -> {}",
                        attempt,
                        max_retries,
                        url,
                        e
                    );
                    if attempt < max_retries {
                        time::sleep(delay).await;
                    }
                }
            }
        }

        false
    }

    /// 执行单个文件下载
    async fn download(client: &Client, url: &str, save_path: &str) -> Result<()> {
        let res = client.get(url).send().await?;

        if res.status().as_u16() == 404 {
            return Err("资源丢失".into());
        }

        let mut stream = res.bytes_stream();
        let mut file = File::create(save_path)?;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk)?;
        }

        Ok(())
    }
}
