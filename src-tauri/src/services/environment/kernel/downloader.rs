//! 内核下载模块

use crate::core::error::Result;
use crate::core::utils::hash::calculate_file_hash;
use crate::domain::environment::{EnvironmentStatus, KernelDetail};
use futures::StreamExt;
use reqwest::{header, StatusCode};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::time::timeout;

use super::types::KernelStatusEmitter;
use super::utils::{
    core_dll_name, emit_status, exe_name, extract_zip_to_dir, matched_core_dll_signature,
};
use super::verifier::find_core_dll_dir;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(20);
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(45);
/// 超过这么久一个字节都没收到，就当连接已经断了
const STALL_TIMEOUT: Duration = Duration::from_secs(45);
const RETRY_BASE_DELAY: Duration = Duration::from_secs(2);
const MAX_RETRY_DELAY: Duration = Duration::from_secs(30);

/// 没有可用内核时的尝试次数（连续失败才计数，有进展就重新计）
pub const REQUIRED_DOWNLOAD_ATTEMPTS: u32 = 6;

/// 下载并安装内核
///
/// # 流程
/// 1. 下载 zip 文件
/// 2. 校验文件哈希
/// 3. 解压到目标目录
/// 4. 校验核心 DLL 的 signature
/// 5. 清理临时文件
pub async fn download_and_install_kernel(
    app: &tauri::AppHandle,
    env_uuid: &Option<String>,
    kernel_value: &str,
    kernel_dir: &Path,
    kernel_detail: &KernelDetail,
    download_attempts: u32,
    status_emitter: Option<KernelStatusEmitter>,
) -> Result<PathBuf> {
    if kernel_detail.url.is_empty() {
        return Err("未提供内核下载地址".into());
    }

    emit_status(
        status_emitter.as_ref(),
        env_uuid,
        kernel_value,
        EnvironmentStatus::Downloading,
        Some("下载中…"),
        Some(0.0),
        Some(0),
        None,
    );

    let temp_dir = crate::core::paths::PathManager::get_kernel_cache_dir(app)?;
    fs::create_dir_all(&temp_dir)?;

    // 文件名由内核包哈希决定：这次没下完，下次还能接着下
    let hash_prefix: String = kernel_detail.hash.trim().chars().take(16).collect();
    let zip_path = temp_dir.join(format!("{kernel_value}-{hash_prefix}.zip"));

    // 下载文件
    download_file(
        env_uuid,
        kernel_value,
        &kernel_detail.url,
        &zip_path,
        download_attempts,
        status_emitter.clone(),
    )
    .await?;

    // 校验下载文件哈希
    verify_download_hash(
        env_uuid,
        kernel_value,
        &zip_path,
        &kernel_detail.hash,
        status_emitter.clone(),
    )?;

    // 解压或移动文件
    extract_or_move_kernel(
        env_uuid,
        kernel_value,
        &zip_path,
        kernel_dir,
        kernel_detail.requires_extract,
        kernel_detail.engine,
        status_emitter.clone(),
    )?;

    let exe_path = kernel_dir.join(exe_name(kernel_detail.engine));
    if !exe_path.exists() {
        emit_status(
            status_emitter.as_ref(),
            env_uuid,
            kernel_value,
            EnvironmentStatus::Error,
            Some("未找到可执行文件"),
            None,
            None,
            None,
        );
        return Err("解压后未找到可执行文件".into());
    }

    super::utils::validate_kernel_package_layout(kernel_dir, kernel_detail.engine).map_err(|error| {
        emit_status(
            status_emitter.as_ref(),
            env_uuid,
            kernel_value,
            EnvironmentStatus::Error,
            Some("内核包不完整"),
            None,
            None,
            None,
        );
        error
    })?;

    // 校验核心 DLL 的 signature
    if let Some(ref sig) = kernel_detail.signature {
        verify_core_dll_signature(
            env_uuid,
            kernel_value,
            kernel_dir,
            kernel_detail.engine,
            sig,
            status_emitter.clone(),
        )?;
    }

    emit_status(
        status_emitter.as_ref(),
        env_uuid,
        kernel_value,
        EnvironmentStatus::Ready,
        Some("就绪"),
        None,
        None,
        None,
    );

    Ok(exe_path)
}

/// 下载文件：连接和读取都有超时，失败自动重试，断点续传
async fn download_file(
    env_uuid: &Option<String>,
    kernel_value: &str,
    url: &str,
    zip_path: &Path,
    max_attempts: u32,
    status_emitter: Option<KernelStatusEmitter>,
) -> Result<()> {
    let display_url = redact_download_url(url);
    crate::log_info!(
        crate::core::logger::modules::KERNEL,
        "开始下载内核: {}",
        display_url
    );
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .build()?;

    let mut last_emitted_pct: f64 = -1.0;
    let progress_emitter = status_emitter.clone();
    let retry_emitter = status_emitter.clone();
    let result = download_with_retries(
        &client,
        url,
        zip_path,
        max_attempts,
        RETRY_BASE_DELAY,
        |downloaded, total| {
            let Some(total) = total.filter(|total| *total > 0) else {
                return;
            };
            let pct = (downloaded as f64 / total as f64) * 100.0;
            if (pct - last_emitted_pct) >= 1.0 || downloaded >= total {
                last_emitted_pct = pct;
                emit_status(
                    progress_emitter.as_ref(),
                    env_uuid,
                    kernel_value,
                    EnvironmentStatus::Downloading,
                    Some("下载中…"),
                    Some(pct.min(100.0)),
                    Some(downloaded),
                    Some(total),
                );
            }
        },
        |failures, reason| {
            crate::log_warn!(
                crate::core::logger::modules::KERNEL,
                "内核下载中断（第 {} 次）: {} - {}",
                failures,
                display_url,
                reason
            );
            let message = format!("下载中断（{reason}），正在重试…");
            emit_status(
                retry_emitter.as_ref(),
                env_uuid,
                kernel_value,
                EnvironmentStatus::Downloading,
                Some(message.as_str()),
                None,
                None,
                None,
            );
        },
    )
    .await;

    result.map_err(|reason| {
        crate::log_error!(
            crate::core::logger::modules::KERNEL,
            "内核下载失败: {} - {}",
            display_url,
            reason
        );
        let message = format!("下载失败：{reason}");
        emit_status(
            status_emitter.as_ref(),
            env_uuid,
            kernel_value,
            EnvironmentStatus::Error,
            Some(message.as_str()),
            None,
            None,
            None,
        );
        format!("内核下载失败：{reason}").into()
    })
}

enum AttemptFailure {
    /// 网络抖动、服务器临时错误，可以再试
    Retryable(String),
    /// 地址失效、磁盘写不进去，再试也没用
    Fatal(String),
}

fn local_size(path: &Path) -> u64 {
    fs::metadata(path).map(|metadata| metadata.len()).unwrap_or(0)
}

fn is_retryable_status(status: StatusCode) -> bool {
    status.is_server_error()
        || status == StatusCode::REQUEST_TIMEOUT
        || status == StatusCode::TOO_MANY_REQUESTS
}

/// 解析 `Content-Range`，返回 (起始位置, 文件总大小)。
/// 形如 `bytes 4-9/10`、`bytes 4-9/*`、`bytes */10`（416 响应，没有起始位置）。
fn parse_content_range(value: &str) -> Option<(Option<u64>, Option<u64>)> {
    let (range, total) = value.strip_prefix("bytes ")?.trim().split_once('/')?;
    let start = match range {
        "*" => None,
        _ => Some(range.split_once('-')?.0.parse().ok()?),
    };
    Some((start, total.parse().ok()))
}

fn content_range_of(response: &reqwest::Response) -> Option<(Option<u64>, Option<u64>)> {
    response
        .headers()
        .get(header::CONTENT_RANGE)?
        .to_str()
        .ok()
        .and_then(parse_content_range)
}

async fn download_with_retries<P, R>(
    client: &reqwest::Client,
    url: &str,
    path: &Path,
    max_attempts: u32,
    base_delay: Duration,
    mut on_progress: P,
    mut on_retry: R,
) -> std::result::Result<(), String>
where
    P: FnMut(u64, Option<u64>) + Send,
    R: FnMut(u32, &str) + Send,
{
    let mut failures = 0u32;
    let mut best_size = local_size(path);
    loop {
        let reason = match fetch_once(client, url, path, &mut on_progress).await {
            Ok(()) => return Ok(()),
            Err(AttemptFailure::Fatal(reason)) => return Err(reason),
            Err(AttemptFailure::Retryable(reason)) => reason,
        };
        let size = local_size(path);
        if size > best_size {
            // 有进展就不算连续失败：网络差但一直在往前走的下载不该被放弃
            best_size = size;
            failures = 0;
        }
        failures += 1;
        if failures >= max_attempts {
            return Err(format!("{reason}（已连续失败 {failures} 次）"));
        }
        on_retry(failures, &reason);
        let delay = base_delay
            .saturating_mul(1u32 << (failures - 1).min(8))
            .min(MAX_RETRY_DELAY);
        tokio::time::sleep(delay).await;
    }
}

/// 发一次请求，把内容接到本地文件后面
async fn fetch_once<P>(
    client: &reqwest::Client,
    url: &str,
    path: &Path,
    on_progress: &mut P,
) -> std::result::Result<(), AttemptFailure>
where
    P: FnMut(u64, Option<u64>) + Send,
{
    let existing = local_size(path);
    let mut request = client.get(url);
    if existing > 0 {
        request = request.header(header::RANGE, format!("bytes={existing}-"));
    }
    let response = match timeout(RESPONSE_TIMEOUT, request.send()).await {
        Err(_) => return Err(AttemptFailure::Retryable("服务器长时间没有响应".to_string())),
        // without_url：错误信息会显示给用户，不带上下载地址
        Ok(Err(error)) => {
            return Err(AttemptFailure::Retryable(format!(
                "连接失败: {}",
                error.without_url()
            )))
        }
        Ok(Ok(response)) => response,
    };
    let status = response.status();

    if status == StatusCode::RANGE_NOT_SATISFIABLE {
        // 上次其实已经下完了（是否完好由后面的哈希校验把关）；否则丢掉本地文件重下
        if existing > 0 && content_range_of(&response).and_then(|(_, total)| total) == Some(existing) {
            return Ok(());
        }
        fs::remove_file(path).map_err(|error| AttemptFailure::Fatal(error.to_string()))?;
        return Err(AttemptFailure::Retryable("本地缓存已失效".to_string()));
    }
    if !status.is_success() {
        let reason = format!("HTTP {}", status.as_u16());
        return Err(if is_retryable_status(status) {
            AttemptFailure::Retryable(reason)
        } else {
            AttemptFailure::Fatal(reason)
        });
    }

    let (mut downloaded, total, mut file) = if status == StatusCode::PARTIAL_CONTENT {
        let (start, total) = content_range_of(&response).unwrap_or((None, None));
        if start != Some(existing) {
            fs::remove_file(path).map_err(|error| AttemptFailure::Fatal(error.to_string()))?;
            return Err(AttemptFailure::Retryable("续传位置不一致".to_string()));
        }
        let total = total.or_else(|| response.content_length().map(|rest| existing + rest));
        let file = fs::OpenOptions::new()
            .append(true)
            .open(path)
            .map_err(|error| AttemptFailure::Fatal(format!("打开缓存文件失败: {error}")))?;
        (existing, total, file)
    } else {
        // 服务器不支持续传时返回 200，只能从头再来
        let file = fs::File::create(path)
            .map_err(|error| AttemptFailure::Fatal(format!("创建文件失败: {error}")))?;
        (0, response.content_length(), file)
    };

    let mut stream = response.bytes_stream();
    loop {
        let chunk = match timeout(STALL_TIMEOUT, stream.next()).await {
            Err(_) => return Err(AttemptFailure::Retryable("下载长时间没有进展".to_string())),
            Ok(None) => break,
            Ok(Some(Err(error))) => {
                return Err(AttemptFailure::Retryable(format!(
                    "连接中断: {}",
                    error.without_url()
                )))
            }
            Ok(Some(Ok(chunk))) => chunk,
        };
        file.write_all(&chunk)
            .map_err(|error| AttemptFailure::Fatal(format!("保存文件失败: {error}")))?;
        downloaded += chunk.len() as u64;
        on_progress(downloaded, total);
    }

    match total {
        Some(total) if downloaded < total => {
            Err(AttemptFailure::Retryable("连接提前结束".to_string()))
        }
        _ => Ok(()),
    }
}

fn redact_download_url(url: &str) -> String {
    match reqwest::Url::parse(url) {
        Ok(mut parsed) => {
            let _ = parsed.set_username("");
            let _ = parsed.set_password(None);
            parsed.set_query(None);
            parsed.set_fragment(None);
            parsed.to_string()
        }
        Err(_) => "<invalid kernel download URL>".to_string(),
    }
}

/// 校验下载文件哈希
fn verify_download_hash(
    env_uuid: &Option<String>,
    kernel_value: &str,
    zip_path: &Path,
    expected_hash: &str,
    status_emitter: Option<KernelStatusEmitter>,
) -> Result<()> {
    let actual_hash = calculate_file_hash(zip_path)?;
    let expected = expected_hash.trim().to_lowercase();
    let actual = actual_hash.to_lowercase();

    if actual != expected {
        let _ = fs::remove_file(zip_path);
        emit_status(
            status_emitter.as_ref(),
            env_uuid,
            kernel_value,
            EnvironmentStatus::Error,
            Some("校验失败"),
            None,
            None,
            None,
        );
        return Err(format!(
            "下载文件校验失败（哈希不一致），请重试。预期: {} 实际: {}",
            expected, actual
        )
        .into());
    }

    Ok(())
}

/// 解压或移动内核文件
fn extract_or_move_kernel(
    env_uuid: &Option<String>,
    kernel_value: &str,
    zip_path: &Path,
    kernel_dir: &Path,
    requires_extract: bool,
    engine: crate::domain::environment::KernelEngine,
    status_emitter: Option<KernelStatusEmitter>,
) -> Result<()> {
    if requires_extract {
        emit_status(
            status_emitter.as_ref(),
            env_uuid,
            kernel_value,
            EnvironmentStatus::Extracting,
            Some("解压中…"),
            None,
            None,
            None,
        );
        fs::create_dir_all(kernel_dir)?;
        extract_zip_to_dir(zip_path, kernel_dir).map_err(|e| {
            emit_status(
                status_emitter.as_ref(),
                env_uuid,
                kernel_value,
                EnvironmentStatus::Error,
                Some("解压失败"),
                None,
                None,
                None,
            );
            e
        })?;
        fs::remove_file(zip_path)?;
    } else {
        fs::create_dir_all(kernel_dir)?;
        let dest = kernel_dir.join(exe_name(engine));
        if fs::rename(zip_path, &dest).is_err() {
            fs::copy(zip_path, &dest)?;
            fs::remove_file(zip_path)?;
        }
    }

    Ok(())
}

/// 校验核心 DLL 的 signature
fn verify_core_dll_signature(
    env_uuid: &Option<String>,
    kernel_value: &str,
    kernel_dir: &Path,
    engine: crate::domain::environment::KernelEngine,
    signature: &str,
    status_emitter: Option<KernelStatusEmitter>,
) -> Result<()> {
    let expected = signature.trim().to_lowercase();
    if expected.is_empty() {
        return Ok(());
    }

    let version_dir = find_core_dll_dir(kernel_dir, engine).map_err(|e| {
        emit_status(
            status_emitter.as_ref(),
            env_uuid,
            kernel_value,
            EnvironmentStatus::Error,
            Some("未找到版本目录"),
            None,
            None,
            None,
        );
        e
    })?;
    let dll_path = version_dir.join(core_dll_name(engine));

    if !dll_path.exists() {
        emit_status(
            status_emitter.as_ref(),
            env_uuid,
            kernel_value,
            EnvironmentStatus::Error,
            Some("未找到核心 DLL"),
            None,
            None,
            None,
        );
        return Err("解压后未找到核心 DLL 文件".into());
    }

    if matched_core_dll_signature(&dll_path, std::slice::from_ref(&expected))?.is_none() {
        emit_status(
            status_emitter.as_ref(),
            env_uuid,
            kernel_value,
            EnvironmentStatus::Error,
            Some("核心 DLL 校验失败"),
            None,
            None,
            None,
        );
        return Err("解压后核心 DLL 校验失败（与 signature 不一致），请重试".into());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{download_with_retries, parse_content_range, redact_download_url};
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    /// 按顺序回放预设的 HTTP 响应，并记下每个请求的请求头
    async fn serve(responses: Vec<Vec<u8>>) -> (String, Arc<Mutex<Vec<String>>>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/kernel.zip", listener.local_addr().unwrap());
        let seen = Arc::new(Mutex::new(Vec::new()));
        let log = seen.clone();
        tokio::spawn(async move {
            for response in responses {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut buffer = vec![0u8; 4096];
                let n = socket.read(&mut buffer).await.unwrap();
                log.lock().unwrap().push(String::from_utf8_lossy(&buffer[..n]).to_lowercase());
                socket.write_all(&response).await.unwrap();
                let _ = socket.shutdown().await;
            }
        });
        (url, seen)
    }

    fn temp_file() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("mz-download-{}.zip", uuid::Uuid::new_v4()))
    }

    async fn run(url: &str, path: &std::path::Path, attempts: u32) -> Result<(), String> {
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        download_with_retries(&client, url, path, attempts, Duration::ZERO, |_, _| {}, |_, _| {}).await
    }

    #[tokio::test]
    async fn an_interrupted_download_resumes_where_it_stopped() {
        let (url, seen) = serve(vec![
            b"HTTP/1.1 200 OK\r\nContent-Length: 10\r\nConnection: close\r\n\r\n0123".to_vec(),
            b"HTTP/1.1 206 Partial Content\r\nContent-Range: bytes 4-9/10\r\nContent-Length: 6\r\nConnection: close\r\n\r\n456789".to_vec(),
        ])
        .await;
        let path = temp_file();
        run(&url, &path, 3).await.unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"0123456789");
        assert!(seen.lock().unwrap()[1].contains("range: bytes=4-"));
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn server_errors_are_retried() {
        let (url, _) = serve(vec![
            b"HTTP/1.1 504 Gateway Timeout\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec(),
            b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok".to_vec(),
        ])
        .await;
        let path = temp_file();
        run(&url, &path, 3).await.unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"ok");
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn a_missing_file_is_not_retried_and_the_attempt_limit_is_reported() {
        let (url, seen) = serve(vec![
            b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec(),
        ])
        .await;
        let path = temp_file();
        assert_eq!(run(&url, &path, 3).await.unwrap_err(), "HTTP 404");
        assert_eq!(seen.lock().unwrap().len(), 1);

        let unavailable = b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec();
        let (url, seen) = serve(vec![unavailable.clone(), unavailable]).await;
        let error = run(&url, &path, 2).await.unwrap_err();
        assert!(error.starts_with("HTTP 503"), "{error}");
        assert_eq!(seen.lock().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn a_file_that_was_already_complete_is_kept() {
        let (url, _) = serve(vec![
            b"HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */3\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec(),
        ])
        .await;
        let path = temp_file();
        std::fs::write(&path, b"abc").unwrap();
        run(&url, &path, 2).await.unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"abc");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn content_range_forms() {
        assert_eq!(parse_content_range("bytes 4-9/10"), Some((Some(4), Some(10))));
        assert_eq!(parse_content_range("bytes 4-9/*"), Some((Some(4), None)));
        assert_eq!(parse_content_range("bytes */10"), Some((None, Some(10))));
        assert_eq!(parse_content_range("items 1-2/3"), None);
    }

    #[test]
    fn download_log_url_does_not_include_credentials() {
        assert_eq!(
            redact_download_url(
                "https://user:password@example.test/kernel.zip?token=secret#fragment"
            ),
            "https://example.test/kernel.zip"
        );
        assert_eq!(
            redact_download_url("not a url"),
            "<invalid kernel download URL>"
        );
    }
}
