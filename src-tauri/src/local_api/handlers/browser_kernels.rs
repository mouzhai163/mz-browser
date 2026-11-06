use axum::{Extension, Json, response::Response};

use crate::local_api::{
    context::LocalApiRequestContext,
    handlers::{fail_response, success_response},
    services::browser_kernels::list_browser_kernels_service,
    types::LocalApiJsonRequest,
};

pub async fn list_browser_kernels_handler(
    Extension(ctx): Extension<LocalApiRequestContext>,
    Json(payload): Json<LocalApiJsonRequest>,
) -> Response {
    match list_browser_kernels_service(&ctx, payload.0).await {
        Ok(value) => success_response(None, Some(value)),
        Err((status, message)) => fail_response(status, &message),
    }
}
