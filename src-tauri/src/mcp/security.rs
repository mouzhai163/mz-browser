use axum::{
    body::{Body, to_bytes},
    extract::{Request, State},
    http::{
        HeaderMap, StatusCode,
        header::{AUTHORIZATION, HOST, ORIGIN},
    },
    middleware::Next,
    response::{IntoResponse, Response},
};
use sha2::{Digest, Sha256};
use std::{sync::Arc, time::Duration};

use super::config::McpServerRuntimeConfig;

pub(super) fn validate_headers(
    headers: &HeaderMap,
    port: u16,
    token: &str,
    health: bool,
) -> Result<(), StatusCode> {
    let hosts = headers.get_all(HOST).iter().collect::<Vec<_>>();
    if hosts.len() != 1 {
        return Err(StatusCode::FORBIDDEN);
    }
    let host = hosts[0].to_str().map_err(|_| StatusCode::FORBIDDEN)?;
    if ![format!("127.0.0.1:{port}"), format!("localhost:{port}")]
        .contains(&host.to_ascii_lowercase())
    {
        return Err(StatusCode::FORBIDDEN);
    }
    // This endpoint is for native MCP clients, not cross-origin browser scripts.
    if headers.contains_key(ORIGIN) {
        return Err(StatusCode::FORBIDDEN);
    }
    if health {
        return Ok(());
    }
    let values = headers.get_all(AUTHORIZATION).iter().collect::<Vec<_>>();
    if values.len() != 1 {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let value = values[0].to_str().map_err(|_| StatusCode::UNAUTHORIZED)?;
    let presented = value.strip_prefix("Bearer ").ok_or(StatusCode::UNAUTHORIZED)?;
    let expected = Sha256::digest(token.as_bytes());
    let actual = Sha256::digest(presented.as_bytes());
    let difference = expected.iter().zip(actual.iter()).fold(0u8, |acc, (a, b)| acc | (a ^ b));
    if token.is_empty() || difference != 0 {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(())
}

pub(super) async fn guard(
    State(config): State<Arc<McpServerRuntimeConfig>>,
    request: Request,
    next: Next,
) -> Response {
    let health = request.uri().path() == "/health";
    if let Err(status) = validate_headers(
        request.headers(),
        config.port,
        &config.access.access_token,
        health,
    ) {
        return (status, "MCP request denied").into_response();
    }
    let (parts, body) = request.into_parts();
    let bytes = match tokio::time::timeout(Duration::from_secs(5), to_bytes(body, 65536)).await {
        Ok(Ok(bytes)) => bytes,
        Ok(Err(_)) => {
            return (StatusCode::PAYLOAD_TOO_LARGE, "MCP request too large").into_response();
        }
        Err(_) => return (StatusCode::REQUEST_TIMEOUT, "MCP request timed out").into_response(),
    };
    next.run(Request::from_parts(parts, Body::from(bytes))).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn requires_bearer_and_rejects_dns_rebinding_and_browser_origins() {
        let mut headers = HeaderMap::new();
        headers.insert(HOST, HeaderValue::from_static("127.0.0.1:37110"));
        assert_eq!(
            validate_headers(&headers, 37110, "secret", false),
            Err(StatusCode::UNAUTHORIZED)
        );
        headers.insert(AUTHORIZATION, HeaderValue::from_static("Bearer secret"));
        assert!(validate_headers(&headers, 37110, "secret", false).is_ok());
        headers.insert(HOST, HeaderValue::from_static("evil.example:37110"));
        assert_eq!(
            validate_headers(&headers, 37110, "secret", false),
            Err(StatusCode::FORBIDDEN)
        );
        headers.insert(HOST, HeaderValue::from_static("localhost:37110"));
        headers.insert(ORIGIN, HeaderValue::from_static("https://evil.example"));
        assert_eq!(
            validate_headers(&headers, 37110, "secret", false),
            Err(StatusCode::FORBIDDEN)
        );
    }

    #[test]
    fn rejects_duplicates_and_only_health_is_anonymous() {
        let mut headers = HeaderMap::new();
        headers.insert(HOST, HeaderValue::from_static("127.0.0.1:37110"));
        assert!(validate_headers(&headers, 37110, "secret", true).is_ok());
        headers.append(AUTHORIZATION, HeaderValue::from_static("Bearer secret"));
        headers.append(AUTHORIZATION, HeaderValue::from_static("Bearer secret"));
        assert_eq!(
            validate_headers(&headers, 37110, "secret", false),
            Err(StatusCode::UNAUTHORIZED)
        );
        headers.insert(AUTHORIZATION, HeaderValue::from_static("Bearer wrong"));
        assert_eq!(
            validate_headers(&headers, 37110, "secret", false),
            Err(StatusCode::UNAUTHORIZED)
        );
    }
}
