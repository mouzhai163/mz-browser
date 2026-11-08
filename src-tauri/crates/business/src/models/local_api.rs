use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::Error;

use crate::database::{Db, Pool};

use crate::dto::{
    LocalApiKeyDto, LocalApiKeyPermissionDto, LocalApiPermissionDefinitionDto, LocalApiSettingsDto,
};

/// 本地 API 的设置只有一行（id 固定为 1）。
const SETTINGS_ROW_ID: i32 = 1;

pub async fn fetch_local_api_settings(
    pool: &Pool<Db>,
) -> Result<Option<LocalApiSettingsDto>, Error> {
    sqlx::query_as::<_, LocalApiSettingsDto>(
        r#"
        SELECT id, uuid, enabled, port, remote_access, cors_origins, created_at, updated_at, deleted_at
        FROM local_api_settings
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(SETTINGS_ROW_ID)
    .fetch_optional(pool)
    .await
}

pub async fn upsert_local_api_settings(
    pool: &Pool<Db>,
    enabled: Option<bool>,
    port: Option<i32>,
    remote_access: Option<bool>,
    cors_origins: Option<&Value>,
) -> Result<(), Error> {
    sqlx::query(
        r#"
        INSERT INTO local_api_settings (id, enabled, port, remote_access, cors_origins)
        VALUES ($1, COALESCE($2, FALSE), COALESCE($3, 8080), COALESCE($4, FALSE), COALESCE($5, '[]'))
        ON CONFLICT (id) DO UPDATE SET
            enabled = COALESCE($2, local_api_settings.enabled),
            port = COALESCE($3, local_api_settings.port),
            remote_access = COALESCE($4, local_api_settings.remote_access),
            cors_origins = COALESCE($5, local_api_settings.cors_origins),
            updated_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(SETTINGS_ROW_ID)
    .bind(enabled)
    .bind(port)
    .bind(remote_access)
    .bind(cors_origins)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn fetch_active_api_key(pool: &Pool<Db>) -> Result<Option<LocalApiKeyDto>, Error> {
    sqlx::query_as::<_, LocalApiKeyDto>(
        r#"
        SELECT
            id, uuid, key_prefix, key_hash, api_key, is_active, requests_today,
            daily_limit, last_reset_date, last_used_at, expires_at, created_at, updated_at, deleted_at
        FROM local_api_keys
        WHERE is_active = TRUE AND deleted_at IS NULL
        ORDER BY id DESC
        LIMIT 1
        "#,
    )
    .fetch_optional(pool)
    .await
}

pub async fn fetch_api_key_by_hash(
    pool: &Pool<Db>,
    key_hash: &str,
) -> Result<Option<LocalApiKeyDto>, Error> {
    sqlx::query_as::<_, LocalApiKeyDto>(
        r#"
        SELECT
            id, uuid, key_prefix, key_hash, api_key, is_active, requests_today,
            daily_limit, last_reset_date, last_used_at, expires_at, created_at, updated_at, deleted_at
        FROM local_api_keys
        WHERE key_hash = $1 AND is_active = TRUE AND deleted_at IS NULL
        LIMIT 1
        "#,
    )
    .bind(key_hash)
    .fetch_optional(pool)
    .await
}

pub async fn deactivate_api_keys(pool: &Pool<Db>) -> Result<(), Error> {
    sqlx::query(
        r#"
        UPDATE local_api_keys
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE is_active = TRUE AND deleted_at IS NULL
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn insert_api_key(
    pool: &Pool<Db>,
    key_prefix: &str,
    key_hash: &str,
    api_key: &str,
    daily_limit: i32,
) -> Result<LocalApiKeyDto, Error> {
    sqlx::query_as::<_, LocalApiKeyDto>(
        r#"
        INSERT INTO local_api_keys (key_prefix, key_hash, api_key, daily_limit)
        VALUES ($1, $2, $3, $4)
        RETURNING
            id, uuid, key_prefix, key_hash, api_key, is_active, requests_today,
            daily_limit, last_reset_date, last_used_at, expires_at, created_at, updated_at, deleted_at
        "#,
    )
    .bind(key_prefix)
    .bind(key_hash)
    .bind(api_key)
    .bind(daily_limit)
    .fetch_one(pool)
    .await
}

pub async fn fetch_api_key_permission(
    pool: &Pool<Db>,
    api_key_id: i32,
    permission_code: &str,
) -> Result<Option<LocalApiKeyPermissionDto>, Error> {
    sqlx::query_as::<_, LocalApiKeyPermissionDto>(
        r#"
        SELECT
            id, uuid, api_key_id, permission_code, is_enabled, rate_limit_per_minute,
            rate_limit_per_hour, created_at, updated_at, deleted_at
        FROM local_api_key_permissions
        WHERE api_key_id = $1
          AND permission_code = $2
          AND deleted_at IS NULL
        LIMIT 1
        "#,
    )
    .bind(api_key_id)
    .bind(permission_code)
    .fetch_optional(pool)
    .await
}

pub async fn insert_api_key_permission(
    pool: &Pool<Db>,
    api_key_id: i32,
    permission_code: &str,
    rate_limit_per_minute: i32,
    rate_limit_per_hour: i32,
) -> Result<(), Error> {
    sqlx::query(
        r#"
        INSERT INTO local_api_key_permissions (
            api_key_id, permission_code, is_enabled, rate_limit_per_minute, rate_limit_per_hour
        )
        VALUES ($1, $2, TRUE, $3, $4)
        ON CONFLICT (api_key_id, permission_code) DO NOTHING
        "#,
    )
    .bind(api_key_id)
    .bind(permission_code)
    .bind(rate_limit_per_minute)
    .bind(rate_limit_per_hour)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn fetch_permission_definition(
    pool: &Pool<Db>,
    permission_code: &str,
) -> Result<Option<LocalApiPermissionDefinitionDto>, Error> {
    sqlx::query_as::<_, LocalApiPermissionDefinitionDto>(
        r#"
        SELECT
            id, uuid, permission_code, name, description, default_enabled,
            default_rate_limit_per_minute, default_rate_limit_per_hour, sort_order,
            created_at, updated_at, deleted_at
        FROM local_api_permission_definitions
        WHERE permission_code = $1 AND deleted_at IS NULL
        LIMIT 1
        "#,
    )
    .bind(permission_code)
    .fetch_optional(pool)
    .await
}

pub async fn fetch_permission_definitions(
    pool: &Pool<Db>,
) -> Result<Vec<LocalApiPermissionDefinitionDto>, Error> {
    sqlx::query_as::<_, LocalApiPermissionDefinitionDto>(
        r#"
        SELECT
            id, uuid, permission_code, name, description, default_enabled,
            default_rate_limit_per_minute, default_rate_limit_per_hour, sort_order,
            created_at, updated_at, deleted_at
        FROM local_api_permission_definitions
        WHERE deleted_at IS NULL
        ORDER BY sort_order ASC, id ASC
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn reset_api_key_daily_usage(
    pool: &Pool<Db>,
    api_key_id: i32,
    today: chrono::NaiveDate,
) -> Result<(), Error> {
    sqlx::query(
        r#"
        UPDATE local_api_keys
        SET requests_today = 0, last_reset_date = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        "#,
    )
    .bind(api_key_id)
    .bind(today)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn increment_api_key_usage(
    pool: &Pool<Db>,
    api_key_id: i32,
    used_at: DateTime<Utc>,
) -> Result<(), Error> {
    sqlx::query(
        r#"
        UPDATE local_api_keys
        SET requests_today = requests_today + 1, last_used_at = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        "#,
    )
    .bind(api_key_id)
    .bind(used_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn fetch_request_count(
    pool: &Pool<Db>,
    api_key_id: i32,
    permission_code: &str,
    window_type: &str,
    window_start: DateTime<Utc>,
) -> Result<i32, Error> {
    let count = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT request_count
        FROM local_api_request_counters
        WHERE api_key_id = $1
          AND permission_code = $2
          AND window_type = $3
          AND window_start = $4
        LIMIT 1
        "#,
    )
    .bind(api_key_id)
    .bind(permission_code)
    .bind(window_type)
    .bind(window_start)
    .fetch_optional(pool)
    .await?;

    Ok(count.unwrap_or(0))
}

pub async fn increment_request_counter(
    pool: &Pool<Db>,
    api_key_id: i32,
    permission_code: &str,
    window_type: &str,
    window_start: DateTime<Utc>,
) -> Result<(), Error> {
    sqlx::query(
        r#"
        INSERT INTO local_api_request_counters (
            api_key_id, permission_code, window_type, window_start, request_count, updated_at
        )
        VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (api_key_id, permission_code, window_type, window_start) DO UPDATE SET
            request_count = local_api_request_counters.request_count + 1,
            updated_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(api_key_id)
    .bind(permission_code)
    .bind(window_type)
    .bind(window_start)
    .execute(pool)
    .await?;

    Ok(())
}

pub fn build_cors_origins_value(origins: &[String]) -> Value {
    json!(origins)
}

pub fn parse_cors_origins(value: &Value) -> Vec<String> {
    value
        .as_array()
        .map(|items| items.iter().filter_map(|item| item.as_str().map(ToOwned::to_owned)).collect())
        .unwrap_or_default()
}

pub fn hash_api_key(api_key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(api_key.as_bytes());
    hex::encode(hasher.finalize())
}
