//! 本地会话：软件没有用户、登录或锁屏，启动时只需要把依赖数据库的后台服务（内置运行时、本地 API）
//! 拉起来一次。其他地方通过 [`is_ready`] 判断这些服务是否已经可用。

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::Manager;

use crate::app::context::AppContext;

/// 同一时刻只允许一个调用去执行初始化（启动流程和前端初始化可能同时到达）。
static ENSURE_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static READY: AtomicBool = AtomicBool::new(false);

/// 后台服务是否已经初始化完成。
pub fn is_ready() -> bool {
    READY.load(Ordering::Acquire)
}

/// 确保后台服务已经初始化：把运行时的状态同步一次，并按设置启动本地 API。可以重复调用。
pub async fn ensure_ready() -> Result<(), String> {
    let _guard = ENSURE_LOCK.lock().await;
    if is_ready() {
        return Ok(());
    }

    let app = crate::app::handle::get_app_handle().map_err(|error| error.to_string())?;
    let context = app.state::<business::svc_ctx::SvcCtx>();

    sync_runtime().await?;
    READY.store(true, Ordering::Release);

    // 本地 API 默认开启；是否真的启动由设置决定。
    if let Some(app_context) = AppContext::try_get() {
        if let Err(error) = app_context.local_api_manager.refresh(&context).await {
            log::warn!("failed to start the local API: {error}");
        }
    }
    Ok(())
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
