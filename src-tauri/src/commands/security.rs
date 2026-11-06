/// 安全相关的 Tauri 命令
use crate::app::session_lock::{SessionLockManager, SessionLockStateResponse};
use crate::core::error::Result;
use tauri::{AppHandle, State};

/// 上报用户活跃
#[tauri::command]
pub async fn report_user_activity(
    _source: Option<String>,
    state: State<'_, SessionLockManager>,
) -> Result<()> {
    state.report_activity().await;
    Ok(())
}

/// 获取当前会话锁定状态
#[tauri::command]
pub async fn get_session_lock_state(
    state: State<'_, SessionLockManager>,
) -> Result<SessionLockStateResponse> {
    Ok(state.get_state().await)
}

/// 解锁当前会话
#[tauri::command]
pub async fn unlock_session(app: AppHandle, state: State<'_, SessionLockManager>, context: State<'_, business::svc_ctx::SvcCtx>, password: Option<String>) -> Result<()> {
    if !state.get_state().await.locked { return Ok(()); }
    let user = context.current_user_uuid().ok_or("No authenticated user can unlock this session")?;
    business::services::local_users::verify_local_user_password(&context, user, password.as_deref())
        .await.map_err(crate::core::error::Error::from)?;
    if context.current_user_uuid() != Some(user) { return Err("Local user changed during unlock".into()); }
    state.unlock(&app).await;
    Ok(())
}
