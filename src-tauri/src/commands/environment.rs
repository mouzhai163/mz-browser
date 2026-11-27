/// 环境和内核管理命令
///
/// 命令层仅负责参数解析和响应，业务逻辑由服务层处理
use crate::core::error::Result;
use crate::domain::environment::{EnvironmentStatus, KernelDetail};
use crate::infrastructure::runtime::FingerprintConfig;
use crate::services::connectivity::ProxyExportItem;
use crate::services::connectivity::ProxyExportService;
use crate::services::environment::{
    AccountInfo, BatchLaunchRequest, BatchLaunchResult, CdpEndpointResponse, CookieGroup,
    EnvironmentLaunchRuntimeService, EnvironmentService, KernelService, ProxyConfig,
    RpaTabCloseResult, RpaTabSelection, RpaTabsSnapshot, RunningEnvironment, StartSyncParams,
};
use tauri::AppHandle;

// ============================================================================
// 内核管理命令
// ============================================================================

#[tauri::command]
pub async fn ensure_kernel_ready(
    app: AppHandle,
    env_uuid: Option<String>,
    kernel_value: String,
    install_dir_name: Option<String>,
    profiles_path: String,
    kernel_detail: KernelDetail,
) -> Result<String> {
    let install_dir_name = install_dir_name.unwrap_or_else(|| kernel_value.clone());
    KernelService::ensure_kernel_ready_for_artifact(
        app.clone(),
        env_uuid,
        kernel_value,
        install_dir_name,
        profiles_path,
        kernel_detail,
        Some(crate::services::environment::kernel::utils::build_tauri_status_emitter(app)),
    )
    .await
}

#[tauri::command]
pub async fn launch_environment(
    app: AppHandle,
    exe_path: String,
    env_uuid: String,
    cache_path: String,
    cookies: Option<Vec<CookieGroup>>,
    urls: Option<Vec<String>>,
    proxy: Option<ProxyConfig>,
    fingerprint_config: Option<FingerprintConfig>,
    accounts: Option<Vec<AccountInfo>>,
    extensions: Option<Vec<crate::services::environment::ExtensionInfo>>,
    engine: Option<crate::domain::environment::KernelEngine>,
) -> Result<()> {
    KernelService::launch_environment(
        app.clone(),
        exe_path,
        engine.unwrap_or_default(),
        env_uuid,
        cache_path,
        cookies,
        urls,
        proxy,
        fingerprint_config,
        accounts,
        extensions,
        None,
        Some(crate::services::environment::kernel::utils::build_tauri_status_emitter(app)),
    )
    .await
}

/// 手动更新内核（设置 → 浏览器内核里的“更新”按钮）。启动环境时不再自动更新内核
#[tauri::command]
pub async fn update_browser_kernel(app: AppHandle, kernel_id: String) -> Result<()> {
    let paths = EnvironmentLaunchRuntimeService::resolve_launch_paths(&app)?;
    KernelService::update_kernel(
        app.clone(),
        kernel_id,
        paths.profiles_path,
        Some(crate::services::environment::kernel::utils::build_tauri_status_emitter(app)),
    )
    .await
}

/// 手动下载内核（设置 → 浏览器内核里的“下载”按钮）。与更新共用同一套安装流程。
#[tauri::command]
pub async fn download_browser_kernel(app: AppHandle, kernel_id: String) -> Result<()> {
    update_browser_kernel(app, kernel_id).await
}

/// 查询内核卸载确认信息：完整安装路径和当前安装版/便携版/自定义目录形态。
#[tauri::command]
pub async fn get_browser_kernel_install_info(
    app: AppHandle,
    kernel_id: String,
) -> Result<crate::services::environment::kernel::BrowserKernelInstallInfo> {
    let paths = EnvironmentLaunchRuntimeService::resolve_launch_paths(&app)?;
    KernelService::get_kernel_install_info(app, kernel_id, paths.profiles_path).await
}

/// 卸载/删除已安装内核。保留环境绑定；对应环境下次启动时会重新下载。
#[tauri::command]
pub async fn uninstall_browser_kernel(app: AppHandle, kernel_id: String) -> Result<()> {
    let paths = EnvironmentLaunchRuntimeService::resolve_launch_paths(&app)?;
    KernelService::uninstall_kernel(app, kernel_id, paths.profiles_path).await
}

#[tauri::command]
pub async fn pause_kernel_download(kernel_value: String) -> Result<()> {
    crate::services::environment::kernel::download_control::pause_kernel_download(&kernel_value)
        .await
        .map_err(crate::core::error::Error::from)
}

#[tauri::command]
pub async fn resume_kernel_download(kernel_value: String) -> Result<()> {
    crate::services::environment::kernel::download_control::resume_kernel_download(&kernel_value)
        .await
        .map_err(crate::core::error::Error::from)
}

#[tauri::command]
pub async fn cancel_kernel_download(kernel_value: String) -> Result<()> {
    crate::services::environment::kernel::download_control::cancel_kernel_download(&kernel_value)
        .await
        .map_err(crate::core::error::Error::from)
}

#[tauri::command]
pub fn get_kernel_download_settings(
    app: AppHandle,
) -> Result<crate::services::environment::kernel::download_settings::KernelDownloadSettingsView> {
    crate::services::environment::kernel::download_settings::get_kernel_download_settings_view(&app)
        .map_err(crate::core::error::Error::from)
}

#[tauri::command]
pub async fn update_kernel_download_settings(
    app: AppHandle,
    settings: crate::services::environment::kernel::download_settings::KernelDownloadSettingsInput,
) -> Result<crate::services::environment::kernel::download_settings::KernelDownloadSettingsView> {
    let before = crate::services::environment::kernel::download_settings::load_kernel_download_settings(
        &app,
    )
    .map_err(crate::core::error::Error::from)?;
    let view = crate::services::environment::kernel::download_settings::update_kernel_download_settings(
        &app, settings,
    )
    .map_err(crate::core::error::Error::from)?;
    let after = crate::services::environment::kernel::download_settings::load_kernel_download_settings(
        &app,
    )
    .map_err(crate::core::error::Error::from)?;

    // 配置真正变化时，让正在进行的下载尽快断开当前连接；外层循环会保留分片，
    // 重新读取配置、重建 client，并用 Range 从未完成位置继续。
    if before != after {
        let restarted = crate::services::environment::kernel::download_control::restart_all_kernel_downloads().await;
        if restarted > 0 {
            crate::log_info!(
                crate::core::logger::modules::KERNEL,
                "内核下载代理配置已更新，已通知 {} 个下载任务重新连接",
                restarted
            );
        }
    }
    Ok(view)
}

#[tauri::command]
pub async fn get_connected_environments() -> Result<Vec<String>> {
    KernelService::get_connected_environments().await
}

#[tauri::command]
pub async fn get_environment_cdp_endpoint(env_uuid: String) -> Result<Option<CdpEndpointResponse>> {
    KernelService::get_cdp_endpoint(env_uuid).await
}

#[tauri::command]
pub async fn list_environment_rpa_tabs(env_uuid: String) -> Result<RpaTabsSnapshot> {
    KernelService::list_rpa_tabs(env_uuid).await
}

#[tauri::command]
pub async fn select_environment_rpa_tab(
    env_uuid: String,
    position: u32,
) -> Result<RpaTabSelection> {
    KernelService::select_rpa_tab(env_uuid, position).await
}

#[tauri::command]
pub async fn close_environment_rpa_tab(
    env_uuid: String,
    position: u32,
) -> Result<RpaTabCloseResult> {
    KernelService::close_rpa_tab(env_uuid, position).await
}

#[tauri::command]
pub async fn stop_environment(env_uuid: String) -> Result<()> {
    KernelService::stop_environment(env_uuid).await
}

#[tauri::command]
pub async fn refresh_environment_proxy(env_uuid: String, proxy: Option<ProxyConfig>) -> Result<()> {
    KernelService::refresh_proxy(env_uuid, proxy).await
}

#[tauri::command]
pub async fn batch_launch_environments(
    app: AppHandle,
    launch_requests: Vec<BatchLaunchRequest>,
) -> Result<Vec<BatchLaunchResult>> {
    KernelService::batch_launch_environments(
        app.clone(),
        launch_requests,
        Some(crate::services::environment::kernel::utils::build_tauri_status_emitter(app)),
    )
    .await
}

#[tauri::command]
pub async fn start_environment_by_uuid(
    app: AppHandle,
    env_uuid: String,
    display_id: Option<String>,
) -> Result<()> {
    let launch_paths = EnvironmentLaunchRuntimeService::resolve_launch_paths(&app)?;
    let status_emitter =
        Some(crate::services::environment::kernel::utils::build_tauri_status_emitter(app));
    EnvironmentLaunchRuntimeService::start_environment_by_uuid(
        env_uuid,
        launch_paths,
        status_emitter,
        display_id,
    )
    .await
}

#[tauri::command]
pub async fn batch_start_environments_by_uuid(
    app: AppHandle,
    env_uuids: Vec<String>,
    display_ids_by_env_uuid: Option<std::collections::HashMap<String, String>>,
) -> Result<Vec<BatchLaunchResult>> {
    let launch_paths = EnvironmentLaunchRuntimeService::resolve_launch_paths(&app)?;
    let status_emitter =
        Some(crate::services::environment::kernel::utils::build_tauri_status_emitter(app));
    EnvironmentLaunchRuntimeService::batch_start_environments_by_uuid(
        env_uuids,
        launch_paths,
        status_emitter,
        display_ids_by_env_uuid,
    )
    .await
}

#[tauri::command]
pub async fn batch_stop_environments(env_uuids: Vec<String>) -> Result<Vec<BatchLaunchResult>> {
    KernelService::batch_stop_environments(env_uuids).await
}

#[tauri::command]
pub async fn get_environment_status(env_uuid: String) -> Result<Option<EnvironmentStatus>> {
    KernelService::get_environment_status(env_uuid).await
}

#[tauri::command]
pub async fn get_all_environment_statuses()
-> Result<std::collections::HashMap<String, EnvironmentStatus>> {
    KernelService::get_all_environment_statuses().await
}

// ============================================================================
// 环境同步命令
// ============================================================================

#[tauri::command]
pub async fn get_running_environments() -> Vec<RunningEnvironment> {
    EnvironmentService::get_running_environments().await
}

#[tauri::command]
pub async fn start_sync(params: StartSyncParams) -> Result<()> {
    EnvironmentService::start_sync(params).await
}

#[tauri::command]
pub async fn stop_sync() -> Result<()> {
    EnvironmentService::stop_sync().await
}

// ============================================================================
// 代理导出命令
// ============================================================================

#[tauri::command]
pub async fn export_proxies_to_csv(
    path: String,
    proxies: Vec<ProxyExportItem>,
    export_plain_password: bool,
) -> Result<()> {
    ProxyExportService::export_proxies_to_csv(path, proxies, export_plain_password).await
}
