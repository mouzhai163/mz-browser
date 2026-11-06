use axum::{Router, routing::post};

use crate::local_api::handlers::tags::{delete_tag_handler, list_tags_handler};
use crate::local_api::server::state::LocalApiServerState;

pub fn register_routes(router: Router<LocalApiServerState>) -> Router<LocalApiServerState> {
    router
        .route("/api/local/tags/list", post(list_tags_handler))
        // .route("/api/local/tags/create", post(create_tag_handler))
        // .route("/api/local/tags/update", post(update_tag_handler))
        .route("/api/local/tags/delete", post(delete_tag_handler))
}
