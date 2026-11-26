//! 内核下载模块

use crate::core::error::Result;
use crate::core::utils::hash::calculate_file_hash;
use crate::domain::environment::{EnvironmentStatus, KernelDetail};
use futures::StreamExt;
use reqwest::{StatusCode, header};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::timeout;

use super::download_control::KernelDownloadControl;
use super::types::{KernelDownloadEventState, KernelPrepareStatusPayload, KernelStatusEmitter};
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

    // 下载文件。控制任务按安装目录注册，暂停期间保持当前准备调用不返回，恢复后继续原流程。
    let download_control =
        super::download_control::register_kernel_download_control(kernel_value).await;
    let download_result = download_file(
        app,
        env_uuid,
        kernel_value,
        &kernel_detail.url,
        &zip_path,
        download_attempts,
        status_emitter.clone(),
        download_control.clone(),
    )
    .await;
    super::download_control::unregister_kernel_download_control(kernel_value, &download_control)
        .await;
    download_result?;

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

    super::utils::validate_kernel_package_layout(kernel_dir, kernel_detail.engine).map_err(
        |error| {
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
        },
    )?;

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

#[derive(Debug, Clone, Copy, Default)]
struct DownloadProgressSnapshot {
    downloaded: u64,
    total: Option<u64>,
    percent: Option<f64>,
}

fn emit_download_state(
    status_emitter: Option<&KernelStatusEmitter>,
    env_uuid: &Option<String>,
    kernel_value: &str,
    download_state: KernelDownloadEventState,
    snapshot: DownloadProgressSnapshot,
) {
    let Some(emitter) = status_emitter else {
        return;
    };
    let (status, message) = match download_state {
        KernelDownloadEventState::Paused => (EnvironmentStatus::Downloading, "下载已暂停"),
        KernelDownloadEventState::Cancelled => (EnvironmentStatus::Error, "下载已取消"),
    };
    emitter(KernelPrepareStatusPayload {
        env_uuid: env_uuid.clone(),
        kernel_value: kernel_value.to_string(),
        status,
        message: Some(message.to_string()),
        progress_percent: snapshot.percent.filter(|percent| *percent >= 0.0 && *percent <= 100.0),
        downloaded: Some(snapshot.downloaded),
        total: snapshot.total,
        download_state: Some(download_state),
    });
}

fn emit_download_error(
    status_emitter: Option<&KernelStatusEmitter>,
    env_uuid: &Option<String>,
    kernel_value: &str,
    message: &str,
) {
    emit_status(
        status_emitter,
        env_uuid,
        kernel_value,
        EnvironmentStatus::Error,
        Some(message),
        None,
        None,
        None,
    );
}

/// 下载文件：连接和读取都有超时，失败自动重试，断点续传，支持用户暂停/恢复/取消
async fn download_file(
    app: &tauri::AppHandle,
    env_uuid: &Option<String>,
    kernel_value: &str,
    url: &str,
    zip_path: &Path,
    max_attempts: u32,
    status_emitter: Option<KernelStatusEmitter>,
    control: Arc<KernelDownloadControl>,
) -> Result<()> {
    let display_url = redact_download_url(url);
    crate::log_info!(
        crate::core::logger::modules::KERNEL,
        "开始下载内核: {}",
        display_url
    );

    let progress_snapshot = Arc::new(Mutex::new(DownloadProgressSnapshot::default()));
    let last_emitted_pct = Arc::new(Mutex::new(-1.0f64));

    loop {
        let settings =
            super::download_settings::load_kernel_download_settings(app).map_err(|reason| {
                let message = format!("内核下载代理配置无效：{reason}");
                emit_download_error(status_emitter.as_ref(), env_uuid, kernel_value, &message);
                message
            })?;
        let client = super::download_settings::client_builder_for_settings(&settings)
            .map_err(|reason| {
                let message = format!("内核下载代理配置无效：{reason}");
                emit_download_error(status_emitter.as_ref(), env_uuid, kernel_value, &message);
                message
            })?
            .connect_timeout(CONNECT_TIMEOUT)
            .build()?;

        let progress_emitter = status_emitter.clone();
        let retry_emitter = status_emitter.clone();
        let progress_state = Arc::clone(&progress_snapshot);
        let last_pct = Arc::clone(&last_emitted_pct);
        let result = download_with_retries(
            &client,
            url,
            zip_path,
            max_attempts,
            RETRY_BASE_DELAY,
            control.clone(),
            |downloaded, total| {
                let percent = total
                    .filter(|total| *total > 0)
                    .map(|total| (downloaded as f64 / total as f64) * 100.0);
                if let Ok(mut snapshot) = progress_state.lock() {
                    snapshot.downloaded = downloaded;
                    snapshot.total = total;
                    if percent.is_some() {
                        snapshot.percent = percent;
                    }
                }

                let Some(total) = total.filter(|total| *total > 0) else {
                    return;
                };
                let pct = (downloaded as f64 / total as f64) * 100.0;
                let should_emit = if let Ok(mut last) = last_pct.lock() {
                    let should_emit = (pct - *last) >= 1.0 || downloaded >= total;
                    if should_emit {
                        *last = pct;
                    }
                    should_emit
                } else {
                    true
                };
                if should_emit {
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

        match result {
            Ok(()) => return Ok(()),
            Err(DownloadFailure::Failed(reason)) => {
                crate::log_error!(
                    crate::core::logger::modules::KERNEL,
                    "内核下载失败: {} - {}",
                    display_url,
                    reason
                );
                let message = format!("下载失败：{reason}");
                emit_download_error(status_emitter.as_ref(), env_uuid, kernel_value, &message);
                return Err(format!("内核下载失败：{reason}").into());
            }
            Err(DownloadFailure::Paused) => {
                control.mark_paused();
                let snapshot =
                    progress_snapshot.lock().map(|snapshot| *snapshot).unwrap_or_default();
                emit_download_state(
                    status_emitter.as_ref(),
                    env_uuid,
                    kernel_value,
                    KernelDownloadEventState::Paused,
                    snapshot,
                );

                match control.wait_for_resume_or_cancel().await {
                    super::download_control::KernelDownloadControlState::Running => {
                        emit_status(
                            status_emitter.as_ref(),
                            env_uuid,
                            kernel_value,
                            EnvironmentStatus::Downloading,
                            Some("继续下载…"),
                            snapshot.percent,
                            Some(snapshot.downloaded),
                            snapshot.total,
                        );
                        // 恢复时重新读取代理配置并重建 client；partial 文件会让下一次请求带 Range。
                        continue;
                    }
                    super::download_control::KernelDownloadControlState::Cancelled => {
                        emit_download_state(
                            status_emitter.as_ref(),
                            env_uuid,
                            kernel_value,
                            KernelDownloadEventState::Cancelled,
                            snapshot,
                        );
                        return Err("内核下载已取消".into());
                    }
                    super::download_control::KernelDownloadControlState::PauseRequested
                    | super::download_control::KernelDownloadControlState::Paused => {
                        return Err("内核下载暂停状态异常".into());
                    }
                }
            }
            Err(DownloadFailure::Cancelled) => {
                let snapshot =
                    progress_snapshot.lock().map(|snapshot| *snapshot).unwrap_or_default();
                emit_download_state(
                    status_emitter.as_ref(),
                    env_uuid,
                    kernel_value,
                    KernelDownloadEventState::Cancelled,
                    snapshot,
                );
                return Err("内核下载已取消".into());
            }
        }
    }
}

enum AttemptFailure {
    /// 网络抖动、服务器临时错误，可以再试
    Retryable(String),
    /// 地址失效、磁盘写不进去，再试也没用
    Fatal(String),
    /// 用户请求暂停；当前响应会断开，下次用 Range 接着下
    Paused,
    /// 用户取消整个下载任务
    Cancelled,
}

#[derive(Debug, PartialEq, Eq)]
enum DownloadFailure {
    Failed(String),
    Paused,
    Cancelled,
}

fn attempt_interruption(
    state: super::download_control::KernelDownloadControlState,
) -> Option<AttemptFailure> {
    use super::download_control::KernelDownloadControlState as State;
    match state {
        State::Running => None,
        State::PauseRequested | State::Paused => Some(AttemptFailure::Paused),
        State::Cancelled => Some(AttemptFailure::Cancelled),
    }
}

fn download_interruption(
    state: super::download_control::KernelDownloadControlState,
) -> DownloadFailure {
    use super::download_control::KernelDownloadControlState as State;
    match state {
        State::Cancelled => DownloadFailure::Cancelled,
        State::PauseRequested | State::Paused | State::Running => DownloadFailure::Paused,
    }
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
    control: Arc<KernelDownloadControl>,
    mut on_progress: P,
    mut on_retry: R,
) -> std::result::Result<(), DownloadFailure>
where
    P: FnMut(u64, Option<u64>) + Send,
    R: FnMut(u32, &str) + Send,
{
    let mut failures = 0u32;
    let mut best_size = local_size(path);
    loop {
        let control_state = control.current();
        if !matches!(
            control_state,
            super::download_control::KernelDownloadControlState::Running
        ) {
            return Err(download_interruption(control_state));
        }

        let reason = match fetch_once(client, url, path, control.clone(), &mut on_progress).await {
            Ok(()) => return Ok(()),
            Err(AttemptFailure::Fatal(reason)) => return Err(DownloadFailure::Failed(reason)),
            Err(AttemptFailure::Paused) => return Err(DownloadFailure::Paused),
            Err(AttemptFailure::Cancelled) => return Err(DownloadFailure::Cancelled),
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
            return Err(DownloadFailure::Failed(format!(
                "{reason}（已连续失败 {failures} 次）"
            )));
        }
        on_retry(failures, &reason);
        let delay = base_delay.saturating_mul(1u32 << (failures - 1).min(8)).min(MAX_RETRY_DELAY);

        let interrupted = tokio::select! {
            _ = tokio::time::sleep(delay) => None,
            state = control.wait_for_pause_or_cancel() => Some(state),
        };
        if let Some(state) = interrupted {
            return Err(download_interruption(state));
        }
    }
}

/// 发一次请求，把内容接到本地文件后面
async fn fetch_once<P>(
    client: &reqwest::Client,
    url: &str,
    path: &Path,
    control: Arc<KernelDownloadControl>,
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
    // 连接建立期间也监听控制状态；否则慢速或不可达代理会把暂停/取消卡住几十秒。
    let response = tokio::select! {
        state = control.wait_for_pause_or_cancel() => {
            return Err(attempt_interruption(state).unwrap_or(AttemptFailure::Paused));
        }
        response = timeout(RESPONSE_TIMEOUT, request.send()) => {
            match response {
                Err(_) => return Err(AttemptFailure::Retryable("服务器长时间没有响应".to_string())),
                // without_url：错误信息会显示给用户，不带上下载地址
                Ok(Err(error)) => {
                    return Err(AttemptFailure::Retryable(format!(
                        "连接失败: {}",
                        error.without_url()
                    )))
                }
                Ok(Ok(response)) => response,
            }
        }
    };
    let status = response.status();

    if status == StatusCode::RANGE_NOT_SATISFIABLE {
        // 上次其实已经下完了（是否完好由后面的哈希校验把关）；否则丢掉本地文件重下
        if existing > 0
            && content_range_of(&response).and_then(|(_, total)| total) == Some(existing)
        {
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
    let mut control_receiver = control.subscribe();
    loop {
        let interruption = {
            let state = *control_receiver.borrow();
            attempt_interruption(state)
        };
        if let Some(interruption) = interruption {
            return Err(interruption);
        }

        let chunk = tokio::select! {
            changed = control_receiver.changed() => {
                if changed.is_err() {
                    return Err(AttemptFailure::Cancelled);
                }
                continue;
            }
            chunk = timeout(STALL_TIMEOUT, stream.next()) => {
                match chunk {
                    Err(_) => return Err(AttemptFailure::Retryable("下载长时间没有进展".to_string())),
                    Ok(None) => break,
                    Ok(Some(Err(error))) => {
                        return Err(AttemptFailure::Retryable(format!(
                            "连接中断: {}",
                            error.without_url()
                        )))
                    }
                    Ok(Some(Ok(chunk))) => chunk,
                }
            }
        };
        file.write_all(&chunk)
            .map_err(|error| AttemptFailure::Fatal(format!("保存文件失败: {error}")))?;
        downloaded += chunk.len() as u64;
        on_progress(downloaded, total);
        if total.is_some_and(|total| downloaded >= total) {
            break;
        }
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
    use super::{DownloadFailure, download_with_retries, parse_content_range, redact_download_url};
    use crate::services::environment::kernel::download_control::KernelDownloadControl;
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

    async fn run(
        url: &str,
        path: &std::path::Path,
        attempts: u32,
    ) -> std::result::Result<(), DownloadFailure> {
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        download_with_retries(
            &client,
            url,
            path,
            attempts,
            Duration::ZERO,
            std::sync::Arc::new(KernelDownloadControl::new()),
            |_, _| {},
            |_, _| {},
        )
        .await
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
            b"HTTP/1.1 504 Gateway Timeout\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                .to_vec(),
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
        assert_eq!(
            run(&url, &path, 3).await.unwrap_err(),
            DownloadFailure::Failed("HTTP 404".to_string())
        );
        assert_eq!(seen.lock().unwrap().len(), 1);

        let unavailable =
            b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                .to_vec();
        let (url, seen) = serve(vec![unavailable.clone(), unavailable]).await;
        let error = run(&url, &path, 2).await.unwrap_err();
        let DownloadFailure::Failed(error) = error else {
            panic!("expected a failed download, got {error:?}");
        };
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

    #[tokio::test]
    async fn a_pause_request_interrupts_the_download_without_discarding_partial_bytes() {
        let (url, _) = serve(vec![
            b"HTTP/1.1 200 OK\r\nContent-Length: 10\r\nConnection: close\r\n\r\n0123".to_vec(),
        ])
        .await;
        let path = temp_file();
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        let control = std::sync::Arc::new(KernelDownloadControl::new());
        let pausing_control = control.clone();
        let pause_on_retry = move |_: u32, _: &str| pausing_control.pause();

        let result = tokio::time::timeout(
            Duration::from_millis(500),
            download_with_retries(
                &client,
                &url,
                &path,
                3,
                Duration::from_secs(60),
                control,
                |_, _| {},
                pause_on_retry,
            ),
        )
        .await
        .expect("pause should interrupt the retry backoff promptly");

        assert_eq!(result, Err(DownloadFailure::Paused));
        assert_eq!(std::fs::read(&path).unwrap(), b"0123");
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn a_cancelled_download_stops_before_making_another_request() {
        let (url, seen) = serve(Vec::new()).await;
        let path = temp_file();
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        let control = std::sync::Arc::new(KernelDownloadControl::new());
        control.cancel();

        let result = download_with_retries(
            &client,
            &url,
            &path,
            3,
            Duration::ZERO,
            control,
            |_, _| {},
            |_, _| {},
        )
        .await;

        assert_eq!(result, Err(DownloadFailure::Cancelled));
        assert!(seen.lock().unwrap().is_empty());
        assert!(!path.exists());
    }

    #[test]
    fn content_range_forms() {
        assert_eq!(
            parse_content_range("bytes 4-9/10"),
            Some((Some(4), Some(10)))
        );
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
