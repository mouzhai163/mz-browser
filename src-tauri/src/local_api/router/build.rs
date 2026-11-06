use axum::{Router, middleware, routing::get};

use crate::local_api::{
    handlers::system::health_handler,
    middleware::{auth::auth_middleware, cors::cors_middleware},
    routes,
    server::state::LocalApiServerState,
};

pub fn build_router(state: LocalApiServerState) -> Router {
    let router: Router<LocalApiServerState> =
        Router::new().route("/api/local/health", get(health_handler));

    routes::register_routes(router)
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            cors_middleware,
        ))
        .with_state(state)
}
