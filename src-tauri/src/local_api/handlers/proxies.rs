use axum::{Extension, Json, response::Response};

use crate::local_api::{
    context::LocalApiRequestContext,
    handlers::{fail_response, success_response},
    services::proxies::*,
    types::LocalApiJsonRequest,
};

macro_rules! proxy_handler {
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

proxy_handler!(list_proxies_handler, list_proxies_service);
proxy_handler!(get_proxy_handler, get_proxy_service);
proxy_handler!(create_proxy_handler, create_proxy_service);
proxy_handler!(update_proxy_handler, update_proxy_service);
proxy_handler!(delete_proxy_handler, delete_proxy_service);
proxy_handler!(batch_delete_proxies_handler, batch_delete_proxies_service);
proxy_handler!(batch_import_proxies_handler, batch_import_proxies_service);
