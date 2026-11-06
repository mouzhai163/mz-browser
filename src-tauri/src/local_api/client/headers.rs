use axum::http::{HeaderMap, HeaderValue};

pub fn extract_api_key(headers: &HeaderMap) -> Option<String> {
    headers
        .get("sp-api-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

pub fn build_local_api_auth_headers(
    api_key: &str,
    permission_code: &str,
) -> Result<reqwest::header::HeaderMap, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    let api_key_header = HeaderValue::from_str(api_key).map_err(|error| error.to_string())?;
    let permission_header =
        HeaderValue::from_str(permission_code).map_err(|error| error.to_string())?;

    headers.insert("x-local-api-key", api_key_header);
    headers.insert("x-local-api-permission", permission_header);

    Ok(headers)
}
