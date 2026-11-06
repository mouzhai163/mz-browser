use tauri::AppHandle;
use tauri::Manager;

use crate::{
    app::context::AppContext,
    mcp::config::{
        McpRuntimeSnapshot, UpdateMcpConfigRequest, load_config, new_access_token, save_config,
        snapshot_from_config, update_config,
    },
};

async fn require_unlocked_session(app: &AppHandle) -> Result<(), String> {
    if app.state::<business::svc_ctx::SvcCtx>().current_user_uuid().is_none() {
        return Err("请先登录本地用户".into());
    }
    if app
        .state::<crate::app::session_lock::SessionLockManager>()
        .get_state()
        .await
        .locked
    {
        return Err("请先解锁本地会话".into());
    }
    Ok(())
}

/// 获取 MCP 运行时配置与当前进程状态快照。
#[tauri::command]
pub async fn get_mcp_config(app: AppHandle) -> Result<McpRuntimeSnapshot, String> {
    require_unlocked_session(&app).await?;
    let config = load_config(&app)?;
    let status = AppContext::get().mcp_manager.status().await;
    Ok(snapshot_from_config(config, status))
}

/// 更新 MCP 配置，但不直接改变 MCP 服务运行状态。
#[tauri::command]
pub async fn update_mcp_config(
    app: AppHandle,
    payload: UpdateMcpConfigRequest,
) -> Result<McpRuntimeSnapshot, String> {
    require_unlocked_session(&app).await?;
    let config = update_config(&app, payload)?;
    // Do not rely on the frontend to revoke a running server's old grants.
    AppContext::get().mcp_manager.stop().await;
    let status = AppContext::get().mcp_manager.status().await;
    Ok(snapshot_from_config(config, status))
}

/// 启动 MCP 服务。
#[tauri::command]
pub async fn start_mcp_runtime(app: AppHandle) -> Result<(), String> {
    require_unlocked_session(&app).await?;
    AppContext::get().mcp_manager.start(&app).await
}

/// 按当前配置重载 MCP 服务。
#[tauri::command]
pub async fn reload_mcp_runtime(app: AppHandle) -> Result<(), String> {
    require_unlocked_session(&app).await?;
    AppContext::get().mcp_manager.reload(&app).await
}

/// 停止 MCP 服务。
#[tauri::command]
pub async fn stop_mcp_runtime() -> Result<(), String> {
    AppContext::get().mcp_manager.stop().await;
    Ok(())
}

#[tauri::command]
pub async fn get_mcp_access_token(app: AppHandle) -> Result<String, String> {
    require_unlocked_session(&app).await?;
    Ok(load_config(&app)?.access_token)
}

#[tauri::command]
pub async fn rotate_mcp_access_token(app: AppHandle) -> Result<(), String> {
    require_unlocked_session(&app).await?;
    let mut config = load_config(&app)?;
    AppContext::get().mcp_manager.stop().await;
    config.access_token = new_access_token();
    save_config(&app, &config)
}
