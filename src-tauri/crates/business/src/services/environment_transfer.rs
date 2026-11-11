//! 环境的完整导出和导入（JSON 备份），可以在别的电脑上恢复出同样的环境。
//!
//! 导出：配置（指纹、内核、浏览器完整版本号）、分组、标签、代理、账号、启动网址；选了才带上
//! 代理密码、账号密码和 Cookie。导入：原来的环境 ID 在本机没被用过就沿用（指纹噪声由内核按环境 ID
//! 推算，ID 不变指纹就不变），分组、标签、代理、账号按内容复用已有的；任何一个环境失败就撤销本次导入。
use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::entitys::tags::CreateTagRequest;
use crate::entitys::{
    CookieGroupInput, CreateAccountRequest, CreateEnvironmentRequest, CreateGroupRequest,
    CreateProxyRequest, EnvironmentConfigRequest, UrlInput,
};
use crate::models;
use crate::services::{accounts, environments, groups, proxies, tags};
use crate::svc_ctx::SvcCtx;

pub const FORMAT: &str = "mz-browser-environments";
pub const SCHEMA_VERSION: u32 = 1;
pub const MAX_ENVIRONMENTS: usize = 1000;
/// 内核 ID 是本机内核目录里的 ID，换台电脑就对不上；导入时按内核名（如 Chrome 157）重新匹配
const LOCAL_KERNEL_ID_KEY: &str = "kernel_id";
const KERNEL_NAME_KEY: &str = "kernel";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentBundle {
    pub format: String,
    pub schema_version: u32,
    #[serde(default)]
    pub exported_at: Option<String>,
    /// 是否带了密码和 Cookie（明文）
    #[serde(default)]
    pub includes_secrets: bool,
    pub environments: Vec<PortableEnvironment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortableEnvironment {
    pub source_uuid: Uuid,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub group: Option<PortableGroup>,
    #[serde(default)]
    pub tags: Vec<PortableTag>,
    #[serde(default)]
    pub proxy: Option<PortableProxy>,
    #[serde(default)]
    pub accounts: Vec<PortableAccount>,
    #[serde(default)]
    pub urls: Vec<UrlInput>,
    #[serde(default)]
    pub cookies: Vec<CookieGroupInput>,
    pub config: EnvironmentConfigRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortableGroup {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortableTag {
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortableProxy {
    pub name: String,
    pub host: String,
    pub port: i32,
    pub proxy_type: String,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortableAccount {
    pub platform_url: String,
    #[serde(default)]
    pub platform_name: Option<String>,
    pub account: String,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExportEnvironmentsRequest {
    pub uuids: Vec<Uuid>,
    #[serde(default)]
    pub include_secrets: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ImportEnvironmentsRequest {
    pub bundle: EnvironmentBundle,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ImportedEnvironment {
    pub uuid: Uuid,
    pub name: String,
    /// 沿用了原来的环境 ID，指纹和原环境完全一样；否则 Canvas、音频等噪声会变
    pub kept_identity: bool,
}

pub async fn export_environments_service(
    svc_ctx: &SvcCtx,
    request: &ExportEnvironmentsRequest,
) -> Result<EnvironmentBundle, String> {
    if request.uuids.is_empty() {
        return Err("没有要导出的环境".to_string());
    }
    // 和导入的上限一致，否则导出的文件导不回来
    if request.uuids.len() > MAX_ENVIRONMENTS {
        return Err(format!("一次最多导出 {MAX_ENVIRONMENTS} 个环境，请分批导出"));
    }
    let mut exported = Vec::with_capacity(request.uuids.len());
    for uuid in &request.uuids {
        let detail = environments::get_environment_detail_service(svc_ctx, *uuid).await?;
        let config = detail
            .config
            .ok_or_else(|| format!("环境“{}”没有配置，无法导出", detail.environment.name))?;
        let mut window_info = config.window_info;
        // 导入时按内核名匹配：写上实际绑定的内核名，老环境里的 "chrome" 之类的旧值不可靠
        let kernel = crate::services::browser_kernels::resolve_requested_kernel(&svc_ctx.db, &window_info, true)
            .await
            .map_err(|error| format!("环境“{}”的内核无法识别，无法导出：{error}", detail.environment.name))?;
        if let Some(object) = window_info.as_object_mut() {
            object.remove(LOCAL_KERNEL_ID_KEY);
            object.insert(KERNEL_NAME_KEY.to_string(), serde_json::Value::String(kernel.resource_name));
        }
        let secret = |value: Option<String>| if request.include_secrets { value } else { None };
        exported.push(PortableEnvironment {
            source_uuid: *uuid,
            name: detail.environment.name,
            description: detail.environment.description,
            group: detail.group.map(|group| PortableGroup { name: group.name, description: group.description }),
            tags: detail.tags.into_iter().map(|tag| PortableTag { name: tag.name, color: tag.color }).collect(),
            proxy: detail.proxy.map(|proxy| PortableProxy {
                name: proxy.name,
                host: proxy.host,
                port: proxy.port,
                proxy_type: proxy.proxy_type,
                username: proxy.username,
                password: secret(proxy.password),
                country: proxy.country,
                city: proxy.city,
            }),
            accounts: detail
                .accounts
                .into_iter()
                .map(|account| PortableAccount {
                    platform_url: account.platform_url,
                    platform_name: account.platform_name,
                    account: account.account,
                    password: secret(account.password),
                    remark: account.remark,
                })
                .collect(),
            urls: detail
                .urls
                .into_iter()
                .map(|url| UrlInput { url: url.url, title: url.title, sort_order: url.sort_order })
                .collect(),
            cookies: if request.include_secrets {
                detail
                    .cookies
                    .into_iter()
                    .map(|cookie| CookieGroupInput { site: cookie.site, cookie_text: cookie.cookie_text })
                    .collect()
            } else {
                Vec::new()
            },
            config: EnvironmentConfigRequest {
                window_info,
                basic_settings: config.basic_settings,
                fingerprint_settings: config.fingerprint_settings,
                device_settings: config.device_settings,
                preference_settings: config.preference_settings,
                project_metadata: config.project_metadata,
            },
        });
    }
    Ok(EnvironmentBundle {
        format: FORMAT.to_string(),
        schema_version: SCHEMA_VERSION,
        exported_at: Some(chrono::Utc::now().to_rfc3339()),
        includes_secrets: request.include_secrets,
        environments: exported,
    })
}

fn validate(bundle: &EnvironmentBundle) -> Result<(), String> {
    if bundle.format != FORMAT {
        return Err("不是 MZ指纹浏览器 导出的环境文件".to_string());
    }
    if bundle.schema_version == 0 || bundle.schema_version > SCHEMA_VERSION {
        return Err(format!("文件版本 {} 不受支持，请升级软件后再导入", bundle.schema_version));
    }
    if bundle.environments.is_empty() {
        return Err("文件里没有环境".to_string());
    }
    if bundle.environments.len() > MAX_ENVIRONMENTS {
        return Err(format!("一次最多导入 {MAX_ENVIRONMENTS} 个环境"));
    }
    for environment in &bundle.environments {
        if environment.name.trim().is_empty() {
            return Err("文件里有没有名称的环境".to_string());
        }
        if !environment.config.window_info.is_object() {
            return Err(format!("环境“{}”的配置不完整", environment.name));
        }
    }
    Ok(())
}

/// 导入前的检查（文件格式、内核都在本机）。只读，不改动任何数据
pub async fn check_import_request(svc_ctx: &SvcCtx, request: &ImportEnvironmentsRequest) -> Result<(), String> {
    validate(&request.bundle)?;
    check_kernels(svc_ctx, &request.bundle).await
}

/// 写了具体内核名的环境，这个内核在本机内核目录里都要有。找不到时不能换成默认内核：
/// 浏览器类型和版本都会变，指纹就不再是原来的了。
/// 只写着 "chrome" 或者没有内核名的旧备份没有版本可以对，沿用默认内核（和以前一样）
async fn check_kernels(svc_ctx: &SvcCtx, bundle: &EnvironmentBundle) -> Result<(), String> {
    let mut missing = std::collections::BTreeSet::new();
    for environment in &bundle.environments {
        let name = environment
            .config
            .window_info
            .get(KERNEL_NAME_KEY)
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|name| !name.is_empty() && !name.eq_ignore_ascii_case("chrome"));
        let Some(name) = name else { continue };
        if crate::services::browser_kernels::find_browser_kernel_by_name(&svc_ctx.db, name).await?.is_none() {
            missing.insert(name.to_string());
        }
    }
    if missing.is_empty() {
        return Ok(());
    }
    let names = missing.into_iter().collect::<Vec<_>>().join("、");
    Err(format!("本机的内核目录里没有 {names}，请先在设置里更新内核后再导入"))
}

/// 本次导入新建的数据，失败时按这个撤销
#[derive(Default)]
struct Created {
    environments: Vec<Uuid>,
    groups: Vec<Uuid>,
    tags: Vec<Uuid>,
    proxies: Vec<Uuid>,
    accounts: Vec<Uuid>,
    /// 复用的已有代理、账号原来没有密码，这次从文件里补上了；撤销时清回去
    filled_proxy_passwords: Vec<Uuid>,
    filled_account_passwords: Vec<Uuid>,
}

#[derive(Default)]
struct Resolved {
    groups: HashMap<String, Uuid>,
    tags: HashMap<String, Uuid>,
    proxies: HashMap<(String, i32, String, String), Uuid>,
    accounts: HashMap<(String, String), Uuid>,
}

pub async fn import_environments_service(
    svc_ctx: &SvcCtx,
    request: &ImportEnvironmentsRequest,
) -> Result<Vec<ImportedEnvironment>, String> {
    check_import_request(svc_ctx, request).await?;
    let mut created = Created::default();
    match import_all(svc_ctx, &request.bundle, &mut created).await {
        Ok(imported) => Ok(imported),
        Err(error) => {
            rollback(svc_ctx, &created).await;
            Err(error)
        }
    }
}

async fn import_all(
    svc_ctx: &SvcCtx,
    bundle: &EnvironmentBundle,
    created: &mut Created,
) -> Result<Vec<ImportedEnvironment>, String> {
    let mut resolved = Resolved::default();
    let mut imported = Vec::with_capacity(bundle.environments.len());
    for environment in &bundle.environments {
        let name = environment.name.trim().to_string();
        let failed = |error: String| format!("导入环境“{name}”失败：{error}");

        let group_uuid = match &environment.group {
            Some(group) if !group.name.trim().is_empty() => {
                Some(resolve_group(svc_ctx, group, &mut resolved, created).await.map_err(failed)?)
            }
            _ => None,
        };
        let mut tag_uuids = Vec::new();
        for tag in environment.tags.iter().filter(|tag| !tag.name.trim().is_empty()) {
            tag_uuids.push(resolve_tag(svc_ctx, tag, &mut resolved, created).await.map_err(failed)?);
        }
        let proxy_uuid = match &environment.proxy {
            Some(proxy) => Some(resolve_proxy(svc_ctx, proxy, &mut resolved, created).await.map_err(failed)?),
            None => None,
        };
        let mut account_uuids = Vec::new();
        for account in &environment.accounts {
            account_uuids.push(resolve_account(svc_ctx, account, &mut resolved, created).await.map_err(failed)?);
        }

        let mut config = environment.config.clone();
        if let Some(object) = config.window_info.as_object_mut() {
            object.remove(LOCAL_KERNEL_ID_KEY);
        }
        let kept_identity = !environment_uuid_taken(svc_ctx, environment.source_uuid).await?;
        // ID 先定下来并记账：创建到一半失败（比如 Cookie 写不进去）时，撤销也要删掉这条半成品
        let target = if kept_identity { environment.source_uuid } else { Uuid::new_v4() };
        created.environments.push(target);
        let payload = CreateEnvironmentRequest {
            name: name.clone(),
            description: environment.description.clone(),
            group_uuid,
            tag_uuids: Some(tag_uuids),
            account_uuids: Some(account_uuids),
            proxy_uuid,
            cookies: (!environment.cookies.is_empty()).then(|| environment.cookies.clone()),
            urls: (!environment.urls.is_empty()).then(|| environment.urls.clone()),
            config,
        };
        let uuid = environments::create_environment_with(svc_ctx, &payload, Some(target), true)
            .await
            .map_err(failed)?;
        imported.push(ImportedEnvironment { uuid, name, kept_identity });
    }
    Ok(imported)
}

async fn rollback(svc_ctx: &SvcCtx, created: &Created) {
    for uuid in &created.environments {
        if let Err(error) = models::permanent_delete_environment(&svc_ctx.db, *uuid).await {
            tracing::warn!("could not undo an imported environment: {error}");
        }
    }
    for uuid in &created.accounts {
        let _ = accounts::delete_account_service(svc_ctx, *uuid).await;
    }
    for uuid in &created.proxies {
        let _ = proxies::delete_proxy_service(svc_ctx, *uuid).await;
    }
    for uuid in &created.tags {
        let _ = tags::delete_tag_service(svc_ctx, *uuid).await;
    }
    for uuid in &created.groups {
        let _ = groups::delete_group_service(svc_ctx, *uuid).await;
    }
    for (table, uuids) in [
        ("proxies", &created.filled_proxy_passwords),
        ("platform_accounts", &created.filled_account_passwords),
    ] {
        for uuid in uuids {
            let sql = format!("UPDATE {table} SET password = NULL WHERE uuid = $1");
            if let Err(error) = sqlx::query(&sql).bind(*uuid).execute(&svc_ctx.db).await {
                tracing::warn!("could not undo a password filled in by an import: {error}");
            }
        }
    }
}

fn has_text(value: Option<&str>) -> bool {
    value.is_some_and(|value| !value.is_empty())
}

/// 回收站里的环境也算占用：恢复时会冲突。没被占用的 ID 导入时会沿用
pub async fn environment_uuid_taken(svc_ctx: &SvcCtx, uuid: Uuid) -> Result<bool, String> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM environments WHERE uuid = $1")
        .bind(uuid)
        .fetch_one(&svc_ctx.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

async fn existing_uuid(svc_ctx: &SvcCtx, sql: &str, binds: &[&str]) -> Result<Option<Uuid>, String> {
    let mut query = sqlx::query_scalar::<_, Uuid>(sql);
    for bind in binds {
        query = query.bind(*bind);
    }
    query.fetch_optional(&svc_ctx.db).await.map_err(|e| e.to_string())
}

async fn resolve_group(
    svc_ctx: &SvcCtx,
    group: &PortableGroup,
    resolved: &mut Resolved,
    created: &mut Created,
) -> Result<Uuid, String> {
    let name = group.name.trim().to_string();
    if let Some(uuid) = resolved.groups.get(&name) {
        return Ok(*uuid);
    }
    let sql = "SELECT uuid FROM groups WHERE name = $1 AND deleted_at IS NULL ORDER BY id LIMIT 1";
    let uuid = match existing_uuid(svc_ctx, sql, &[&name]).await? {
        Some(uuid) => uuid,
        None => {
            let uuid = groups::create_group_service(
                svc_ctx,
                &CreateGroupRequest { name: name.clone(), description: group.description.clone() },
            )
            .await?;
            created.groups.push(uuid);
            uuid
        }
    };
    resolved.groups.insert(name, uuid);
    Ok(uuid)
}

async fn resolve_tag(
    svc_ctx: &SvcCtx,
    tag: &PortableTag,
    resolved: &mut Resolved,
    created: &mut Created,
) -> Result<Uuid, String> {
    let name = tag.name.trim().to_string();
    if let Some(uuid) = resolved.tags.get(&name) {
        return Ok(*uuid);
    }
    let sql = "SELECT uuid FROM tags WHERE name = $1 AND deleted_at IS NULL ORDER BY id LIMIT 1";
    let uuid = match existing_uuid(svc_ctx, sql, &[&name]).await? {
        Some(uuid) => uuid,
        None => {
            let uuid =
                tags::create_tag_service(svc_ctx, &CreateTagRequest { name: name.clone(), color: tag.color.clone() })
                    .await?;
            created.tags.push(uuid);
            uuid
        }
    };
    resolved.tags.insert(name, uuid);
    Ok(uuid)
}

/// 主机、端口、类型、用户名都一样的就是同一个代理，复用本机已有的。已有的有密码就不动；
/// 没有密码（比如先导入过不带密码的文件）而文件里有，就补上
async fn resolve_proxy(
    svc_ctx: &SvcCtx,
    proxy: &PortableProxy,
    resolved: &mut Resolved,
    created: &mut Created,
) -> Result<Uuid, String> {
    let host = proxy.host.trim().to_string();
    let proxy_type = proxy.proxy_type.trim().to_string();
    let username = proxy.username.clone().unwrap_or_default();
    if host.is_empty() || !(1..=65535).contains(&proxy.port) {
        return Err(format!("代理 {host}:{} 无效", proxy.port));
    }
    let key = (host.clone(), proxy.port, proxy_type.clone(), username.clone());
    if let Some(uuid) = resolved.proxies.get(&key) {
        return Ok(*uuid);
    }
    let found: Option<Uuid> = sqlx::query_scalar(
        "SELECT uuid FROM proxies WHERE host = $1 AND port = $2 AND proxy_type = $3 \
         AND COALESCE(username, '') = $4 AND deleted_at IS NULL ORDER BY id LIMIT 1",
    )
    .bind(&host)
    .bind(proxy.port)
    .bind(&proxy_type)
    .bind(&username)
    .fetch_optional(&svc_ctx.db)
    .await
    .map_err(|e| e.to_string())?;
    let uuid = match found {
        Some(uuid) => {
            if has_text(proxy.password.as_deref())
                && !has_text(proxies::get_proxy_service(svc_ctx, uuid).await?.password.as_deref())
            {
                models::update_proxy(&svc_ctx.db, uuid, None, None, None, None, None, proxy.password.as_deref(), None, None)
                    .await
                    .map_err(|e| e.to_string())?;
                created.filled_proxy_passwords.push(uuid);
            }
            uuid
        }
        None => {
            let uuid = proxies::create_proxy_service(
                svc_ctx,
                &CreateProxyRequest {
                    name: if proxy.name.trim().is_empty() { format!("{host}:{}", proxy.port) } else { proxy.name.clone() },
                    host,
                    port: proxy.port,
                    proxy_type,
                    username: proxy.username.clone(),
                    password: proxy.password.clone(),
                    country: proxy.country.clone(),
                    city: proxy.city.clone(),
                    ssh_key: None,
                    ssh_passphrase: None,
                },
            )
            .await?;
            created.proxies.push(uuid);
            uuid
        }
    };
    resolved.proxies.insert(key, uuid);
    Ok(uuid)
}

/// 平台地址和账号都一样的就是同一个账号；已有的没有密码而文件里有，就补上
async fn resolve_account(
    svc_ctx: &SvcCtx,
    account: &PortableAccount,
    resolved: &mut Resolved,
    created: &mut Created,
) -> Result<Uuid, String> {
    let platform_url = account.platform_url.trim().to_string();
    let name = account.account.trim().to_string();
    if platform_url.is_empty() || name.is_empty() {
        return Err("账号缺少平台地址或账号名".to_string());
    }
    let key = (platform_url.clone(), name.clone());
    if let Some(uuid) = resolved.accounts.get(&key) {
        return Ok(*uuid);
    }
    let sql = "SELECT uuid FROM platform_accounts WHERE platform_url = $1 AND account = $2 \
               AND deleted_at IS NULL ORDER BY id LIMIT 1";
    let uuid = match existing_uuid(svc_ctx, sql, &[&platform_url, &name]).await? {
        Some(uuid) => {
            if has_text(account.password.as_deref())
                && !has_text(accounts::get_account_service(svc_ctx, uuid).await?.password.as_deref())
            {
                models::update_platform_account(
                    &svc_ctx.db,
                    uuid,
                    None,
                    None,
                    None,
                    account.password.as_deref(),
                    None,
                    None,
                )
                .await
                .map_err(|e| e.to_string())?;
                created.filled_account_passwords.push(uuid);
            }
            uuid
        }
        None => {
            let uuid = accounts::create_account_service(
                svc_ctx,
                &CreateAccountRequest {
                    platform_url,
                    platform_name: account.platform_name.clone(),
                    account: name,
                    password: account.password.clone(),
                    remark: account.remark.clone(),
                },
            )
            .await?;
            created.accounts.push(uuid);
            uuid
        }
    };
    resolved.accounts.insert(key, uuid);
    Ok(uuid)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{database, utils::DatabaseConfig};
    use serde_json::json;

    async fn test_ctx() -> SvcCtx {
        let mut config = DatabaseConfig::embedded("sqlite::memory:");
        config.max_connections = 1;
        config.min_connections = 1;
        let db = database::connect(&config).await.unwrap();
        database::migrate(&db).await.unwrap();
        crate::services::browser_kernels::import_default_catalog(&db).await.unwrap();
        SvcCtx { db }
    }

    async fn count(ctx: &SvcCtx, table: &str) -> i64 {
        sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table} WHERE deleted_at IS NULL"))
            .fetch_one(&ctx.db)
            .await
            .unwrap()
    }

    async fn source_environment(ctx: &SvcCtx) -> Uuid {
        let group = groups::create_group_service(ctx, &CreateGroupRequest { name: "G".into(), description: Some("d".into()) })
            .await
            .unwrap();
        let tag = tags::create_tag_service(ctx, &CreateTagRequest { name: "T".into(), color: Some("#123456".into()) })
            .await
            .unwrap();
        let proxy = proxies::create_proxy_service(
            ctx,
            &CreateProxyRequest {
                name: "P".into(),
                host: "203.0.113.5".into(),
                port: 1080,
                proxy_type: "socks5".into(),
                username: Some("u".into()),
                password: Some("proxy-secret".into()),
                country: Some("US".into()),
                city: None,
                ssh_key: None,
                ssh_passphrase: None,
            },
        )
        .await
        .unwrap();
        let account = accounts::create_account_service(
            ctx,
            &CreateAccountRequest {
                platform_url: "https://example.com/".into(),
                platform_name: Some("Example".into()),
                account: "me@example.com".into(),
                password: Some("account-secret".into()),
                remark: Some("r".into()),
            },
        )
        .await
        .unwrap();
        environments::create_environment_service(
            ctx,
            &CreateEnvironmentRequest {
                name: "Shop 1".into(),
                description: Some("note".into()),
                group_uuid: Some(group),
                tag_uuids: Some(vec![tag]),
                account_uuids: Some(vec![account]),
                proxy_uuid: Some(proxy),
                cookies: Some(vec![CookieGroupInput {
                    site: "https://example.com".into(),
                    cookie_text: "sid=cookie-secret".into(),
                }]),
                urls: Some(vec![UrlInput { url: "https://example.com/".into(), title: None, sort_order: Some(0) }]),
                config: serde_json::from_value(json!({
                    "window_info": { "name": "Shop 1", "system": "Windows", "kernel": "Chrome 157", "platformVersion": "19.0.0" },
                    "basic_settings": { "timezone": "America/New_York" },
                    "fingerprint_settings": { "canvas": "random" },
                    "device_settings": { "hardwareConcurrency": 8 },
                    "preference_settings": {}
                }))
                .unwrap(),
            },
        )
        .await
        .unwrap()
    }

    async fn export(ctx: &SvcCtx, uuid: Uuid, include_secrets: bool) -> EnvironmentBundle {
        let bundle = export_environments_service(ctx, &ExportEnvironmentsRequest { uuids: vec![uuid], include_secrets })
            .await
            .unwrap();
        // 和写进文件再读回来一样
        serde_json::from_str(&serde_json::to_string(&bundle).unwrap()).unwrap()
    }

    async fn import(ctx: &SvcCtx, bundle: &EnvironmentBundle) -> Result<Vec<ImportedEnvironment>, String> {
        import_environments_service(ctx, &ImportEnvironmentsRequest { bundle: bundle.clone() }).await
    }

    #[tokio::test]
    async fn an_environment_comes_back_complete_with_the_same_identity() {
        let ctx = test_ctx().await;
        let uuid = source_environment(&ctx).await;
        let before = environments::get_environment_detail_service(&ctx, uuid).await.unwrap();
        let version = before.config.as_ref().unwrap().window_info["uaFullVersion"].clone();
        assert!(version.is_string());

        let bundle = export(&ctx, uuid, true).await;
        assert!(bundle.includes_secrets);
        let item = &bundle.environments[0];
        assert!(item.config.window_info.get("kernel_id").is_none());
        assert_eq!(item.proxy.as_ref().unwrap().password.as_deref(), Some("proxy-secret"));
        assert_eq!(item.accounts[0].password.as_deref(), Some("account-secret"));
        assert_eq!(item.cookies.len(), 1);

        // 换台电脑：本机没有这个环境
        models::permanent_delete_environment(&ctx.db, uuid).await.unwrap();
        let imported = import(&ctx, &bundle).await.unwrap();
        assert_eq!(imported, vec![ImportedEnvironment { uuid, name: "Shop 1".into(), kept_identity: true }]);

        let after = environments::get_environment_detail_service(&ctx, uuid).await.unwrap();
        let config = after.config.unwrap();
        assert_eq!(config.window_info["uaFullVersion"], version);
        assert_eq!(config.window_info["kernel"], "Chrome 157");
        assert!(config.window_info["kernel_id"].is_string());
        assert_eq!(config.basic_settings["timezone"], "America/New_York");
        assert_eq!(config.device_settings["hardwareConcurrency"], 8);
        assert_eq!(after.environment.description.as_deref(), Some("note"));
        assert_eq!(after.group.unwrap().name, "G");
        assert_eq!(after.tags[0].name, "T");
        assert_eq!(after.proxy.as_ref().unwrap().password.as_deref(), Some("proxy-secret"));
        assert_eq!(after.accounts[0].password.as_deref(), Some("account-secret"));
        assert_eq!(after.cookies[0].cookie_text, "sid=cookie-secret");
        assert_eq!(after.urls[0].url, "https://example.com/");
        // 原来的分组、标签、代理、账号还在，直接复用，不重复建
        assert_eq!(count(&ctx, "groups").await, 1);
        assert_eq!(count(&ctx, "tags").await, 1);
        assert_eq!(count(&ctx, "proxies").await, 1);
        assert_eq!(count(&ctx, "platform_accounts").await, 1);
    }

    #[tokio::test]
    async fn importing_next_to_the_original_gets_a_new_id() {
        let ctx = test_ctx().await;
        let uuid = source_environment(&ctx).await;
        let bundle = export(&ctx, uuid, true).await;
        let imported = import(&ctx, &bundle).await.unwrap();
        assert_ne!(imported[0].uuid, uuid);
        assert!(!imported[0].kept_identity);
        assert_eq!(count(&ctx, "environments").await, 2);
        assert_eq!(count(&ctx, "proxies").await, 1);
    }

    #[tokio::test]
    async fn secrets_are_left_out_unless_asked_for() {
        let ctx = test_ctx().await;
        let uuid = source_environment(&ctx).await;
        let bundle = export(&ctx, uuid, false).await;
        let item = &bundle.environments[0];
        assert!(!bundle.includes_secrets);
        assert!(item.proxy.as_ref().unwrap().password.is_none());
        assert!(item.accounts[0].password.is_none());
        assert!(item.cookies.is_empty());
        let text = serde_json::to_string(&bundle).unwrap();
        for secret in ["proxy-secret", "account-secret", "cookie-secret"] {
            assert!(!text.contains(secret), "{secret}");
        }
    }

    #[tokio::test]
    async fn a_failure_undoes_the_whole_import() {
        let ctx = test_ctx().await;
        let uuid = source_environment(&ctx).await;
        let mut bundle = export(&ctx, uuid, true).await;
        models::permanent_delete_environment(&ctx.db, uuid).await.unwrap();
        let mut second = bundle.environments[0].clone();
        second.source_uuid = Uuid::new_v4();
        second.name = "Broken".into();
        second.group = Some(PortableGroup { name: "New group".into(), description: None });
        second.cookies = vec![CookieGroupInput { site: "  ".into(), cookie_text: "a=b".into() }];
        bundle.environments.push(second);

        let error = import(&ctx, &bundle).await.unwrap_err();
        assert!(error.contains("Broken"), "{error}");
        assert_eq!(count(&ctx, "environments").await, 0);
        assert_eq!(count(&ctx, "groups").await, 1);
    }

    #[tokio::test]
    async fn a_kernel_missing_here_refuses_the_import_instead_of_switching_kernels() {
        let ctx = test_ctx().await;
        let uuid = source_environment(&ctx).await;
        let mut bundle = export(&ctx, uuid, false).await;
        models::permanent_delete_environment(&ctx.db, uuid).await.unwrap();
        bundle.environments[0].config.window_info["kernel"] = json!("Firefox 999");
        let error = import(&ctx, &bundle).await.unwrap_err();
        assert!(error.contains("Firefox 999"), "{error}");
        assert_eq!(count(&ctx, "environments").await, 0);

        // 旧备份写的是 "chrome"：没有版本可以对，沿用默认内核
        bundle.environments[0].config.window_info["kernel"] = json!("chrome");
        assert_eq!(import(&ctx, &bundle).await.unwrap().len(), 1);
        assert_eq!(count(&ctx, "environments").await, 1);
    }

    #[tokio::test]
    async fn an_export_whose_kernel_cannot_be_resolved_is_refused() {
        let ctx = test_ctx().await;
        let uuid = source_environment(&ctx).await;
        sqlx::query("UPDATE environment_configs SET window_info = json_set(window_info, '$.kernel_id', 'missing-kernel') WHERE environment_uuid = $1")
            .bind(uuid)
            .execute(&ctx.db)
            .await
            .unwrap();
        let error = export_environments_service(&ctx, &ExportEnvironmentsRequest { uuids: vec![uuid], include_secrets: false })
            .await
            .unwrap_err();
        assert!(error.contains("无法导出"), "{error}");
    }

    #[tokio::test]
    async fn checking_an_import_changes_nothing() {
        let ctx = test_ctx().await;
        let uuid = source_environment(&ctx).await;
        let bundle = export(&ctx, uuid, false).await;
        models::permanent_delete_environment(&ctx.db, uuid).await.unwrap();
        let mut broken = bundle.clone();
        broken.environments[0].config.window_info["kernel"] = json!("Firefox 999");
        assert!(check_import_request(&ctx, &ImportEnvironmentsRequest { bundle: broken }).await.is_err());
        assert_eq!(count(&ctx, "environments").await, 0);
        assert!(check_import_request(&ctx, &ImportEnvironmentsRequest { bundle }).await.is_ok());
    }

    #[tokio::test]
    async fn the_export_names_the_bound_kernel_even_for_old_environments() {
        let ctx = test_ctx().await;
        let uuid = source_environment(&ctx).await;
        sqlx::query("UPDATE environment_configs SET window_info = json_set(window_info, '$.kernel', 'chrome') WHERE environment_uuid = $1")
            .bind(uuid)
            .execute(&ctx.db)
            .await
            .unwrap();
        let bundle = export(&ctx, uuid, false).await;
        assert_eq!(bundle.environments[0].config.window_info["kernel"], "Chrome 157");
    }

    #[tokio::test]
    async fn no_more_is_exported_than_one_import_takes() {
        let ctx = test_ctx().await;
        let uuids = (0..=MAX_ENVIRONMENTS).map(|_| Uuid::new_v4()).collect();
        let request = ExportEnvironmentsRequest { uuids, include_secrets: false };
        let error = export_environments_service(&ctx, &request).await.unwrap_err();
        assert!(error.contains("分批"), "{error}");
    }

    async fn clear_passwords(ctx: &SvcCtx) {
        for table in ["proxies", "platform_accounts"] {
            sqlx::query(&format!("UPDATE {table} SET password = NULL")).execute(&ctx.db).await.unwrap();
        }
    }

    async fn passwords(ctx: &SvcCtx, uuid: Uuid) -> (Option<String>, Option<String>) {
        let detail = environments::get_environment_detail_service(ctx, uuid).await.unwrap();
        (detail.proxy.unwrap().password, detail.accounts[0].password.clone())
    }

    #[tokio::test]
    async fn passwords_are_filled_into_reused_items_that_have_none() {
        let ctx = test_ctx().await;
        let uuid = source_environment(&ctx).await;
        let bundle = export(&ctx, uuid, true).await;
        // 先导入过不带密码的文件：本机的代理和账号没有密码
        models::permanent_delete_environment(&ctx.db, uuid).await.unwrap();
        clear_passwords(&ctx).await;

        let imported = import(&ctx, &bundle).await.unwrap();
        let (proxy, account) = passwords(&ctx, imported[0].uuid).await;
        assert_eq!(proxy.as_deref(), Some("proxy-secret"));
        assert_eq!(account.as_deref(), Some("account-secret"));
        assert_eq!(count(&ctx, "proxies").await, 1);
        assert_eq!(count(&ctx, "platform_accounts").await, 1);

        // 已有的密码不会被文件里的覆盖
        let mut other = bundle.clone();
        other.environments[0].proxy.as_mut().unwrap().password = Some("other".into());
        other.environments[0].accounts[0].password = Some("other".into());
        let again = import(&ctx, &other).await.unwrap();
        let (proxy, account) = passwords(&ctx, again[0].uuid).await;
        assert_eq!(proxy.as_deref(), Some("proxy-secret"));
        assert_eq!(account.as_deref(), Some("account-secret"));
    }

    #[tokio::test]
    async fn a_failed_import_takes_filled_passwords_back() {
        let ctx = test_ctx().await;
        let uuid = source_environment(&ctx).await;
        let mut bundle = export(&ctx, uuid, true).await;
        clear_passwords(&ctx).await;
        let mut broken = bundle.environments[0].clone();
        broken.source_uuid = Uuid::new_v4();
        broken.cookies = vec![CookieGroupInput { site: "  ".into(), cookie_text: "a=b".into() }];
        bundle.environments.push(broken);

        assert!(import(&ctx, &bundle).await.is_err());
        assert_eq!(passwords(&ctx, uuid).await, (None, None));
    }

    #[tokio::test]
    async fn foreign_or_damaged_files_are_refused() {
        let ctx = test_ctx().await;
        let uuid = source_environment(&ctx).await;
        let good = export(&ctx, uuid, false).await;
        let mut wrong_format = good.clone();
        wrong_format.format = "something-else".into();
        let mut too_new = good.clone();
        too_new.schema_version = SCHEMA_VERSION + 1;
        let mut empty = good.clone();
        empty.environments.clear();
        let mut nameless = good.clone();
        nameless.environments[0].name = " ".into();
        for bundle in [wrong_format, too_new, empty, nameless] {
            assert!(import(&ctx, &bundle).await.is_err());
        }
        assert_eq!(count(&ctx, "environments").await, 1);
    }
}
