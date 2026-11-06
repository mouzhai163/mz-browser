use axum::{Extension, Json, response::Response};

use crate::local_api::{
    context::LocalApiRequestContext,
    handlers::{fail_response, success_response},
    services::tags::{
        create_tag_service, delete_tag_service, list_tags_service, update_tag_service,
    },
    types::LocalApiJsonRequest,
};

macro_rules! tag_handler {
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

tag_handler!(list_tags_handler, list_tags_service);
tag_handler!(create_tag_handler, create_tag_service);
tag_handler!(update_tag_handler, update_tag_service);
tag_handler!(delete_tag_handler, delete_tag_service);
