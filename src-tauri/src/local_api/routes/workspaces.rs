use axum::{Router, routing::post};

use crate::local_api::handlers::workspaces::{
    get_workspace_handler, list_workspaces_handler, switch_workspace_handler,
};
use crate::local_api::server::state::LocalApiServerState;

pub fn register_routes(router: Router<LocalApiServerState>) -> Router<LocalApiServerState> {
    router
        .route("/api/local/workspaces/list", post(list_workspaces_handler))
        .route("/api/local/workspaces/get", post(get_workspace_handler))
        .route(
            "/api/local/workspaces/switch",
            post(switch_workspace_handler),
        )
}
