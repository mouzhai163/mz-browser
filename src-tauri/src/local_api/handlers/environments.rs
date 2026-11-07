use axum::{Extension, Json, response::Response};

use crate::local_api::{
    context::LocalApiRequestContext,
    entitys::{LocalApiBatchStartEnvironmentsRequest, LocalApiStartEnvironmentRequest},
    handlers::{fail_response, success_response},
    services::environments::*,
    types::LocalApiJsonRequest,
};

macro_rules! environment_handler {
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

environment_handler!(list_environments_handler, list_environments_service);
environment_handler!(get_environment_handler, get_environment_service);
environment_handler!(
    batch_get_environments_handler,
    batch_get_environments_service
);
environment_handler!(create_environment_handler, create_environment_service);
environment_handler!(
    batch_create_environments_handler,
    batch_create_environments_service
);
environment_handler!(update_environment_handler, update_environment_service);
environment_handler!(delete_environment_handler, delete_environment_service);
environment_handler!(
    batch_delete_environments_handler,
    batch_delete_environments_service
);
environment_handler!(set_environment_proxy_handler, set_environment_proxy_service);
environment_handler!(assign_tags_handler, assign_tags_service);
environment_handler!(remove_tag_handler, remove_tag_service);
environment_handler!(move_to_group_handler, move_to_group_service);
environment_handler!(batch_move_to_group_handler, batch_move_to_group_service);
environment_handler!(
    set_environment_accounts_handler,
    set_environment_accounts_service
);
environment_handler!(batch_assign_tags_handler, batch_assign_tags_service);
environment_handler!(batch_remove_tags_handler, batch_remove_tags_service);
environment_handler!(list_environment_urls_handler, list_environment_urls_service);
environment_handler!(add_environment_url_handler, add_environment_url_service);
environment_handler!(
    delete_environment_url_handler,
    delete_environment_url_service
);
environment_handler!(
    clear_environment_urls_handler,
    clear_environment_urls_service
);
environment_handler!(
    list_environment_cookies_handler,
    list_environment_cookies_service
);
environment_handler!(
    add_environment_cookie_handler,
    add_environment_cookie_service
);
environment_handler!(
    delete_environment_cookie_handler,
    delete_environment_cookie_service
);
environment_handler!(
    clear_environment_cookies_handler,
    clear_environment_cookies_service
);
environment_handler!(
    list_recycle_bin_environments_handler,
    list_recycle_bin_environments_service
);
environment_handler!(restore_environment_handler, restore_environment_service);
environment_handler!(
    batch_restore_environments_handler,
    batch_restore_environments_service
);
environment_handler!(
    permanent_delete_environment_handler,
    permanent_delete_environment_service
);
environment_handler!(
    batch_permanent_delete_environments_handler,
    batch_permanent_delete_environments_service
);

pub async fn start_environment_handler(
    Extension(ctx): Extension<LocalApiRequestContext>,
    Json(payload): Json<LocalApiStartEnvironmentRequest>,
) -> Response {
    match start_environment_service(&ctx, payload).await {
        Ok(value) => success_response(None, Some(value)),
        Err((status, message)) => fail_response(status, &message),
    }
}

pub async fn stop_environment_handler(
    Extension(ctx): Extension<LocalApiRequestContext>,
    Json(payload): Json<LocalApiStartEnvironmentRequest>,
) -> Response {
    match stop_environment_service(&ctx, payload).await {
        Ok(value) => success_response(None, Some(value)),
        Err((status, message)) => fail_response(status, &message),
    }
}

pub async fn batch_start_environments_local_handler(
    Extension(ctx): Extension<LocalApiRequestContext>,
    Json(payload): Json<LocalApiBatchStartEnvironmentsRequest>,
) -> Response {
    match batch_start_environments_local_service(&ctx, payload).await {
        Ok(value) => success_response(None, Some(value)),
        Err((status, message)) => fail_response(status, &message),
    }
}

pub async fn batch_stop_environments_local_handler(
    Extension(ctx): Extension<LocalApiRequestContext>,
    Json(payload): Json<LocalApiBatchStartEnvironmentsRequest>,
) -> Response {
    match batch_stop_environments_local_service(&ctx, payload).await {
        Ok(value) => success_response(None, Some(value)),
        Err((status, message)) => fail_response(status, &message),
    }
}

pub async fn get_environment_status_handler(
    Extension(ctx): Extension<LocalApiRequestContext>,
    Json(payload): Json<LocalApiStartEnvironmentRequest>,
) -> Response {
    match get_environment_status_service(&ctx, payload).await {
        Ok(value) => success_response(None, Some(value)),
        Err((status, message)) => fail_response(status, &message),
    }
}

pub async fn get_environment_cdp_endpoint_handler(
    Extension(ctx): Extension<LocalApiRequestContext>,
    Json(payload): Json<LocalApiStartEnvironmentRequest>,
) -> Response {
    match get_environment_cdp_endpoint_service(&ctx, payload).await {
        Ok(value) => success_response(None, Some(value)),
        Err((status, message)) => fail_response(status, &message),
    }
}
