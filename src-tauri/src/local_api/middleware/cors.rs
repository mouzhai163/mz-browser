use axum::{
    extract::{Request, State},
    middleware::Next,
    response::IntoResponse,
    response::Response,
};

use crate::local_api::{
    handlers::Response as LocalApiResponse,
    server::{
        cors::{apply_cors_headers, preflight_response},
        state::LocalApiServerState,
    },
};

pub async fn cors_middleware(
    State(state): State<LocalApiServerState>,
    request: Request,
    next: Next,
) -> Response {
    if request.method() == axum::http::Method::OPTIONS {
        return preflight_response(request.headers(), &state.config);
    }

    let origin = request.headers().clone();
    let mut response = next.run(request).await;
    apply_cors_headers(&origin, &mut response, &state.config);

    if response.status() == axum::http::StatusCode::METHOD_NOT_ALLOWED {
        return LocalApiResponse::<()>::fail(Some("method not allowed"), response.status())
            .into_response();
    }

    response
}
