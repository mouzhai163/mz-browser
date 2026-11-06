pub mod browser_kernels;
pub mod environments;
pub mod groups;
pub mod proxies;
pub mod system;
pub mod tags;
pub mod workspaces;

use axum::{http::StatusCode, response::IntoResponse};
use serde::Serialize;
use serde_json::json;

const SUCCESS_CODE: i32 = 1;
const FAIL_CODE: i32 = 0;

#[derive(Debug, Clone, Serialize)]
pub struct Response<T> {
    pub status_code: u16,
    pub code: i32,
    pub data: Option<T>,
    pub message: Option<String>,
}

impl<T> Response<T> {
    pub fn success(message: Option<&str>, data: Option<T>) -> Self {
        Self {
            status_code: 200,
            code: SUCCESS_CODE,
            data,
            message: message.map(ToOwned::to_owned),
        }
    }

    pub fn fail(message: Option<&str>, status_code: StatusCode) -> Self {
        Self {
            status_code: status_code.as_u16(),
            code: FAIL_CODE,
            data: None,
            message: message.map(ToOwned::to_owned),
        }
    }
}

impl<T> IntoResponse for Response<T>
where
    T: Serialize,
{
    fn into_response(self) -> axum::response::Response {
        let mut content_json = json!({ "code": self.code });

        if let Some(message) = &self.message {
            content_json["message"] = json!(message);
        }

        if let Some(data) = &self.data {
            content_json["data"] = json!(data);
        }

        match StatusCode::from_u16(self.status_code) {
            Ok(status) => (status, axum::Json(content_json)),
            Err(_) => (StatusCode::BAD_REQUEST, axum::Json(content_json)),
        }
        .into_response()
    }
}

pub fn success_response<T>(message: Option<&str>, data: Option<T>) -> axum::response::Response
where
    T: Serialize,
{
    Response::success(message, data).into_response()
}

pub fn fail_response(status: StatusCode, message: &str) -> axum::response::Response {
    Response::<()>::fail(Some(message), status).into_response()
}
