use std::str::FromStr;

use sqlx::{
    Sqlite,
    migrate::Migrator,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
};

use crate::utils::DatabaseConfig;

/// Database engine used by the embedded business layer.
pub type Db = Sqlite;
pub type Pool<T = Db> = sqlx::Pool<T>;
pub type DbPool = Pool<Db>;

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Build a numbered placeholder list for a variable-length SQLite `IN` clause.
pub fn placeholders(start: usize, len: usize) -> String {
    (start..start + len)
        .map(|index| format!("${index}"))
        .collect::<Vec<_>>()
        .join(", ")
}

pub async fn connect(config: &DatabaseConfig) -> anyhow::Result<DbPool> {
    let options = SqliteConnectOptions::from_str(&config.url)?
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal);

    let pool = SqlitePoolOptions::new()
        .max_lifetime(std::time::Duration::from_secs(config.max_lifetime))
        .idle_timeout(std::time::Duration::from_secs(config.idle_timeout))
        .acquire_timeout(std::time::Duration::from_secs(config.acquire_timeout))
        .max_connections(config.max_connections)
        .min_connections(config.min_connections)
        .connect_with(options)
        .await?;

    Ok(pool)
}

/// Bring a newly-created or existing embedded database up to the current schema.
///
/// 迁移在一条关闭了外键检查的连接上执行：SQLite 改表结构要"建新表、拷数据、删旧表、改名"，
/// 外键开着时删除父表会触发 `ON DELETE CASCADE` 把子表数据一起删掉。sqlx 会把每条迁移包进事务，
/// 而事务里无法切换外键开关，所以必须在事务开始前关掉。迁移完成后重新打开，并检查外键是否一致。
pub async fn migrate(pool: &DbPool) -> anyhow::Result<()> {
    let mut connection = pool.acquire().await?;
    sqlx::query("PRAGMA foreign_keys = OFF").execute(&mut *connection).await?;
    let result = MIGRATOR.run(&mut *connection).await;
    sqlx::query("PRAGMA foreign_keys = ON").execute(&mut *connection).await?;
    result?;

    let violations: Vec<(String,)> = sqlx::query_as(r#"SELECT "table" FROM pragma_foreign_key_check"#)
        .fetch_all(&mut *connection)
        .await?;
    if !violations.is_empty() {
        // 只提示、不阻止启动：旧数据里可能本来就有悬空的引用，不能因此让软件打不开。
        let mut tables: Vec<String> = violations.into_iter().map(|(table,)| table).collect();
        tables.sort();
        tables.dedup();
        tracing::warn!("database foreign keys are inconsistent after migration: {}", tables.join(", "));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn opens_an_embedded_sqlite_database() {
        let config = DatabaseConfig {
            url: "sqlite::memory:".to_string(),
            max_connections: 1,
            min_connections: 1,
            max_lifetime: 30,
            acquire_timeout: 30,
            idle_timeout: 30,
        };

        let pool = connect(&config).await.expect("SQLite should open");
        sqlx::query("CREATE TABLE health_check (value TEXT NOT NULL)")
            .execute(&pool)
            .await
            .expect("schema should be writable");
        sqlx::query("INSERT INTO health_check (value) VALUES ($1)")
            .bind("ok")
            .execute(&pool)
            .await
            .expect("data should be writable");

        let value: String = sqlx::query_scalar("SELECT value FROM health_check")
            .fetch_one(&pool)
            .await
            .expect("data should be readable");
        assert_eq!(value, "ok");
        assert_eq!(placeholders(3, 3), "$3, $4, $5");
    }

    #[tokio::test]
    async fn applies_all_migrations_to_a_fresh_database() {
        let config = DatabaseConfig {
            url: "sqlite::memory:".to_string(),
            max_connections: 1,
            min_connections: 1,
            max_lifetime: 30,
            acquire_timeout: 30,
            idle_timeout: 30,
        };

        let pool = connect(&config).await.expect("SQLite should open");
        migrate(&pool).await.expect("all embedded migrations should apply");

        let table_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        )
        .fetch_one(&pool)
        .await
        .expect("schema metadata should be readable");
        assert!(table_count > 20, "business tables should be created");
    }

    fn memory_config() -> DatabaseConfig {
        DatabaseConfig {
            url: "sqlite::memory:".to_string(),
            max_connections: 1,
            min_connections: 1,
            max_lifetime: 30,
            acquire_timeout: 30,
            idle_timeout: 30,
        }
    }

    /// 回归：删除用户 / 团队 / 工作空间的迁移必须保留已有的业务数据。
    /// 先按旧结构建好数据（带用户、团队、工作空间归属），再执行最后一条迁移。
    #[tokio::test]
    async fn removing_users_teams_and_workspaces_keeps_existing_business_data() {
        const LAST: i64 = 20261108000001;
        let pool = connect(&memory_config()).await.expect("SQLite should open");

        let older: Vec<_> = MIGRATOR.iter().filter(|m| m.version < LAST).cloned().collect();
        let older_only = Migrator {
            migrations: std::borrow::Cow::Owned(older),
            ..Migrator::DEFAULT
        };
        older_only.run(&pool).await.expect("older migrations should apply");

        let user = uuid::Uuid::new_v4();
        let workspace = uuid::Uuid::new_v4();
        let team = uuid::Uuid::new_v4();
        let group = uuid::Uuid::new_v4();
        let proxy = uuid::Uuid::new_v4();
        let environment = uuid::Uuid::new_v4();
        let statements: Vec<(&str, Vec<uuid::Uuid>)> = vec![
            ("INSERT INTO users (uuid, id) VALUES ($1, 'LOCAL')", vec![user]),
            (
                "INSERT INTO user_infos (user_uuid, email, password) VALUES ($1, 'a@b.invalid', '')",
                vec![user],
            ),
            ("INSERT INTO workspaces (uuid, name, owner_uuid) VALUES ($1, 'W', $2)", vec![workspace, user]),
            (
                "INSERT INTO teams (uuid, name, owner_uuid, workspace_uuid) VALUES ($1, 'T', $2, $3)",
                vec![team, user, workspace],
            ),
            (
                "INSERT INTO groups (uuid, name, team_uuid, workspace_uuid, created_by) VALUES ($1, 'G', $2, $3, $4)",
                vec![group, team, workspace, user],
            ),
            (
                "INSERT INTO proxies (uuid, name, host, port, workspace_uuid, owner_uuid, user_uuid) VALUES ($1, 'P', '127.0.0.1', 8080, $2, $3, $3)",
                vec![proxy, workspace, user],
            ),
            (
                "INSERT INTO environments (uuid, name, user_uuid, team_uuid, workspace_uuid, group_uuid, proxy_uuid) VALUES ($1, 'Env', $2, $3, $4, $5, $6)",
                vec![environment, user, team, workspace, group, proxy],
            ),
        ];
        for (sql, binds) in statements {
            let mut query = sqlx::query(sql);
            for value in binds {
                query = query.bind(value);
            }
            query.execute(&pool).await.unwrap_or_else(|error| panic!("{sql}: {error}"));
        }
        sqlx::query("INSERT INTO environment_configs (environment_uuid) VALUES ($1)")
            .bind(environment)
            .execute(&pool)
            .await
            .expect("config row should be inserted");

        migrate(&pool).await.expect("the removal migration should apply");

        // 业务数据原样保留，关联仍然有效
        let (name, group_uuid, proxy_uuid): (String, uuid::Uuid, uuid::Uuid) =
            sqlx::query_as("SELECT name, group_uuid, proxy_uuid FROM environments WHERE uuid = $1")
                .bind(environment)
                .fetch_one(&pool)
                .await
                .expect("environment should survive");
        assert_eq!((name.as_str(), group_uuid, proxy_uuid), ("Env", group, proxy));
        let configs: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM environment_configs WHERE environment_uuid = $1")
                .bind(environment)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(configs, 1, "child rows must not be cascaded away by the table rebuild");

        // 归属列和相关表都不在了
        for table in [
            "users",
            "user_infos",
            "workspaces",
            "teams",
            "team_members",
            "workspace_quotas",
            "messages",
            "audit_logs",
        ] {
            let exists: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $1")
                    .bind(table)
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            assert_eq!(exists, 0, "{table} should be gone");
        }
        for table in ["environments", "groups", "tags", "proxies", "platform_accounts", "rpa_tasks", "templates"] {
            let columns: Vec<String> =
                sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}')"))
                    .fetch_all(&pool)
                    .await
                    .unwrap();
            for owner in ["user_uuid", "team_uuid", "workspace_uuid", "owner_uuid", "created_by"] {
                assert!(!columns.iter().any(|c| c == owner), "{table}.{owner} should be gone");
            }
        }
        let violations: Vec<(String,)> =
            sqlx::query_as(r#"SELECT "table" FROM pragma_foreign_key_check"#).fetch_all(&pool).await.unwrap();
        assert!(violations.is_empty(), "foreign keys must stay consistent: {violations:?}");
        let foreign_keys: i64 = sqlx::query_scalar("PRAGMA foreign_keys").fetch_one(&pool).await.unwrap();
        assert_eq!(foreign_keys, 1, "foreign keys must be switched back on");
    }

    /// 回归：改名迁移要下架改名前的内核、解除绑定并清掉环境配置里的旧内核 id，新内核不受影响。
    #[tokio::test]
    async fn pre_rename_kernels_are_retired_and_unbound() {
        const LAST: i64 = 20261109000001;
        let pool = connect(&memory_config()).await.expect("SQLite should open");
        let older: Vec<_> = MIGRATOR.iter().filter(|m| m.version < LAST).cloned().collect();
        Migrator { migrations: std::borrow::Cow::Owned(older), ..Migrator::DEFAULT }
            .run(&pool)
            .await
            .expect("older migrations should apply");

        for (id, type_code, name) in [("old-kernel", "LEGACY_KERNEL_CHROMIUM", "Chrome 156"), ("new-kernel", "MZ_KERNEL_CHROMIUM", "Chrome 157")] {
            sqlx::query(
                "INSERT INTO browser_kernel_artifacts (kernel_id, type_code, resource_name, version, platform, \
                 package_hash, executable_signature, arch, package_format) \
                 VALUES ($1, $2, $3, '1', 'windows', 'h', 's', 'x86_64', 'zip')",
            )
            .bind(id)
            .bind(type_code)
            .bind(name)
            .execute(&pool)
            .await
            .unwrap();
        }
        let old_env = uuid::Uuid::new_v4();
        let new_env = uuid::Uuid::new_v4();
        for (env, kernel) in [(old_env, "old-kernel"), (new_env, "new-kernel")] {
            sqlx::query("INSERT INTO environments (uuid, name) VALUES ($1, 'E')").bind(env).execute(&pool).await.unwrap();
            sqlx::query("INSERT INTO environment_configs (environment_uuid, window_info) VALUES ($1, $2)")
                .bind(env)
                .bind(format!(r#"{{"kernel":"Chrome 156","kernel_id":"{kernel}"}}"#))
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query("INSERT INTO environment_kernel_bindings (environment_uuid, kernel_id) VALUES ($1, $2)")
                .bind(env)
                .bind(kernel)
                .execute(&pool)
                .await
                .unwrap();
        }

        MIGRATOR.run(&pool).await.expect("the kernel migration should apply");

        let status = |id: &'static str| {
            let pool = pool.clone();
            async move {
                sqlx::query_scalar::<_, String>("SELECT status FROM browser_kernel_artifacts WHERE kernel_id = $1")
                    .bind(id)
                    .fetch_one(&pool)
                    .await
                    .unwrap()
            }
        };
        assert_eq!(status("old-kernel").await, "retired");
        assert_eq!(status("new-kernel").await, "active");

        let bound: Vec<String> = sqlx::query_scalar("SELECT kernel_id FROM environment_kernel_bindings")
            .fetch_all(&pool)
            .await
            .unwrap();
        assert_eq!(bound, ["new-kernel"], "only the binding to the old kernel is removed");

        let window_info = |env: uuid::Uuid| {
            let pool = pool.clone();
            async move {
                sqlx::query_scalar::<_, String>("SELECT window_info FROM environment_configs WHERE environment_uuid = $1")
                    .bind(env)
                    .fetch_one(&pool)
                    .await
                    .unwrap()
            }
        };
        let old_info: serde_json::Value = serde_json::from_str(&window_info(old_env).await).unwrap();
        assert!(old_info.get("kernel_id").is_none(), "the stale kernel id is cleared");
        assert_eq!(old_info["kernel"], "Chrome 156", "the kernel name stays so it can be re-bound by name");
        let new_info: serde_json::Value = serde_json::from_str(&window_info(new_env).await).unwrap();
        assert_eq!(new_info["kernel_id"], "new-kernel");
    }

    #[tokio::test]
    async fn core_models_round_trip_on_sqlite() {
        use crate::models::{environments, proxies};

        let context = crate::svc_ctx::SvcCtx::new(&memory_config())
            .await
            .expect("business context should initialize");
        let pool = &context.db;

        let group_uuid =
            environments::insert_group(pool, "Default", None).await.expect("group should be created");
        let tag_uuid = environments::insert_tag(pool, "QA", Some("blue"))
            .await
            .expect("tag should be created");
        assert!(environments::fetch_group_by_uuid(pool, group_uuid).await.unwrap().is_some());
        assert!(environments::fetch_tag_by_uuid(pool, tag_uuid).await.unwrap().is_some());

        let proxy_uuid = proxies::insert_proxy(
            pool,
            "Local Proxy",
            "127.0.0.1",
            8080,
            "http",
            None,
            Some("secret"),
            None,
            None,
        )
        .await
        .expect("proxy should be created");
        let proxy = proxies::fetch_proxy_by_uuid(pool, proxy_uuid)
            .await
            .expect("proxy query should succeed")
            .expect("proxy should exist");
        assert_eq!(proxy.password.as_deref(), Some("secret"));

        let environment_uuid = environments::insert_environment(
            pool,
            "Browser A",
            None,
            Some(group_uuid),
            Some(proxy_uuid),
            Some("Windows"),
            Some("Chromium"),
        )
        .await
        .expect("environment should be created");
        let environment = environments::fetch_environment_by_uuid(pool, environment_uuid)
            .await
            .expect("environment query should succeed")
            .expect("environment should exist");
        assert_eq!(environment.name, "Browser A");
        assert_eq!(environment.proxy_uuid, Some(proxy_uuid));
        assert_eq!(proxies::fetch_proxies_count(pool, None, None, None, None).await.unwrap(), 1);
    }
}
