use axum::{Router, routing::post};

use crate::local_api::handlers::browser_kernels::list_browser_kernels_handler;
use crate::local_api::server::state::LocalApiServerState;

pub fn register_routes(router: Router<LocalApiServerState>) -> Router<LocalApiServerState> {
    router.route(
        "/api/local/browser-kernels/list",
        post(list_browser_kernels_handler),
    )
}
