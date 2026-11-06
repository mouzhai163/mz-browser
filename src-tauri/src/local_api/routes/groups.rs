use axum::{Router, routing::post};

use crate::local_api::handlers::groups::{delete_group_handler, list_groups_handler};
use crate::local_api::server::state::LocalApiServerState;

pub fn register_routes(router: Router<LocalApiServerState>) -> Router<LocalApiServerState> {
    router
        .route("/api/local/groups/list", post(list_groups_handler))
        // .route("/api/local/groups/create", post(create_group_handler))
        // .route("/api/local/groups/update", post(update_group_handler))
        .route("/api/local/groups/delete", post(delete_group_handler))
}
