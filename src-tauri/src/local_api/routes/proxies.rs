use axum::{Router, routing::post};

use crate::local_api::handlers::proxies::{
    batch_delete_proxies_handler, batch_import_proxies_handler, delete_proxy_handler,
    get_proxy_handler, list_proxies_handler,
};
use crate::local_api::server::state::LocalApiServerState;

pub fn register_routes(router: Router<LocalApiServerState>) -> Router<LocalApiServerState> {
    router
        .route("/api/local/proxies/list", post(list_proxies_handler))
        .route("/api/local/proxies/detail", post(get_proxy_handler))
        // .route("/api/local/proxies/create", post(create_proxy_handler))
        // .route("/api/local/proxies/update", post(update_proxy_handler))
        .route("/api/local/proxies/delete", post(delete_proxy_handler))
        .route(
            "/api/local/proxies/batch-delete",
            post(batch_delete_proxies_handler),
        )
        .route(
            "/api/local/proxies/batch-import",
            post(batch_import_proxies_handler),
        )
}
