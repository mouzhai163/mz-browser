use axum::http::StatusCode;
use serde::de::DeserializeOwned;
use serde_json::Value;
use tauri::Manager;

use crate::app::handle::get_app_handle;

/// 在进程内调用一个业务路由，返回它的 `data`。
///
/// 调用方（MCP）自己负责鉴权和授权环境检查，这里不再校验密钥。
/// 删除这类没有返回数据的路由，`data` 按 `null` 解析，所以 `T` 可以是 `()` 或 `Value`。
pub async fn dispatch_data_request<T>(route: &str, payload: Value) -> Result<T, (StatusCode, String)>
where
    T: DeserializeOwned,
{
    let app =
        get_app_handle().map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    let business_context = app.state::<business::svc_ctx::SvcCtx>();

    let data = match crate::services::environment::permanent_delete::dispatch_post(&business_context, route, &payload).await {
        Some(Ok(data)) => data,
        Some(Err(message)) => return Err((StatusCode::BAD_REQUEST, message)),
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                format!("Local business route is not available: {route}"),
            ));
        }
    };

    serde_json::from_value(data).map_err(|error| {
        (
            StatusCode::BAD_GATEWAY,
            format!("failed to parse local response data: {error}"),
        )
    })
}
