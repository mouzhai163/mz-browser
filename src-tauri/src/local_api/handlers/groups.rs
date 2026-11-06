use axum::{Extension, Json, response::Response};

use crate::local_api::{
    context::LocalApiRequestContext,
    handlers::{fail_response, success_response},
    services::groups::{
        create_group_service, delete_group_service, list_groups_service, update_group_service,
    },
    types::LocalApiJsonRequest,
};

macro_rules! group_handler {
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

group_handler!(list_groups_handler, list_groups_service);
group_handler!(create_group_handler, create_group_service);
group_handler!(update_group_handler, update_group_service);
group_handler!(delete_group_handler, delete_group_service);
