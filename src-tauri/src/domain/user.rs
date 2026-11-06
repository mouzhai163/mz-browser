//! 用户领域模型
//!
//! 封装用户相关的业务规则和验证逻辑

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 用户领域对象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    /// 邮箱
    pub email: String,
    /// 用户信息
    #[serde(default)]
    pub user_info: Option<Value>,
    /// 用户额外信息
    #[serde(default)]
    pub user_extra: Option<Value>,
    /// 是否首次登录
    #[serde(default)]
    pub is_first_login: Option<bool>,
}

impl User {
    /// 创建用户对象
    pub fn new(email: String) -> Self {
        Self {
            email,
            user_info: None,
            user_extra: None,
            is_first_login: None,
        }
    }

    /// 获取邮箱
    pub fn email(&self) -> &str {
        &self.email
    }

    /// 是否首次登录
    pub fn is_first_login(&self) -> bool {
        self.is_first_login.unwrap_or(false)
    }
}
