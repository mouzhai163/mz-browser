//! 本地用户会话。
//!
//! 个人自用：软件里只有一个本地用户，没有登录、选择用户、密码或锁屏。打开软件就直接进入，
//! 会话在启动时自动建立（见 [`ensure_default_session`]）。

use business::services::local_users::LocalUser;
use tauri::Manager;

use crate::app::context::AppContext;

/// 同一时刻只允许一个调用去建立会话（启动流程和前端初始化可能同时到达）。
static ENSURE_SESSION_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[tauri::command]
pub async fn list_local_users(
    context: tauri::State<'_, business::svc_ctx::SvcCtx>,
) -> Result<Vec<LocalUser>, String> {
    business::services::local_users::list_local_users(&context).await
}

/// 返回当前本地用户。还没有会话时在这里自动建立，所以前端永远拿得到用户。
#[tauri::command]
pub async fn get_current_local_user() -> Result<Option<LocalUser>, String> {
    ensure_default_session().await.map(Some)
}

/// 确保会话已经建立：使用默认本地用户（首次启动会创建），并启动依赖会话的后台服务
/// （内置运行时、本地 API）。可以重复调用。
pub(crate) async fn ensure_default_session() -> Result<LocalUser, String> {
    let _guard = ENSURE_SESSION_LOCK.lock().await;
    let app = crate::app::handle::get_app_handle().map_err(|error| error.to_string())?;
    let context = app.state::<business::svc_ctx::SvcCtx>();

    let already_signed_in = context.current_user_uuid().is_some();
    let user = business::services::local_users::ensure_signed_in_default_user(&context).await?;
    if already_signed_in {
        return Ok(user);
    }

    sync_local_session().await?;
    // 本地 API 默认开启；是否真的启动由用户的设置决定。
    if let Some(app_context) = AppContext::try_get() {
        if let Err(error) = app_context.local_api_manager.refresh(&context).await {
            log::warn!("failed to start the local API: {error}");
        }
    }
    Ok(user)
}

pub(crate) fn authenticated_user_uuid() -> Option<uuid::Uuid> {
    let app = crate::app::handle::get_app_handle().ok()?;
    app.state::<business::svc_ctx::SvcCtx>().current_user_uuid()
}

pub(crate) fn has_local_session() -> bool {
    authenticated_user_uuid().is_some()
}

pub(crate) async fn sync_local_session() -> Result<(), String> {
    if let Some(context) = AppContext::try_get() {
        context
            .simprint_runtime_manager
            .sync_session_state()
            .await
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}
