use axum::http::{
    HeaderMap, HeaderValue, Response, StatusCode,
    header::{
        ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS, ACCESS_CONTROL_ALLOW_ORIGIN,
        ACCESS_CONTROL_MAX_AGE, ORIGIN,
    },
};

use crate::local_api::types::LocalApiRuntimeConfig;

pub fn apply_cors_headers<B>(
    headers: &HeaderMap,
    response: &mut Response<B>,
    config: &LocalApiRuntimeConfig,
) {
    response.headers_mut().insert(
        ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, OPTIONS"),
    );
    response.headers_mut().insert(
        ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("content-type, authorization, sp-api-key"),
    );
    response
        .headers_mut()
        .insert(ACCESS_CONTROL_MAX_AGE, HeaderValue::from_static("600"));

    if let Some(origin) = resolve_allow_origin(headers, config) {
        response.headers_mut().insert(ACCESS_CONTROL_ALLOW_ORIGIN, origin);
    }
}

pub fn preflight_response(
    headers: &HeaderMap,
    config: &LocalApiRuntimeConfig,
) -> Response<axum::body::Body> {
    let mut response = Response::builder()
        .status(StatusCode::NO_CONTENT)
        .body(axum::body::Body::empty())
        .unwrap_or_else(|_| Response::new(axum::body::Body::empty()));
    apply_cors_headers(headers, &mut response, config);
    response
}

fn resolve_allow_origin(
    headers: &HeaderMap,
    config: &LocalApiRuntimeConfig,
) -> Option<HeaderValue> {
    let origin = headers.get(ORIGIN)?.to_str().ok()?.trim();
    if origin.is_empty() {
        return None;
    }

    if config.cors_origins.iter().any(|item| item == "*") {
        return Some(HeaderValue::from_static("*"));
    }

    if config.cors_origins.iter().any(|item| item == origin) {
        return HeaderValue::from_str(origin).ok();
    }

    None
}
