use crate::{
    database::{self, DbPool},
    utils::DatabaseConfig,
};

/// Shared resources used by handlers and services.
///
/// MZ指纹浏览器 is a single-user local workbench: there is no user, team or workspace,
/// so the context is just the database pool.
#[derive(Clone)]
pub struct SvcCtx {
    pub db: DbPool,
}

impl SvcCtx {
    pub async fn new(config: &DatabaseConfig) -> Result<Self, anyhow::Error> {
        let db = Self::create_db(config).await?;
        database::migrate(&db).await?;
        crate::secret::encrypt_existing(&db).await?;
        crate::services::browser_kernels::import_default_catalog(&db)
            .await
            .map_err(anyhow::Error::msg)?;
        crate::services::browser_kernels::migrate_legacy_environment_bindings(&db)
            .await
            .map_err(anyhow::Error::msg)?;

        Ok(Self { db })
    }

    pub async fn create_db(config: &DatabaseConfig) -> Result<DbPool, anyhow::Error> {
        database::connect(config).await
    }
}
