use axum::{Extension, Json, response::Response};

use crate::local_api::{
    context::LocalApiRequestContext,
    handlers::{fail_response, success_response},
    services::workspaces::{
        get_workspace_service, list_workspaces_service, switch_workspace_service,
    },
    types::LocalApiJsonRequest,
};

macro_rules! workspace_handler {
    ($fn_name:ident, $service_fn:ident) => {
        pub async fn $fn_name(
            Extension(ctx): Extension<LocalApiRequestContext>,
            Json(payload): Json<LocalApiJsonRequest>,
        ) -> Response {
            match $service_fn(&ctx, payload.0).await {
                Ok(value) => success_response(None, Some(value)),
                Err((status, message)) => fail_response(status, &message),
            }
        }
    };
}

workspace_handler!(list_workspaces_handler, list_workspaces_service);
workspace_handler!(get_workspace_handler, get_workspace_service);
workspace_handler!(switch_workspace_handler, switch_workspace_service);
