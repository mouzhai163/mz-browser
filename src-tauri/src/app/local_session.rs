//! 本地会话：软件没有用户、登录或锁屏，启动时只需要把依赖数据库的后台服务（内置运行时、MCP）
//! 拉起来一次。其他地方通过 [`is_ready`] 判断这些服务是否已经可用。

use std::sync::atomic::{AtomicBool, Ordering};

use crate::app::context::AppContext;

/// 同一时刻只允许一个调用去执行初始化（启动流程和前端初始化可能同时到达）。
static ENSURE_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static READY: AtomicBool = AtomicBool::new(false);

/// 后台服务是否已经初始化完成。
pub fn is_ready() -> bool {
    READY.load(Ordering::Acquire)
}

/// 确保后台服务已经初始化：把运行时的状态同步一次，并按设置启动 MCP。可以重复调用。
pub async fn ensure_ready() -> Result<(), String> {
    let _guard = ENSURE_LOCK.lock().await;
    if is_ready() {
        return Ok(());
    }

    let app = crate::app::handle::get_app_handle().map_err(|error| error.to_string())?;

    sync_runtime().await?;
    READY.store(true, Ordering::Release);

    if let Some(app_context) = AppContext::try_get() {
        start_mcp_if_configured(&app, app_context).await;
    }
    Ok(())
}

/// 用户在设置里选了“启动软件时自动开启”时，随软件一起启动 MCP 服务。
async fn start_mcp_if_configured(app: &tauri::AppHandle, app_context: &AppContext) {
    use crate::mcp::config::{UpdateMcpConfigRequest, load_config, update_config};

    let wants_auto_start = match load_config(app) {
        Ok(config) => config.auto_start,
        Err(error) => {
            log::warn!("cannot read the MCP settings: {error}");
            return;
        }
    };
    if !wants_auto_start {
        return;
    }
    let enable = UpdateMcpConfigRequest { enabled: Some(true), ..Default::default() };
    if let Err(error) = update_config(app, enable) {
        log::warn!("cannot enable MCP for auto start: {error}");
        return;
    }
    if let Err(error) = app_context.mcp_manager.start(app).await {
        log::warn!("failed to auto-start MCP: {error}");
    }
}

/// 把当前状态同步给内置运行时。
pub(crate) async fn sync_runtime() -> Result<(), String> {
    if let Some(context) = AppContext::try_get() {
        context
            .mz_runtime_manager
            .sync_session_state()
            .await
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}
