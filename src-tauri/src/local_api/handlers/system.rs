use axum::{extract::State, response::Response};
use serde_json::json;

use crate::local_api::{handlers::success_response, server::state::LocalApiServerState};

pub async fn health_handler(State(_state): State<LocalApiServerState>) -> Response {
    success_response(Some("ok"), Some(json!({ "status": "running" })))
}
