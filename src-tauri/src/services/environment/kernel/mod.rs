//! 浏览器内核准备与启动服务
//!
//! 负责：检查/下载/解压内核、校验核心库（Chromium 的 chrome.dll、Firefox 的 xul.dll）哈希、启动环境进程

use crate::core::error::Result;
use crate::domain::environment::{EnvironmentStatus, KernelDetail};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use uuid::Uuid;

pub mod downloader;
pub mod extension;
mod gecko_profile;
pub mod language;
pub(crate) mod network_fingerprint;
mod runtime_bridge;
mod state;
pub mod timezone;
pub mod types;
pub mod utils;
pub mod verifier;

// 重新导出常用类型
pub use types::{
    AccountInfo, BatchLaunchRequest, BatchLaunchResult, CdpEndpointResponse, CookieGroup,
    ExtensionInfo, KernelPrepareStatusPayload, KernelStatusEmitter, ProxyConfig, RpaTabCloseResult,
    RpaTabInfo, RpaTabSelection, RpaTabsSnapshot,
};

/// 内核服务
pub struct KernelService;

async fn record_ready_installation(
    app: &tauri::AppHandle,
    kernel_id: &str,
    exe_path: &std::path::Path,
    verified_signature: &str,
) {
    let context = app.state::<business::svc_ctx::SvcCtx>();
    if let Err(error) = business::services::browser_kernels::record_kernel_installation(
        &context.db,
        kernel_id,
        &exe_path.to_string_lossy(),
        verified_signature,
    )
    .await
    {
        log::warn!("Failed to record browser kernel installation: {error}");
    }
}

impl KernelService {
    /// 确保内核已就绪：目录不存在则下载并解压，存在则校验核心库哈希
    pub async fn ensure_kernel_ready(
        app: tauri::AppHandle,
        env_uuid: Option<String>,
        kernel_value: String,
        profiles_path: String,
        kernel_detail: KernelDetail,
        status_emitter: Option<KernelStatusEmitter>,
    ) -> Result<String> {
        Self::ensure_kernel_ready_for_artifact(
            app,
            env_uuid,
            kernel_value.clone(),
            kernel_value,
            profiles_path,
            kernel_detail,
            status_emitter,
        )
        .await
    }

    /// 手动更新内核（设置 → 浏览器内核）：下载清单里的当前版本，替换安装目录。
    /// 有环境正在用这个内核时拒绝，不会关掉用户的环境
    pub async fn update_kernel(
        app: tauri::AppHandle,
        kernel_id: String,
        profiles_path: String,
        status_emitter: Option<KernelStatusEmitter>,
    ) -> Result<()> {
        let kernel_id = kernel_id.trim().to_string();
        let context = app.state::<business::svc_ctx::SvcCtx>();
        let kernel = business::services::browser_kernels::get_browser_kernel(&context.db, &kernel_id)
            .await?
            .ok_or("内核不存在或已下线")?;
        let engine = crate::domain::environment::KernelEngine::from_type_code(&kernel.type_code);
        let url = kernel
            .url
            .clone()
            .filter(|value| !value.trim().is_empty())
            .ok_or("这个内核缺少下载地址")?;
        let detail = KernelDetail {
            engine,
            url,
            hash: kernel.hash.clone(),
            signature: Some(kernel.signature.clone()),
            compatible_signatures: kernel.compatible_signatures.0.clone(),
            requires_extract: kernel.requires_extract,
        };

        let _prepare_guard = state::acquire_kernel_prepare_lock(&kernel_id).await;
        let base = utils::resolve_profiles_base(&app, &profiles_path)?;
        let kernel_dir = utils::resolve_kernel_install_dir(&base, &kernel.install_dir_name)?;
        if utils::kernel_dir_in_use(&kernel_dir) {
            return Err("有环境正在使用这个内核，请先关闭这些环境再更新".into());
        }
        let exe_path = download_and_replace_kernel(
            &app,
            &None,
            &kernel.install_dir_name,
            &base,
            &kernel_dir,
            &detail,
            downloader::REQUIRED_DOWNLOAD_ATTEMPTS,
            status_emitter,
        )
        .await?;
        record_ready_installation(&app, &kernel_id, &exe_path, &kernel.signature).await;
        Ok(())
    }

    /// Prepare a registry artifact while keeping its immutable identity
    /// separate from the backwards-compatible on-disk directory name.
    pub async fn ensure_kernel_ready_for_artifact(
        app: tauri::AppHandle,
        env_uuid: Option<String>,
        kernel_id: String,
        install_dir_name: String,
        profiles_path: String,
        kernel_detail: KernelDetail,
        status_emitter: Option<KernelStatusEmitter>,
    ) -> Result<String> {
        let kernel_id = kernel_id.trim().to_string();
        if kernel_id.is_empty() {
            return Err("内核标识不能为空".into());
        }
        let install_dir_name = install_dir_name.trim().to_string();
        if install_dir_name.is_empty() {
            return Err("内核版本不能为空".into());
        }

        let _prepare_guard = state::acquire_kernel_prepare_lock(&kernel_id).await;
        let base = utils::resolve_profiles_base(&app, &profiles_path)?;
        let kernel_dir = utils::resolve_kernel_install_dir(&base, &install_dir_name)?;
        let exe_path = kernel_dir.join(utils::exe_name(kernel_detail.engine));

        // 目录已存在：校验内核
        if kernel_dir.exists() {
            if !kernel_dir.is_dir() {
                return Err(format!("内核安装路径不是目录: {}", kernel_dir.display()).into());
            }
            // 检查内核包是否包含启动所需的完整运行时文件。
            if let Err(error) = utils::validate_kernel_package_layout(&kernel_dir, kernel_detail.engine) {
                crate::log_warn!(
                    crate::core::logger::modules::KERNEL,
                    "内核目录不完整，将下载当前包替换: {} - {}",
                    kernel_dir.display(),
                    error
                );
                let exe_path = download_and_replace_kernel(
                    &app,
                    &env_uuid,
                    &install_dir_name,
                    &base,
                    &kernel_dir,
                    &kernel_detail,
                    downloader::REQUIRED_DOWNLOAD_ATTEMPTS,
                    status_emitter,
                )
                .await?;
                record_ready_installation(
                    &app,
                    &kernel_id,
                    &exe_path,
                    kernel_detail.signature.as_deref().unwrap_or_default(),
                )
                .await;
                return Ok(exe_path.to_string_lossy().to_string());
            } else {
                // 已经装好的内核直接用：启动环境时不算哈希、不强制更新。环境要的是稳定，清单里有新版本时
                // 只在 设置 → 浏览器内核 里提醒，由用户自己点更新（update_kernel）。
                // 只有第一次见到这个目录（旧版本软件装的、手动拷进来的，没有安装记录）时算一次哈希，
                // 记下装的是哪个版本，用来判断有没有更新
                let context = app.state::<business::svc_ctx::SvcCtx>();
                let recorded = business::services::browser_kernels::installed_signature_for_dir(
                    &context.db,
                    &install_dir_name,
                )
                .await
                .unwrap_or_else(|error| {
                    log::warn!("could not read the installation record of {install_dir_name}: {error}");
                    None
                });
                if recorded.is_none() {
                    let engine = kernel_detail.engine;
                    let dir = kernel_dir.clone();
                    let signature = tokio::task::spawn_blocking(move || {
                        let dll = verifier::find_core_dll_dir(&dir, engine)?.join(utils::core_dll_name(engine));
                        utils::core_dll_signature(&dll)
                    })
                    .await
                    .map_err(|error| format!("内核签名计算任务异常: {error}"))?;
                    match signature {
                        Ok(signature) => record_ready_installation(&app, &kernel_id, &exe_path, &signature).await,
                        Err(error) => crate::log_warn!(
                            crate::core::logger::modules::KERNEL,
                            "无法计算已安装内核的签名（不影响启动）: {} - {}",
                            kernel_dir.display(),
                            error
                        ),
                    }
                }
                utils::emit_status(
                    status_emitter.as_ref(),
                    &env_uuid,
                    &install_dir_name,
                    EnvironmentStatus::Ready,
                    Some("就绪"),
                    None,
                    None,
                    None,
                );
                return Ok(exe_path.to_string_lossy().to_string());
            }
        }

        // 目录不存在时也先下载到 staging，校验完整后再安装到正式目录。
        let exe_path = download_and_replace_kernel(
            &app,
            &env_uuid,
            &install_dir_name,
            &base,
            &kernel_dir,
            &kernel_detail,
            downloader::REQUIRED_DOWNLOAD_ATTEMPTS,
            status_emitter,
        )
        .await?;

        let verified_signature = kernel_detail.signature.as_deref().unwrap_or_default();
        record_ready_installation(&app, &kernel_id, &exe_path, verified_signature).await;

        Ok(exe_path.to_string_lossy().to_string())
    }

    /// 启动环境：在可执行文件所在目录下启动进程
    pub async fn launch_environment(
        app: tauri::AppHandle,
        exe_path: String,
        engine: crate::domain::environment::KernelEngine,
        env_uuid: String,
        cache_path: String,
        cookies: Option<Vec<types::CookieGroup>>,
        urls: Option<Vec<String>>,
        proxy: Option<ProxyConfig>,
        fingerprint_config: Option<crate::infrastructure::runtime::FingerprintConfig>,
        accounts: Option<Vec<types::AccountInfo>>,
        extensions: Option<Vec<types::ExtensionInfo>>,
        exit_probe: Option<network_fingerprint::ExitProbe>,
        status_emitter: Option<KernelStatusEmitter>,
    ) -> Result<()> {
        runtime_bridge::launch_environment(
            app,
            exe_path,
            engine,
            env_uuid,
            cache_path,
            cookies,
            urls,
            proxy,
            fingerprint_config,
            accounts,
            extensions,
            exit_probe,
            status_emitter,
        )
        .await
    }

    /// 获取当前已连接的环境 ID 列表
    pub async fn get_connected_environments() -> Result<Vec<String>> {
        runtime_bridge::get_connected_environments().await
    }

    pub async fn get_cdp_endpoint(env_uuid: String) -> Result<Option<CdpEndpointResponse>> {
        runtime_bridge::get_cdp_endpoint(env_uuid).await
    }

    pub async fn list_rpa_tabs(env_uuid: String) -> Result<RpaTabsSnapshot> {
        runtime_bridge::list_rpa_tabs(env_uuid).await
    }

    pub async fn select_rpa_tab(env_uuid: String, position: u32) -> Result<RpaTabSelection> {
        runtime_bridge::select_rpa_tab(env_uuid, position).await
    }

    pub async fn close_rpa_tab(env_uuid: String, position: u32) -> Result<RpaTabCloseResult> {
        runtime_bridge::close_rpa_tab(env_uuid, position).await
    }

    /// 停止环境
    pub async fn stop_environment(env_uuid: String) -> Result<()> {
        runtime_bridge::stop_environment(env_uuid).await
    }

    pub async fn refresh_proxy(env_uuid: String, proxy: Option<ProxyConfig>) -> Result<()> {
        runtime_bridge::refresh_proxy(env_uuid, proxy).await
    }

    /// 批量启动环境：并发启动所有环境
    pub async fn batch_launch_environments(
        app: tauri::AppHandle,
        launch_requests: Vec<BatchLaunchRequest>,
        status_emitter: Option<KernelStatusEmitter>,
    ) -> Result<Vec<BatchLaunchResult>> {
        runtime_bridge::batch_launch_environments(app, launch_requests, status_emitter).await
    }

    /// 批量停止环境：并发停止所有环境
    pub async fn batch_stop_environments(env_uuids: Vec<String>) -> Result<Vec<BatchLaunchResult>> {
        runtime_bridge::batch_stop_environments(env_uuids).await
    }

    pub async fn get_environment_status(
        env_uuid: String,
    ) -> Result<Option<crate::domain::environment::EnvironmentStatus>> {
        runtime_bridge::get_environment_status(env_uuid).await
    }

    pub async fn get_all_environment_statuses()
    -> Result<std::collections::HashMap<String, crate::domain::environment::EnvironmentStatus>>
    {
        runtime_bridge::get_all_environment_statuses().await
    }

    pub async fn set_window_bounds(
        env_uuid: String,
        x: i32,
        y: i32,
        width: i32,
        height: i32,
    ) -> Result<()> {
        runtime_bridge::set_window_bounds(env_uuid, x, y, width, height).await
    }
}

async fn download_and_replace_kernel(
    app: &tauri::AppHandle,
    env_uuid: &Option<String>,
    install_dir_name: &str,
    base: &Path,
    kernel_dir: &Path,
    kernel_detail: &KernelDetail,
    download_attempts: u32,
    status_emitter: Option<KernelStatusEmitter>,
) -> Result<PathBuf> {
    let staging_name = format!(".{install_dir_name}.staging-{}", Uuid::new_v4());
    let staging_dir = utils::resolve_kernel_install_dir(base, &staging_name)?;
    downloader::download_and_install_kernel(
        app,
        env_uuid,
        install_dir_name,
        &staging_dir,
        kernel_detail,
        download_attempts,
        status_emitter,
    )
    .await
    .map_err(|error| kernel_prepare_error(error, &staging_dir, kernel_dir))?;

    let backup_dir = if kernel_dir.exists() {
        let path = base.join(format!(".{install_dir_name}.backup-{}", Uuid::new_v4()));
        if let Err(error) = fs::rename(kernel_dir, &path) {
            let _ = fs::remove_dir_all(&staging_dir);
            return Err(format!("替换旧内核前无法保留原目录: {error}").into());
        }
        Some(path)
    } else {
        None
    };

    if let Err(error) = fs::rename(&staging_dir, kernel_dir) {
        if let Some(backup_dir) = &backup_dir {
            let _ = fs::rename(backup_dir, kernel_dir);
        }
        let _ = fs::remove_dir_all(&staging_dir);
        return Err(format!("安装新内核失败，已恢复原目录: {error}").into());
    }

    if let Some(backup_dir) = backup_dir {
        if let Err(error) = fs::remove_dir_all(&backup_dir) {
            crate::log_warn!(
                crate::core::logger::modules::KERNEL,
                "新内核已安装，但清理旧目录失败: {} - {}",
                backup_dir.display(),
                error
            );
        }
    }

    Ok(kernel_dir.join(utils::exe_name(kernel_detail.engine)))
}

fn kernel_prepare_error(
    error: impl std::fmt::Display,
    staging_dir: &Path,
    kernel_dir: &Path,
) -> crate::core::error::Error {
    let _ = fs::remove_dir_all(staging_dir);
    let staging_path = staging_dir.to_string_lossy();
    let install_path = kernel_dir.to_string_lossy();
    let mut detail = error.to_string().replace(staging_path.as_ref(), install_path.as_ref());
    const ERROR_PREFIX: &str = "[080601] Kernel preparation failed: ";
    const DETAIL_PREFIX: &str = "内核包准备失败：";
    loop {
        if let Some(stripped) = detail.strip_prefix(ERROR_PREFIX) {
            detail = stripped.to_string();
        } else if let Some(stripped) = detail.strip_prefix(DETAIL_PREFIX) {
            detail = stripped.to_string();
        } else {
            break;
        }
    }
    crate::core::error::Error::KernelPrepareFailed(detail)
}

#[cfg(test)]
mod tests {
    use super::kernel_prepare_error;

    #[test]
    fn staging_failure_reports_install_path_and_removes_temporary_directory() {
        let base = std::env::temp_dir().join(format!(
            "mz-kernel-staging-error-{}",
            uuid::Uuid::new_v4()
        ));
        let staging_dir = base.join(".Chrome 144.staging-test");
        let kernel_dir = base.join("Chrome 144");
        std::fs::create_dir_all(&staging_dir).unwrap();

        let error = kernel_prepare_error(
            format!(
                "内核包不完整：缺少 {}",
                staging_dir.join("chrome_crashpad_handler.exe").display()
            ),
            &staging_dir,
            &kernel_dir,
        )
        .to_string();

        assert!(!staging_dir.exists());
        assert!(error.contains(&kernel_dir.to_string_lossy().to_string()));
        assert!(!error.contains(".Chrome 144.staging-test"));
        assert_eq!(
            error.matches("[080601] Kernel preparation failed:").count(),
            1
        );
        let _ = std::fs::remove_dir_all(base);
    }

    #[test]
    fn staging_failure_does_not_duplicate_kernel_prepare_prefix() {
        let base = std::env::temp_dir().join(format!(
            "mz-kernel-prefix-error-{}",
            uuid::Uuid::new_v4()
        ));
        let staging_dir = base.join(".Chrome 144.staging-test");
        let kernel_dir = base.join("Chrome 144");
        std::fs::create_dir_all(&staging_dir).unwrap();

        let error = kernel_prepare_error(
            crate::core::error::Error::KernelPrepareFailed(
                "内核包不完整：缺少 mz.exe".to_string(),
            ),
            &staging_dir,
            &kernel_dir,
        )
        .to_string();

        assert_eq!(
            error.matches("[080601] Kernel preparation failed:").count(),
            1
        );
        assert!(!error.contains("内核包准备失败："));
        let _ = std::fs::remove_dir_all(base);
    }
}
