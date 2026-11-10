use std::{collections::BTreeMap, path::Path, sync::OnceLock};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use uuid::Uuid;

use crate::database::DbPool;

const DEFAULT_BROWSER_KERNELS_JSON: &str =
    include_str!("../../resources/default-browser-kernels.json");
const SUPPORTED_SCHEMA_VERSION: u32 = 1;
const KERNEL_TYPE_PREFIX: &str = "MZ_KERNEL_";

#[derive(Debug, Clone, Deserialize, Serialize, FromRow, PartialEq, Eq)]
pub struct BrowserKernelVersion {
    pub kernel_id: String,
    pub type_code: String,
    pub resource_name: String,
    pub install_dir_name: String,
    pub version: String,
    pub name: Option<String>,
    pub notes: Option<String>,
    pub platform: String,
    pub url: Option<String>,
    pub hash: String,
    pub signature: String,
    pub compatible_signatures: sqlx::types::Json<Vec<String>>,
    pub file_size: Option<i32>,
    pub is_latest: bool,
    pub status: String,
    pub arch: String,
    pub package_format: String,
    pub requires_extract: bool,
    pub entrypoint_template: Option<String>,
    pub extract_root: Option<String>,
    /// 这个内核的安装目录里装着内核（各版本共用一个目录，按目录判断，不按 kernel_id）
    pub installed: bool,
    /// 目录里实际装着的内核签名（最近一次安装或校验时记下的）
    pub installed_signature: Option<String>,
    /// 目录里装的不是清单里的这个版本：有新版本可以更新（由用户在设置里手动更新，启动环境不强制）
    pub update_available: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct BrowserKernelRecord {
    type_code: String,
    resource_name: String,
    #[serde(default)]
    install_dir_name: Option<String>,
    version: String,
    name: Option<String>,
    notes: Option<String>,
    platform: String,
    url: String,
    #[serde(default = "default_source_priority")]
    priority: i32,
    hash: String,
    signature: String,
    #[serde(default)]
    compatible_signatures: Vec<String>,
    file_size: Option<i32>,
    #[serde(default)]
    is_latest: bool,
    #[serde(default = "active_status")]
    status: String,
    arch: String,
    package_format: String,
    #[serde(default)]
    requires_extract: bool,
    entrypoint_template: Option<String>,
    extract_root: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct BrowserKernelCatalog {
    schema_version: u32,
    source_id: String,
    kernels: Vec<BrowserKernelRecord>,
}

#[derive(Serialize)]
struct BrowserKernelIdentity<'a> {
    type_code: &'a str,
    platform: &'a str,
    arch: &'a str,
    package_hash: &'a str,
    executable_signature: &'a str,
    package_format: &'a str,
    requires_extract: bool,
    entrypoint_template: Option<&'a str>,
    extract_root: Option<&'a str>,
}

static DEFAULT_CATALOG: OnceLock<Result<BrowserKernelCatalog, String>> = OnceLock::new();

fn active_status() -> String {
    "active".to_string()
}

fn default_source_priority() -> i32 {
    100
}

fn normalize_required(value: &str, field: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        Err(format!("Browser kernel field {field} cannot be empty"))
    } else {
        Ok(value.to_string())
    }
}

fn kernel_id(record: &BrowserKernelRecord) -> Result<String, String> {
    let identity = BrowserKernelIdentity {
        type_code: record.type_code.trim(),
        platform: record.platform.trim(),
        arch: record.arch.trim(),
        package_hash: record.hash.trim(),
        executable_signature: record.signature.trim(),
        package_format: record.package_format.trim(),
        requires_extract: record.requires_extract,
        entrypoint_template: record.entrypoint_template.as_deref().map(str::trim),
        extract_root: record.extract_root.as_deref().map(str::trim),
    };
    let canonical = serde_json::to_vec(&identity)
        .map_err(|error| format!("Failed to serialize browser kernel identity: {error}"))?;
    Ok(hex::encode(Sha256::digest(canonical)))
}

fn validate_catalog(catalog: BrowserKernelCatalog) -> Result<BrowserKernelCatalog, String> {
    if catalog.schema_version != SUPPORTED_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported default browser kernel catalog schema version: {}",
            catalog.schema_version
        ));
    }
    normalize_required(&catalog.source_id, "source_id")?;
    if catalog.kernels.is_empty() {
        return Err("The default browser kernel catalog is empty".to_string());
    }

    for record in &catalog.kernels {
        if !record.type_code.starts_with(KERNEL_TYPE_PREFIX) {
            return Err(format!(
                "Invalid browser kernel type code: {}",
                record.type_code
            ));
        }
        normalize_required(&record.resource_name, "resource_name")?;
        if let Some(install_dir_name) = &record.install_dir_name {
            normalize_required(install_dir_name, "install_dir_name")?;
        }
        normalize_required(&record.version, "version")?;
        normalize_required(&record.platform, "platform")?;
        normalize_required(&record.url, "url")?;
        normalize_required(&record.hash, "hash")?;
        normalize_required(&record.signature, "signature")?;
        for signature in &record.compatible_signatures {
            let signature = normalize_required(signature, "compatible_signatures")?;
            if signature.len() != 64 || !signature.bytes().all(|byte| byte.is_ascii_hexdigit()) {
                return Err(format!(
                    "Invalid compatible browser kernel signature: {signature}"
                ));
            }
        }
        normalize_required(&record.arch, "arch")?;
        normalize_required(&record.package_format, "package_format")?;
        kernel_id(record)?;
    }

    Ok(catalog)
}

fn parse_catalog(contents: &str, source_label: &str) -> Result<BrowserKernelCatalog, String> {
    let catalog: BrowserKernelCatalog = serde_json::from_str(contents).map_err(|error| {
        format!("Failed to parse browser kernel catalog {source_label}: {error}")
    })?;
    validate_catalog(catalog)
}

fn parse_default_catalog() -> Result<BrowserKernelCatalog, String> {
    parse_catalog(DEFAULT_BROWSER_KERNELS_JSON, "mz-builtin")
}

fn default_catalog() -> Result<&'static BrowserKernelCatalog, String> {
    DEFAULT_CATALOG
        .get_or_init(parse_default_catalog)
        .as_ref()
        .map_err(Clone::clone)
}

async fn import_catalog(pool: &DbPool, catalog: &BrowserKernelCatalog) -> Result<usize, String> {
    let mut tx = pool.begin().await.map_err(|error| error.to_string())?;

    for record in &catalog.kernels {
        let kernel_id = kernel_id(record)?;
        sqlx::query(
            r#"
            INSERT INTO browser_kernel_artifacts (
                kernel_id, type_code, resource_name, install_dir_name, version, name, notes, platform,
                package_hash, executable_signature, compatible_executable_signatures,
                file_size, is_latest, status,
                arch, package_format, requires_extract, entrypoint_template, extract_root
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT (kernel_id) DO UPDATE SET
                resource_name = excluded.resource_name,
                version = excluded.version,
                name = excluded.name,
                notes = excluded.notes,
                compatible_executable_signatures = excluded.compatible_executable_signatures,
                file_size = excluded.file_size,
                is_latest = excluded.is_latest,
                status = excluded.status,
                updated_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(&kernel_id)
        .bind(record.type_code.trim())
        .bind(record.resource_name.trim())
        .bind(
            record
                .install_dir_name
                .as_deref()
                .map(str::trim)
                .unwrap_or_else(|| record.resource_name.trim()),
        )
        .bind(record.version.trim())
        .bind(record.name.as_deref().map(str::trim))
        .bind(record.notes.as_deref().map(str::trim))
        .bind(record.platform.trim())
        .bind(record.hash.trim())
        .bind(record.signature.trim())
        .bind(sqlx::types::Json(&record.compatible_signatures))
        .bind(record.file_size)
        .bind(record.is_latest)
        .bind(record.status.trim())
        .bind(record.arch.trim())
        .bind(record.package_format.trim())
        .bind(record.requires_extract)
        .bind(record.entrypoint_template.as_deref().map(str::trim))
        .bind(record.extract_root.as_deref().map(str::trim))
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;

        sqlx::query(
            "UPDATE browser_kernel_sources SET is_active = 0 \
             WHERE kernel_id = $1 AND source_id = $2",
        )
        .bind(&kernel_id)
        .bind(catalog.source_id.trim())
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;

        sqlx::query(
            r#"
            INSERT INTO browser_kernel_sources (kernel_id, source_id, url, priority)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (kernel_id, source_id, url) DO UPDATE SET
                is_active = 1,
                priority = excluded.priority,
                last_seen_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(&kernel_id)
        .bind(catalog.source_id.trim())
        .bind(record.url.trim())
        .bind(record.priority)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    }

    retire_unlisted_kernels(&mut tx, catalog).await?;
    rebind_superseded_kernels(&mut tx).await?;

    tx.commit().await.map_err(|error| error.to_string())?;
    Ok(catalog.kernels.len())
}

/// A retired kernel that shares its install directory with an active one has been superseded by a
/// rebuild (for example the mz1 and mz2 packages of Chrome 156). Only one of them can occupy that
/// directory, so environments and templates still pointing at the old build move to the new one.
/// Retired kernels without a successor keep their bindings.
async fn rebind_superseded_kernels(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), String> {
    let superseded: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT old.kernel_id, (
            SELECT new.kernel_id FROM browser_kernel_artifacts new
            WHERE new.status = 'active'
              AND new.type_code = old.type_code
              AND new.platform = old.platform
              AND new.arch = old.arch
              AND COALESCE(new.install_dir_name, new.resource_name)
                  = COALESCE(old.install_dir_name, old.resource_name)
            ORDER BY new.is_latest DESC, new.version DESC
            LIMIT 1
        ) AS successor
        FROM browser_kernel_artifacts old
        WHERE old.status = 'retired' AND successor IS NOT NULL
        "#,
    )
    .fetch_all(&mut **tx)
    .await
    .map_err(|error| error.to_string())?;

    for (old_id, new_id) in superseded {
        sqlx::query(
            "UPDATE environment_kernel_bindings SET kernel_id = $1, updated_at = CURRENT_TIMESTAMP \
             WHERE kernel_id = $2",
        )
        .bind(&new_id)
        .bind(&old_id)
        .execute(&mut **tx)
        .await
        .map_err(|error| error.to_string())?;
        sqlx::query(
            "UPDATE environment_configs SET window_info = json_set(window_info, '$.kernel_id', $1) \
             WHERE json_valid(window_info) AND json_extract(window_info, '$.kernel_id') = $2",
        )
        .bind(&new_id)
        .bind(&old_id)
        .execute(&mut **tx)
        .await
        .map_err(|error| error.to_string())?;
        sqlx::query(
            "UPDATE templates SET config_json = json_set(config_json, '$.config.window_info.kernel_id', $1) \
             WHERE json_valid(config_json) AND json_extract(config_json, '$.config.window_info.kernel_id') = $2",
        )
        .bind(&new_id)
        .bind(&old_id)
        .execute(&mut **tx)
        .await
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// A kernel that this source used to list but no longer does (for example Chrome 144 after the
/// bundled catalog moved to 156) stops being offered. Its row, install record and source URLs
/// stay, so environments still bound to it keep launching; see `rebind_superseded_kernels` for
/// the case where a rebuild replaces it.
async fn retire_unlisted_kernels(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    catalog: &BrowserKernelCatalog,
) -> Result<(), String> {
    let source_id = catalog.source_id.trim();
    let listed = catalog
        .kernels
        .iter()
        .map(kernel_id)
        .collect::<Result<Vec<_>, _>>()?;
    let known: Vec<String> =
        sqlx::query_scalar("SELECT DISTINCT kernel_id FROM browser_kernel_sources WHERE source_id = $1")
            .bind(source_id)
            .fetch_all(&mut **tx)
            .await
            .map_err(|error| error.to_string())?;

    for kernel_id in known.into_iter().filter(|id| !listed.contains(id)) {
        sqlx::query(
            "UPDATE browser_kernel_sources SET is_active = 0 WHERE kernel_id = $1 AND source_id = $2",
        )
        .bind(&kernel_id)
        .bind(source_id)
        .execute(&mut **tx)
        .await
        .map_err(|error| error.to_string())?;
        sqlx::query(
            r#"
            UPDATE browser_kernel_artifacts SET status = 'retired', updated_at = CURRENT_TIMESTAMP
            WHERE kernel_id = $1 AND status = 'active'
              AND NOT EXISTS (
                SELECT 1 FROM browser_kernel_sources other
                WHERE other.kernel_id = $1 AND other.is_active = 1
              )
            "#,
        )
        .bind(&kernel_id)
        .execute(&mut **tx)
        .await
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Import the bundled manifest into the runtime registry. The content-derived
/// kernel identity is never replaced when a manifest record changes; environment
/// bindings only move when a rebuild takes over the same install directory.
pub async fn import_default_catalog(pool: &DbPool) -> Result<usize, String> {
    import_catalog(pool, default_catalog()?).await
}

/// Import an optional user-maintained catalog with exactly the same rules as
/// the bundled catalog. Missing files are intentionally treated as no input.
pub async fn import_catalog_file(pool: &DbPool, path: &Path) -> Result<usize, String> {
    if !path.exists() {
        return Ok(0);
    }
    let contents = std::fs::read_to_string(path).map_err(|error| {
        format!(
            "Failed to read browser kernel catalog {}: {error}",
            path.display()
        )
    })?;
    let catalog = parse_catalog(&contents, &path.display().to_string())?;
    import_catalog(pool, &catalog).await
}

const KERNEL_SELECT: &str = r#"
    SELECT
        a.kernel_id,
        a.type_code,
        a.resource_name,
        COALESCE(a.install_dir_name, a.resource_name) AS install_dir_name,
        a.version,
        a.name,
        a.notes,
        a.platform,
        (
            SELECT source.url
            FROM browser_kernel_sources source
            WHERE source.kernel_id = a.kernel_id AND (source.is_active = 1 OR a.status = 'retired')
            ORDER BY source.is_active DESC, source.priority ASC, source.id ASC
            LIMIT 1
        ) AS url,
        a.package_hash AS hash,
        a.executable_signature AS signature,
        a.compatible_executable_signatures AS compatible_signatures,
        a.file_size,
        a.is_latest,
        a.status,
        a.arch,
        a.package_format,
        a.requires_extract,
        a.entrypoint_template,
        a.extract_root,
        EXISTS (
            SELECT 1 FROM browser_kernel_installations installation
            JOIN browser_kernel_artifacts installed_artifact
                ON installed_artifact.kernel_id = installation.kernel_id
            WHERE installation.status = 'ready'
              AND COALESCE(installed_artifact.install_dir_name, installed_artifact.resource_name)
                  = COALESCE(a.install_dir_name, a.resource_name)
        ) AS installed,
        (
            SELECT installation.verified_signature FROM browser_kernel_installations installation
            JOIN browser_kernel_artifacts installed_artifact
                ON installed_artifact.kernel_id = installation.kernel_id
            WHERE installation.status = 'ready'
              AND COALESCE(installed_artifact.install_dir_name, installed_artifact.resource_name)
                  = COALESCE(a.install_dir_name, a.resource_name)
            ORDER BY installation.updated_at DESC, installation.verified_at DESC
            LIMIT 1
        ) AS installed_signature,
        COALESCE((
            SELECT lower(trim(installation.verified_signature)) <> lower(trim(a.executable_signature))
            FROM browser_kernel_installations installation
            JOIN browser_kernel_artifacts installed_artifact
                ON installed_artifact.kernel_id = installation.kernel_id
            WHERE installation.status = 'ready'
              AND COALESCE(installed_artifact.install_dir_name, installed_artifact.resource_name)
                  = COALESCE(a.install_dir_name, a.resource_name)
              AND COALESCE(trim(installation.verified_signature), '') <> ''
            ORDER BY installation.updated_at DESC, installation.verified_at DESC
            LIMIT 1
        ), 0) AS update_available
    FROM browser_kernel_artifacts a
"#;

pub async fn list_browser_kernels(
    pool: &DbPool,
    platform: Option<&str>,
    type_code: Option<&str>,
) -> Result<BTreeMap<String, Vec<BrowserKernelVersion>>, String> {
    let platform = platform.map(str::trim).filter(|value| !value.is_empty());
    let type_code = type_code.map(str::trim).filter(|value| !value.is_empty());
    let rows = sqlx::query_as::<_, BrowserKernelVersion>(&format!(
        "{KERNEL_SELECT} WHERE a.status = 'active' ORDER BY a.is_latest DESC, a.version DESC"
    ))
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;
    let mut groups = BTreeMap::<String, Vec<BrowserKernelVersion>>::new();

    for row in rows {
        if platform.is_some_and(|value| !row.platform.eq_ignore_ascii_case(value)) {
            continue;
        }
        if type_code.is_some_and(|value| row.type_code != value) {
            continue;
        }
        if type_code.is_none() && !row.type_code.starts_with(KERNEL_TYPE_PREFIX) {
            continue;
        }
        groups.entry(row.type_code.clone()).or_default().push(row);
    }

    Ok(groups)
}

pub async fn get_browser_kernel(
    pool: &DbPool,
    kernel_id: &str,
) -> Result<Option<BrowserKernelVersion>, String> {
    sqlx::query_as::<_, BrowserKernelVersion>(&format!(
        "{KERNEL_SELECT} WHERE a.kernel_id = $1 LIMIT 1"
    ))
    .bind(kernel_id.trim())
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn find_browser_kernel_by_name(
    pool: &DbPool,
    resource_name: &str,
) -> Result<Option<BrowserKernelVersion>, String> {
    sqlx::query_as::<_, BrowserKernelVersion>(&format!(
        "{KERNEL_SELECT} WHERE a.resource_name = $1 AND a.status = 'active' \
         ORDER BY a.is_latest DESC, a.version DESC LIMIT 1"
    ))
    .bind(resource_name.trim())
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn default_browser_kernel(pool: &DbPool) -> Result<Option<BrowserKernelVersion>, String> {
    sqlx::query_as::<_, BrowserKernelVersion>(&format!(
        "{KERNEL_SELECT} WHERE a.type_code = 'MZ_KERNEL_CHROMIUM' \
         AND a.status = 'active' ORDER BY a.is_latest DESC, a.version DESC LIMIT 1"
    ))
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn bind_environment_kernel(
    pool: &DbPool,
    environment_uuid: Uuid,
    kernel_id: &str,
) -> Result<(), String> {
    if get_browser_kernel(pool, kernel_id).await?.is_none() {
        return Err(format!(
            "Browser kernel does not exist: {}",
            kernel_id.trim()
        ));
    }
    sqlx::query(
        r#"
        INSERT INTO environment_kernel_bindings (environment_uuid, kernel_id)
        VALUES ($1, $2)
        ON CONFLICT (environment_uuid) DO UPDATE SET
            kernel_id = excluded.kernel_id,
            updated_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(environment_uuid)
    .bind(kernel_id.trim())
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub async fn get_environment_kernel(
    pool: &DbPool,
    environment_uuid: Uuid,
) -> Result<Option<BrowserKernelVersion>, String> {
    sqlx::query_as::<_, BrowserKernelVersion>(&format!(
        "{KERNEL_SELECT} INNER JOIN environment_kernel_bindings binding \
         ON binding.kernel_id = a.kernel_id WHERE binding.environment_uuid = $1 LIMIT 1"
    ))
    .bind(environment_uuid)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn resolve_requested_kernel(
    pool: &DbPool,
    window_info: &serde_json::Value,
    allow_default: bool,
) -> Result<BrowserKernelVersion, String> {
    if let Some(kernel_id) = window_info
        .get("kernel_id")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return get_browser_kernel(pool, kernel_id)
            .await?
            .ok_or_else(|| format!("Browser kernel does not exist: {kernel_id}"));
    }
    if let Some(resource_name) = window_info
        .get("kernel")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty() && !value.eq_ignore_ascii_case("chrome"))
    {
        if let Some(kernel) = find_browser_kernel_by_name(pool, resource_name).await? {
            return Ok(kernel);
        }
    }
    if allow_default {
        if let Some(kernel) = default_browser_kernel(pool).await? {
            return Ok(kernel);
        }
    }
    Err("This environment has no valid browser kernel binding".to_string())
}

pub async fn migrate_legacy_environment_bindings(pool: &DbPool) -> Result<u64, String> {
    let rows = sqlx::query_as::<_, (Uuid, String)>(
        r#"
        SELECT config.environment_uuid, config.window_info
        FROM environment_configs config
        LEFT JOIN environment_kernel_bindings binding
            ON binding.environment_uuid = config.environment_uuid
        WHERE binding.environment_uuid IS NULL
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;
    let mut migrated = 0;

    for (environment_uuid, raw_window_info) in rows {
        let mut window_info: serde_json::Value = match serde_json::from_str(&raw_window_info) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let kernel = match resolve_requested_kernel(pool, &window_info, false).await {
            Ok(kernel) => kernel,
            Err(_) => continue,
        };
        bind_environment_kernel(pool, environment_uuid, &kernel.kernel_id).await?;
        if let Some(object) = window_info.as_object_mut() {
            object.insert(
                "kernel_id".to_string(),
                serde_json::Value::String(kernel.kernel_id),
            );
            sqlx::query(
                "UPDATE environment_configs SET window_info = $1, updated_at = CURRENT_TIMESTAMP \
                 WHERE environment_uuid = $2",
            )
            .bind(window_info)
            .bind(environment_uuid)
            .execute(pool)
            .await
            .map_err(|error| error.to_string())?;
        }
        migrated += 1;
    }

    Ok(migrated)
}

/// 安装目录里当前装着的内核签名（同一目录下最近一次的安装/校验记录）；没有记录时为 None
pub async fn installed_signature_for_dir(
    pool: &DbPool,
    install_dir_name: &str,
) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, Option<String>>(
        r#"
        SELECT installation.verified_signature
        FROM browser_kernel_installations installation
        JOIN browser_kernel_artifacts a ON a.kernel_id = installation.kernel_id
        WHERE installation.status = 'ready'
          AND COALESCE(a.install_dir_name, a.resource_name) = $1
        ORDER BY installation.updated_at DESC, installation.verified_at DESC
        LIMIT 1
        "#,
    )
    .bind(install_dir_name.trim())
    .fetch_optional(pool)
    .await
    .map(Option::flatten)
    .map(|signature| signature.filter(|value| !value.trim().is_empty()))
    .map_err(|error| error.to_string())
}

pub async fn record_kernel_installation(
    pool: &DbPool,
    kernel_id: &str,
    install_path: &str,
    verified_signature: &str,
) -> Result<(), String> {
    if get_browser_kernel(pool, kernel_id).await?.is_none() {
        return Ok(());
    }
    sqlx::query(
        r#"
        INSERT INTO browser_kernel_installations (
            kernel_id, install_path, verified_signature, status, verified_at
        ) VALUES ($1, $2, $3, 'ready', CURRENT_TIMESTAMP)
        ON CONFLICT (kernel_id) DO UPDATE SET
            install_path = excluded.install_path,
            verified_signature = excluded.verified_signature,
            status = 'ready',
            verified_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(kernel_id.trim())
    .bind(install_path)
    .bind(verified_signature.trim())
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{database, utils::DatabaseConfig};

    async fn test_pool() -> DbPool {
        let mut config = DatabaseConfig::embedded("sqlite::memory:");
        config.max_connections = 1;
        config.min_connections = 1;
        let pool = database::connect(&config).await.unwrap();
        database::migrate(&pool).await.unwrap();
        pool
    }

    #[test]
    fn content_identity_ignores_display_and_download_location() {
        let catalog = parse_default_catalog().unwrap();
        let mut changed = catalog.kernels[0].clone();
        let original_id = kernel_id(&changed).unwrap();
        changed.resource_name = "Renamed kernel".to_string();
        changed.url = "https://example.invalid/mirror.zip".to_string();
        assert_eq!(kernel_id(&changed).unwrap(), original_id);

        changed.hash = "different-package-hash".to_string();
        assert_ne!(kernel_id(&changed).unwrap(), original_id);
    }

    #[tokio::test]
    async fn imports_and_queries_the_bundled_catalog() {
        let pool = test_pool().await;
        import_default_catalog(&pool).await.unwrap();
        import_default_catalog(&pool).await.unwrap();

        let groups = list_browser_kernels(&pool, Some("windows"), Some("MZ_KERNEL_CHROMIUM"))
            .await
            .unwrap();
        let kernels = &groups["MZ_KERNEL_CHROMIUM"];
        let bundled_chromium = parse_default_catalog()
            .unwrap()
            .kernels
            .iter()
            .filter(|kernel| kernel.type_code == "MZ_KERNEL_CHROMIUM")
            .count();
        assert_eq!(kernels.len(), bundled_chromium, "catalog import must be idempotent");
        let first = &parse_default_catalog().unwrap().kernels[0];
        assert_eq!(kernels[0].resource_name, first.resource_name);
        assert_eq!(kernels[0].install_dir_name, first.install_dir_name.clone().unwrap());
        assert_eq!(kernels[0].kernel_id.len(), 64);
        assert_eq!(
            kernels[0].compatible_signatures.len(),
            parse_default_catalog().unwrap().kernels[0].compatible_signatures.len()
        );
        assert!(kernels[0]
            .url
            .as_deref()
            .unwrap()
            .starts_with("https://github.com/mouzhai163/browser-kernel/releases/download/"));

        // Firefox 内核单独成组，不会混进 Chromium 的列表，也不会成为默认内核
        let firefox = list_browser_kernels(&pool, Some("windows"), Some("MZ_KERNEL_FIREFOX"))
            .await
            .unwrap();
        let firefox = &firefox["MZ_KERNEL_FIREFOX"];
        assert_eq!(firefox.len(), 1);
        assert_eq!(firefox[0].install_dir_name, "Firefox 158");
        assert_eq!(firefox[0].signature.len(), 64);
        // 和 Chromium 一样从我们自己的 Release 下载（只含 Windows 字体的重新打包）
        assert!(firefox[0]
            .url
            .as_deref()
            .unwrap()
            .starts_with("https://github.com/mouzhai163/browser-kernel/releases/download/firefox-"));
        assert_eq!(
            default_browser_kernel(&pool).await.unwrap().unwrap().type_code,
            "MZ_KERNEL_CHROMIUM"
        );
    }

    #[tokio::test]
    async fn kernels_dropped_from_a_catalog_are_retired_but_stay_resolvable() {
        let pool = test_pool().await;
        let mut old = parse_default_catalog().unwrap();
        old.kernels[0].hash = "1".repeat(64);
        old.kernels[0].resource_name = "Chrome 144".to_string();
        import_catalog(&pool, &old).await.unwrap();
        let old_id = kernel_id(&old.kernels[0]).unwrap();

        import_default_catalog(&pool).await.unwrap();

        let groups = list_browser_kernels(&pool, Some("windows"), Some("MZ_KERNEL_CHROMIUM"))
            .await
            .unwrap();
        let names: Vec<_> = groups["MZ_KERNEL_CHROMIUM"]
            .iter()
            .map(|kernel| kernel.resource_name.as_str())
            .collect();
        let bundled: Vec<String> = parse_default_catalog()
            .unwrap()
            .kernels
            .into_iter()
            .filter(|kernel| kernel.type_code == "MZ_KERNEL_CHROMIUM")
            .map(|kernel| kernel.resource_name)
            .collect();
        assert_eq!(
            names,
            bundled,
            "the dropped kernel must not be offered any more"
        );
        let still_there = get_browser_kernel(&pool, &old_id).await.unwrap().unwrap();
        assert_eq!(still_there.status, "retired");
        assert!(
            still_there.url.is_some(),
            "a retired kernel can still be downloaded by the environments bound to it"
        );

        // listed again later: offered again
        import_catalog(&pool, &old).await.unwrap();
        let again = get_browser_kernel(&pool, &old_id).await.unwrap().unwrap();
        assert_eq!(again.status, "active");
    }

    #[tokio::test]
    async fn a_rebuild_takes_over_the_environments_of_the_build_it_replaces() {
        let mut config = DatabaseConfig::embedded("sqlite::memory:");
        config.max_connections = 1;
        config.min_connections = 1;
        let context = crate::svc_ctx::SvcCtx::new(&config).await.unwrap();

        // 上一版的 Chrome 156：同一个安装目录，不同的包
        let mut previous = parse_default_catalog().unwrap();
        previous.kernels[0].hash = "1".repeat(64);
        import_catalog(&context.db, &previous).await.unwrap();
        let old_id = kernel_id(&previous.kernels[0]).unwrap();
        // 目录里已经没有的版本（没有接替者）
        let mut dropped = parse_default_catalog().unwrap();
        dropped.kernels[0].hash = "2".repeat(64);
        dropped.kernels[0].resource_name = "Chrome 144".to_string();
        dropped.kernels[0].install_dir_name = Some("Chrome 144".to_string());
        import_catalog(&context.db, &dropped).await.unwrap();
        let dropped_id = kernel_id(&dropped.kernels[0]).unwrap();

        let mut bound = Vec::new();
        for id in [&old_id, &dropped_id] {
            let environment = crate::models::environments::insert_environment(
                &context.db, "Env", None, None, None, Some("Windows"), None,
            )
            .await
            .unwrap();
            crate::models::environments::upsert_environment_config(
                &context.db,
                environment,
                &serde_json::json!({ "kernel_id": id }),
                &serde_json::json!({}),
                &serde_json::json!({}),
                &serde_json::json!({}),
                &serde_json::json!({}),
                &serde_json::json!({}),
            )
            .await
            .unwrap();
            bind_environment_kernel(&context.db, environment, id).await.unwrap();
            bound.push(environment);
        }

        import_default_catalog(&context.db).await.unwrap();

        let current = parse_default_catalog().unwrap();
        let new_id = kernel_id(&current.kernels[0]).unwrap();
        let moved = get_environment_kernel(&context.db, bound[0]).await.unwrap().unwrap();
        assert_eq!(moved.kernel_id, new_id);
        assert_eq!(moved.url.as_deref(), Some(current.kernels[0].url.trim()));
        let stored = crate::models::environments::fetch_environment_config(&context.db, bound[0])
            .await
            .unwrap()
            .unwrap();
        assert_eq!(stored.window_info["kernel_id"].as_str(), Some(new_id.as_str()));

        let kept = get_environment_kernel(&context.db, bound[1]).await.unwrap().unwrap();
        assert_eq!(kept.kernel_id, dropped_id);
        assert_eq!(kept.status, "retired");
        assert!(kept.url.is_some());
    }

    #[tokio::test]
    async fn an_update_is_offered_by_install_directory_until_the_user_installs_it() {
        let pool = test_pool().await;
        // 上一版（mz1）装在 Chrome 157 目录里，记下了它的签名
        let mut previous = parse_default_catalog().unwrap();
        previous.kernels[0].hash = "1".repeat(64);
        previous.kernels[0].signature = "a".repeat(64);
        import_catalog(&pool, &previous).await.unwrap();
        let old_id = kernel_id(&previous.kernels[0]).unwrap();
        record_kernel_installation(&pool, &old_id, "C:/kernels/Chrome 157/mz.exe", &"a".repeat(64))
            .await
            .unwrap();

        // 清单换成新版本（mz2）：新的 kernel_id，同一个安装目录
        let current = parse_default_catalog().unwrap();
        import_catalog(&pool, &current).await.unwrap();
        let new_id = kernel_id(&current.kernels[0]).unwrap();
        let dir = current.kernels[0].install_dir_name.clone().unwrap();

        let listed = get_browser_kernel(&pool, &new_id).await.unwrap().unwrap();
        assert!(listed.installed, "the directory still holds the old build");
        assert!(listed.update_available, "a different build is installed, so an update is offered");
        assert_eq!(listed.installed_signature.as_deref(), Some("a".repeat(64).as_str()));
        assert_eq!(installed_signature_for_dir(&pool, &dir).await.unwrap(), Some("a".repeat(64)));

        // 用户点了更新：记下新签名后不再提示
        record_kernel_installation(&pool, &new_id, "C:/kernels/Chrome 157/mz.exe", &current.kernels[0].signature)
            .await
            .unwrap();
        sqlx::query("UPDATE browser_kernel_installations SET updated_at = '2000-01-01' WHERE kernel_id = $1")
            .bind(&old_id)
            .execute(&pool)
            .await
            .unwrap();
        let listed = get_browser_kernel(&pool, &new_id).await.unwrap().unwrap();
        assert!(listed.installed);
        assert!(!listed.update_available);

        // 从没装过的目录：不算已安装，也不提示更新
        let other = parse_default_catalog()
            .unwrap()
            .kernels
            .into_iter()
            .find(|kernel| kernel.install_dir_name != Some(dir.clone()))
            .unwrap();
        let other = get_browser_kernel(&pool, &kernel_id(&other).unwrap()).await.unwrap().unwrap();
        assert!(!other.installed && !other.update_available);
    }

    #[tokio::test]
    async fn replaces_a_sources_url_without_replacing_the_artifact() {
        let pool = test_pool().await;
        let mut catalog = parse_default_catalog().unwrap();
        catalog.source_id = "test-user-source".to_string();
        catalog.kernels.truncate(1);
        catalog.kernels[0].priority = 10;
        catalog.kernels[0].url = "https://example.invalid/first.zip".to_string();
        import_catalog(&pool, &catalog).await.unwrap();
        catalog.kernels[0].resource_name = "Renamed Chrome 156".to_string();
        catalog.kernels[0].install_dir_name = Some("Another directory".to_string());
        catalog.kernels[0].url = "https://example.invalid/second.zip".to_string();
        import_catalog(&pool, &catalog).await.unwrap();

        let artifact_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM browser_kernel_artifacts")
                .fetch_one(&pool)
                .await
                .unwrap();
        let active_source: String = sqlx::query_scalar(
            "SELECT url FROM browser_kernel_sources \
             WHERE source_id = 'test-user-source' AND is_active = 1",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        let active_source_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM browser_kernel_sources \
             WHERE source_id = 'test-user-source' AND is_active = 1",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        let install_dir_name: String =
            sqlx::query_scalar("SELECT install_dir_name FROM browser_kernel_artifacts")
                .fetch_one(&pool)
                .await
                .unwrap();

        assert_eq!(artifact_count, 1);
        assert_eq!(active_source_count, 1);
        assert_eq!(active_source, "https://example.invalid/second.zip");
        assert_eq!(install_dir_name, parse_default_catalog().unwrap().kernels[0].install_dir_name.clone().unwrap());
    }

    #[tokio::test]
    async fn migrates_legacy_environment_name_to_an_immutable_binding() {
        let mut config = DatabaseConfig::embedded("sqlite::memory:");
        config.max_connections = 1;
        config.min_connections = 1;
        let context = crate::svc_ctx::SvcCtx::new(&config).await.unwrap();
        let environment_uuid = crate::models::environments::insert_environment(
            &context.db,
            "Legacy browser",
            None,
            None,
            None,
            Some("Windows"),
            Some("Chrome 156"),
        )
        .await
        .unwrap();
        crate::models::environments::upsert_environment_config(
            &context.db,
            environment_uuid,
            &serde_json::json!({ "kernel": "Chrome 156" }),
            &serde_json::json!({}),
            &serde_json::json!({}),
            &serde_json::json!({}),
            &serde_json::json!({}),
            &serde_json::json!({}),
        )
        .await
        .unwrap();

        assert_eq!(
            migrate_legacy_environment_bindings(&context.db).await.unwrap(),
            1
        );
        let bound = get_environment_kernel(&context.db, environment_uuid).await.unwrap().unwrap();
        assert_eq!(bound.resource_name, "Chrome 156");
        assert_eq!(bound.kernel_id.len(), 64);

        let stored =
            crate::models::environments::fetch_environment_config(&context.db, environment_uuid)
                .await
                .unwrap()
                .unwrap();
        assert_eq!(
            stored.window_info["kernel_id"].as_str(),
            Some(bound.kernel_id.as_str())
        );
    }
}
