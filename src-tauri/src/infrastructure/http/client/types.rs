use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 标准 JSON 响应结构
#[derive(Deserialize, Debug, Serialize)]
pub struct JsonRespnse {
    pub code: Option<i32>,
    pub message: Option<String>,
    pub data: Option<Value>,
}

/// 可能加密的响应数据
#[derive(Deserialize, Debug, Serialize)]
#[serde(untagged)]
#[allow(dead_code)]
pub enum MaybeEncryptedResponse {
    /// 加密的响应
    Encrypted {
        encrypted: bool,
        #[serde(default)]
        data: String,
        #[serde(default)]
        key: String,
    },
    /// 普通的 JSON 响应
    Plain(JsonRespnse),
}
