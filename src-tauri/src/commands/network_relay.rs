use tauri::AppHandle;

use crate::app::context::AppContext;
use crate::services::network_relay::types::{
    AddGroupRequest, AddNodesRequest, AddSubscriptionRequest, NetworkMode, NetworkRelayState,
    RelayDelayResult,
};

#[tauri::command]
pub async fn get_network_relay_state(app: AppHandle) -> Result<NetworkRelayState, String> {
    Ok(AppContext::get().network_relay_manager.get_state(&app).await)
}

#[tauri::command]
pub async fn set_network_relay_mode(
    app: AppHandle,
    mode: NetworkMode,
) -> Result<NetworkRelayState, String> {
    AppContext::get().network_relay_manager.set_mode(&app, mode).await
}

#[tauri::command]
pub async fn select_network_relay_node(
    app: AppHandle,
    group_id: String,
    node_id: String,
) -> Result<NetworkRelayState, String> {
    AppContext::get()
        .network_relay_manager
        .select_node(&app, group_id, node_id)
        .await
}

#[tauri::command]
pub async fn add_network_relay_subscription(
    app: AppHandle,
    request: AddSubscriptionRequest,
) -> Result<NetworkRelayState, String> {
    AppContext::get().network_relay_manager.add_subscription(&app, request).await
}

#[tauri::command]
pub async fn refresh_network_relay_subscription(
    app: AppHandle,
    group_id: String,
) -> Result<NetworkRelayState, String> {
    AppContext::get()
        .network_relay_manager
        .refresh_subscription(&app, group_id)
        .await
}

#[tauri::command]
pub async fn add_network_relay_group(
    app: AppHandle,
    request: AddGroupRequest,
) -> Result<NetworkRelayState, String> {
    AppContext::get().network_relay_manager.add_group(&app, request).await
}

#[tauri::command]
pub async fn delete_network_relay_group(
    app: AppHandle,
    group_id: String,
) -> Result<NetworkRelayState, String> {
    AppContext::get().network_relay_manager.delete_group(&app, group_id).await
}

#[tauri::command]
pub async fn add_network_relay_nodes(
    app: AppHandle,
    request: AddNodesRequest,
) -> Result<NetworkRelayState, String> {
    AppContext::get().network_relay_manager.add_nodes(&app, request).await
}

#[tauri::command]
pub async fn delete_network_relay_node(
    app: AppHandle,
    group_id: String,
    node_id: String,
) -> Result<NetworkRelayState, String> {
    AppContext::get()
        .network_relay_manager
        .delete_node(&app, group_id, node_id)
        .await
}

#[tauri::command]
pub async fn install_network_relay_core(app: AppHandle) -> Result<NetworkRelayState, String> {
    AppContext::get().network_relay_manager.install_core(&app).await
}

#[tauri::command]
pub async fn set_network_relay_core_path(
    app: AppHandle,
    core_path: String,
) -> Result<NetworkRelayState, String> {
    AppContext::get()
        .network_relay_manager
        .set_custom_core_path(&app, core_path)
        .await
}

#[tauri::command]
pub async fn test_network_relay_node_delay(
    app: AppHandle,
    group_id: String,
    node_id: String,
) -> Result<RelayDelayResult, String> {
    AppContext::get()
        .network_relay_manager
        .test_node_delay(&app, group_id, node_id)
        .await
}

#[tauri::command]
pub async fn test_network_relay_group_delays(
    app: AppHandle,
    group_id: String,
) -> Result<Vec<RelayDelayResult>, String> {
    AppContext::get().network_relay_manager.test_group_delays(&app, group_id).await
}
