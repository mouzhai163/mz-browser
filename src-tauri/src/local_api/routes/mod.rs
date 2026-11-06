use axum::Router;

use crate::local_api::server::state::LocalApiServerState;

pub mod browser_kernels;
pub mod environments;
pub mod groups;
pub mod proxies;
pub mod tags;
pub mod workspaces;

pub fn register_routes(router: Router<LocalApiServerState>) -> Router<LocalApiServerState> {
    let router = workspaces::register_routes(router);
    let router = browser_kernels::register_routes(router);
    let router = groups::register_routes(router);
    let router = tags::register_routes(router);
    let router = environments::register_routes(router);
    proxies::register_routes(router)
}
