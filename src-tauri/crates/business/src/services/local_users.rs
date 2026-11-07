//! 本地用户。
//!
//! 个人自用：软件里只有一个本地用户，不存在用户选择、密码或锁定。这个用户只是数据归属
//! （工作空间、团队、本地 API 密钥等）的持有者，启动时自动使用，见 [`ensure_signed_in_default_user`]。

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{dto::LocalApiPermissionDefinitionDto, svc_ctx::SvcCtx};

pub const LOCAL_USER_AVATARS: &[&str] = &[
    "🙂", "😎", "🦊", "🐼", "🐯", "🐙", "🦉", "🐳", "🌙", "⭐", "🌿", "🚀",
];

/// 首次启动时自动创建的默认用户。
const DEFAULT_NICKNAME: &str = "本地用户";

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct LocalUser {
    pub uuid: Uuid,
    pub nickname: String,
    pub avatar: String,
    pub current_workspace_uuid: Option<Uuid>,
    pub current_team_uuid: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLocalUserRequest {
    pub nickname: String,
    pub avatar: String,
}

pub async fn list_local_users(context: &SvcCtx) -> Result<Vec<LocalUser>, String> {
    sqlx::query_as::<_, LocalUser>(
        r#"
        SELECT
            u.uuid,
            COALESCE(NULLIF(ui.nickname, ''), 'Local User') AS nickname,
            lua.avatar,
            ui.current_workspace_uuid,
            ui.current_team_uuid
        FROM users u
        JOIN user_infos ui ON ui.user_uuid = u.uuid
        JOIN local_user_auth lua ON lua.user_uuid = u.uuid
        WHERE u.deleted_at IS NULL AND ui.deleted_at IS NULL
        ORDER BY lua.created_at, ui.id
        "#,
    )
    .fetch_all(&context.db)
    .await
    .map_err(|error| error.to_string())
}

pub async fn current_local_user(context: &SvcCtx) -> Result<Option<LocalUser>, String> {
    let Some(user_uuid) = context.current_user_uuid() else {
        return Ok(None);
    };
    fetch_local_user(context, user_uuid).await
}

/// 默认用户的选择规则：拥有最多环境的那个（也就是你一直在用的那个，数据在它名下，选错了环境会“消失”），
/// 数量相同取最早创建的。`users` 已按创建时间排好序。
fn choose_default_user(users: &[LocalUser], environment_counts: &HashMap<Uuid, i64>) -> Option<usize> {
    users
        .iter()
        .enumerate()
        .max_by_key(|(index, user)| {
            (environment_counts.get(&user.uuid).copied().unwrap_or(0), std::cmp::Reverse(*index))
        })
        .map(|(index, _)| index)
}

/// 确保已经在使用默认本地用户并返回它：已经在使用就直接返回；否则按 [`choose_default_user`] 选一个，
/// 一个都没有就先创建。没有选择、没有密码——打开软件就是这个用户。
pub async fn ensure_signed_in_default_user(context: &SvcCtx) -> Result<LocalUser, String> {
    if let Some(user) = current_local_user(context).await? {
        return Ok(user);
    }
    let mut users = list_local_users(context).await?;
    let counts: HashMap<Uuid, i64> = sqlx::query_as::<_, (Uuid, i64)>(
        "SELECT user_uuid, COUNT(*) FROM environments WHERE deleted_at IS NULL GROUP BY user_uuid",
    )
    .fetch_all(&context.db)
    .await
    .map_err(|error| error.to_string())?
    .into_iter()
    .collect();
    let user = match choose_default_user(&users, &counts) {
        Some(index) => users.swap_remove(index),
        None => {
            create_local_user(
                context,
                &CreateLocalUserRequest {
                    nickname: DEFAULT_NICKNAME.to_string(),
                    avatar: LOCAL_USER_AVATARS[0].to_string(),
                },
            )
            .await?
        }
    };
    context.authenticate_user(user.uuid);
    Ok(user)
}

pub async fn create_local_user(
    context: &SvcCtx,
    request: &CreateLocalUserRequest,
) -> Result<LocalUser, String> {
    let nickname = validate_nickname(&request.nickname)?;
    let avatar = validate_avatar(&request.avatar)?;
    let permission_definitions =
        crate::models::local_api::fetch_permission_definitions(&context.db)
            .await
            .map_err(|error| error.to_string())?;
    let mut transaction = context.db.begin().await.map_err(|error| error.to_string())?;
    let user_uuid = Uuid::new_v4();
    let user_id = format!("LOCAL-{}", user_uuid.simple());

    sqlx::query("INSERT INTO users (uuid, id) VALUES ($1, $2)")
        .bind(user_uuid)
        .bind(user_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

    // `email` and `password` are legacy columns retained while the copied business schema is
    // being reduced. They are not local-account attributes and are never exposed to the UI.
    sqlx::query(
        "INSERT INTO user_infos (user_uuid, nickname, email, password, avatar_hash, status) \
         VALUES ($1, $2, $3, '', $4, 'active')",
    )
    .bind(user_uuid)
    .bind(&nickname)
    .bind(format!("local-{user_uuid}@simprint.invalid"))
    .bind(&avatar)
    .execute(&mut *transaction)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query("INSERT INTO local_user_auth (user_uuid, avatar) VALUES ($1, $2)")
        .bind(user_uuid)
        .bind(&avatar)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;

    sqlx::query(
        "INSERT INTO user_preferences (user_uuid, theme, language, notifications_enabled) \
         VALUES ($1, 'system', 'zh-CN', TRUE)",
    )
    .bind(user_uuid)
    .execute(&mut *transaction)
    .await
    .map_err(|error| error.to_string())?;

    // 本地 API 默认开启。
    sqlx::query(
        "INSERT INTO user_local_api_settings \
         (user_uuid, enabled, port, remote_access, cors_origins) \
         VALUES ($1, TRUE, 8080, FALSE, '[]')",
    )
    .bind(user_uuid)
    .execute(&mut *transaction)
    .await
    .map_err(|error| error.to_string())?;

    initialize_local_api_key(&mut transaction, user_uuid, &permission_definitions).await?;

    let workspace_uuid: Uuid = sqlx::query_scalar(
        "INSERT INTO workspaces (name, owner_uuid, workspace_type) \
         VALUES ($1, $2, 'personal') RETURNING uuid",
    )
    .bind(format!("{nickname} 的工作空间"))
    .bind(user_uuid)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| error.to_string())?;

    let quota = &context.workspace_quota.default;
    sqlx::query(
        "INSERT INTO workspace_quotas \
         (workspace_uuid, max_environments, max_team_members, max_proxies, max_rpa_tasks) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(workspace_uuid)
    .bind(quota.max_environments)
    .bind(quota.max_team_members)
    .bind(quota.max_proxies)
    .bind(quota.max_rpa_tasks)
    .execute(&mut *transaction)
    .await
    .map_err(|error| error.to_string())?;

    let team_uuid: Uuid = sqlx::query_scalar(
        "INSERT INTO teams (workspace_uuid, name, description, owner_uuid) \
         VALUES ($1, $2, '默认团队', $3) RETURNING uuid",
    )
    .bind(workspace_uuid)
    .bind(format!("{nickname} 的团队"))
    .bind(user_uuid)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query(
        "INSERT INTO team_members (team_uuid, workspace_uuid, user_uuid, role, status) \
         VALUES ($1, $2, $3, 'owner', 'active')",
    )
    .bind(team_uuid)
    .bind(workspace_uuid)
    .bind(user_uuid)
    .execute(&mut *transaction)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query(
        "UPDATE user_infos SET current_workspace_uuid = $1, current_team_uuid = $2 \
         WHERE user_uuid = $3",
    )
    .bind(workspace_uuid)
    .bind(team_uuid)
    .bind(user_uuid)
    .execute(&mut *transaction)
    .await
    .map_err(|error| error.to_string())?;

    transaction.commit().await.map_err(|error| error.to_string())?;
    fetch_local_user(context, user_uuid)
        .await?
        .ok_or_else(|| "本地用户创建后无法读取".to_string())
}

async fn fetch_local_user(context: &SvcCtx, user_uuid: Uuid) -> Result<Option<LocalUser>, String> {
    sqlx::query_as::<_, LocalUser>(
        r#"
        SELECT
            u.uuid,
            COALESCE(NULLIF(ui.nickname, ''), 'Local User') AS nickname,
            lua.avatar,
            ui.current_workspace_uuid,
            ui.current_team_uuid
        FROM users u
        JOIN user_infos ui ON ui.user_uuid = u.uuid
        JOIN local_user_auth lua ON lua.user_uuid = u.uuid
        WHERE u.uuid = $1 AND u.deleted_at IS NULL AND ui.deleted_at IS NULL
        "#,
    )
    .bind(user_uuid)
    .fetch_optional(&context.db)
    .await
    .map_err(|error| error.to_string())
}

async fn initialize_local_api_key(
    transaction: &mut sqlx::Transaction<'_, crate::database::Db>,
    user_uuid: Uuid,
    definitions: &[LocalApiPermissionDefinitionDto],
) -> Result<(), String> {
    let api_key = format!("sk_local_{}", Uuid::new_v4().simple());
    let key_hash = crate::models::local_api::hash_api_key(&api_key);
    let key_id: i32 = sqlx::query_scalar(
        "INSERT INTO user_local_api_keys \
         (user_uuid, key_prefix, key_hash, api_key, daily_limit) \
         VALUES ($1, $2, $3, $4, 1000) RETURNING id",
    )
    .bind(user_uuid)
    .bind(api_key.chars().take(16).collect::<String>())
    .bind(key_hash)
    .bind(api_key)
    .fetch_one(&mut **transaction)
    .await
    .map_err(|error| error.to_string())?;

    for definition in definitions {
        sqlx::query(
            "INSERT INTO user_local_api_key_permissions \
             (api_key_id, permission_code, is_enabled, rate_limit_per_minute, rate_limit_per_hour) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(key_id)
        .bind(&definition.permission_code)
        .bind(definition.default_enabled)
        .bind(definition.default_rate_limit_per_minute)
        .bind(definition.default_rate_limit_per_hour)
        .execute(&mut **transaction)
        .await
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn validate_nickname(value: &str) -> Result<String, String> {
    let nickname = value.trim();
    if nickname.is_empty() {
        return Err("请输入用户昵称".to_string());
    }
    if nickname.chars().count() > 64 {
        return Err("用户昵称不能超过 64 个字符".to_string());
    }
    Ok(nickname.to_string())
}

fn validate_avatar(value: &str) -> Result<String, String> {
    if LOCAL_USER_AVATARS.contains(&value) {
        Ok(value.to_string())
    } else {
        Err("请选择有效的本地用户图标".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::DatabaseConfig;

    async fn context() -> SvcCtx {
        let mut config = DatabaseConfig::embedded("sqlite::memory:");
        config.max_connections = 1;
        config.min_connections = 1;
        SvcCtx::new(&config).await.unwrap()
    }

    fn user(index: u128, nickname: &str) -> LocalUser {
        LocalUser {
            uuid: Uuid::from_u128(index),
            nickname: nickname.to_string(),
            avatar: "🙂".to_string(),
            current_workspace_uuid: None,
            current_team_uuid: None,
        }
    }

    #[test]
    fn the_user_with_the_most_environments_is_the_default() {
        let users = vec![user(1, "LOCAL"), user(2, "mz"), user(3, "other")];
        let counts = HashMap::from([(Uuid::from_u128(2), 7), (Uuid::from_u128(3), 2)]);
        assert_eq!(choose_default_user(&users, &counts), Some(1));
    }

    #[test]
    fn ties_and_empty_data_fall_back_to_the_earliest_user() {
        let users = vec![user(1, "first"), user(2, "second"), user(3, "third")];
        assert_eq!(choose_default_user(&users, &HashMap::new()), Some(0));
        let tied = HashMap::from([(Uuid::from_u128(2), 4), (Uuid::from_u128(3), 4)]);
        assert_eq!(choose_default_user(&users, &tied), Some(1));
        assert_eq!(choose_default_user(&[], &HashMap::new()), None);
    }

    #[tokio::test]
    async fn first_start_signs_in_the_built_in_user_without_any_prompt() {
        let context = context().await;
        assert_eq!(context.current_user_uuid(), None);

        let user = ensure_signed_in_default_user(&context).await.unwrap();
        assert_eq!(context.current_user_uuid(), Some(user.uuid));
        assert_eq!(list_local_users(&context).await.unwrap().len(), 1);

        // 本地 API 默认开启（内置用户的设置行在第一次读取配置时创建）
        let config = crate::services::local_api::get_local_api_config_service(&context, user.uuid)
            .await
            .unwrap();
        assert!(config.enabled, "the local API must be on by default");
    }

    #[tokio::test]
    async fn signing_in_again_reuses_the_same_user() {
        let context = context().await;
        let first = ensure_signed_in_default_user(&context).await.unwrap();
        let second = ensure_signed_in_default_user(&context).await.unwrap();
        assert_eq!(first.uuid, second.uuid);

        // 模拟重启：会话清空后仍然回到同一个用户，不会再建新的
        context.clear_authenticated_user();
        let third = ensure_signed_in_default_user(&context).await.unwrap();
        assert_eq!(first.uuid, third.uuid);
        assert_eq!(list_local_users(&context).await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn extra_users_do_not_change_which_user_is_used_without_data() {
        let context = context().await;
        let builtin = ensure_signed_in_default_user(&context).await.unwrap();
        create_local_user(
            &context,
            &CreateLocalUserRequest { nickname: "Alice".to_string(), avatar: "🦊".to_string() },
        )
        .await
        .unwrap();
        context.clear_authenticated_user();
        let user = ensure_signed_in_default_user(&context).await.unwrap();
        assert_eq!(user.uuid, builtin.uuid, "no environments anywhere: the earliest user wins");
    }

    #[tokio::test]
    async fn new_users_are_created_with_the_local_api_enabled() {
        let context = context().await;
        let user = create_local_user(
            &context,
            &CreateLocalUserRequest { nickname: "Alice".to_string(), avatar: "🦊".to_string() },
        )
        .await
        .unwrap();
        let enabled: bool =
            sqlx::query_scalar("SELECT enabled FROM user_local_api_settings WHERE user_uuid = $1")
                .bind(user.uuid)
                .fetch_one(&context.db)
                .await
                .unwrap();
        assert!(enabled);
    }

    #[tokio::test]
    async fn invalid_nicknames_and_avatars_are_rejected() {
        let context = context().await;
        for (nickname, avatar) in [("", "🦊"), ("   ", "🦊"), ("ok", "not-an-avatar")] {
            assert!(create_local_user(
                &context,
                &CreateLocalUserRequest { nickname: nickname.to_string(), avatar: avatar.to_string() },
            )
            .await
            .is_err());
        }
    }
}
