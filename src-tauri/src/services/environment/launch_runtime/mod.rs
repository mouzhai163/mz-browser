mod detail;
mod fingerprint;
mod kernel;
mod paths;
mod proxy;
mod types;

use futures::future::try_join_all;
use tauri::AppHandle;

use crate::{
    app::handle::get_app_handle,
    core::error::Result,
    infrastructure::persistence::tauri_store,
    services::environment::{
        AccountInfo, BatchLaunchRequest, BatchLaunchResult, CookieGroup, ExtensionInfo,
        KernelService, KernelStatusEmitter, ProxyConfig,
    },
};

use self::{
    detail::get_environment_launch_detail,
    fingerprint::build_fingerprint_config,
    kernel::resolve_kernel_launch,
    paths::get_launch_paths,
    proxy::resolve_proxy_config,
    types::{EnvironmentProxyLike, LaunchPaths},
};

pub struct EnvironmentLaunchRuntimeService;

const ENVIRONMENT_LOCAL_PROXY_BINDINGS_STORE_KEY: &str = "environment.local_proxy_bindings";
const MIHOMO_LOCAL_PROXIES_STORE_KEY: &str = "mihomo.local_proxies";

impl EnvironmentLaunchRuntimeService {
    pub fn resolve_launch_paths(app: &AppHandle) -> Result<LaunchPaths> {
        get_launch_paths(app)
    }

    pub async fn start_environment_by_uuid(
        env_uuid: String,
        launch_paths: LaunchPaths,
        status_emitter: Option<KernelStatusEmitter>,
        display_id: Option<String>,
    ) -> Result<()> {
        let app = get_app_handle()?;
        let request = Self::build_launch_request(
            app.clone(),
            env_uuid,
            &launch_paths,
            status_emitter.clone(),
            display_id,
        )
        .await?;

        KernelService::launch_environment(
            app,
            request.exe_path,
            request.env_uuid,
            request.cache_path,
            request.cookies,
            request.urls,
            request.proxy,
            request.fingerprint_config,
            request.accounts,
            request.extensions,
            status_emitter,
        )
        .await
    }

    /// 为打开外部链接启动环境（默认浏览器）：不打开环境自己配置的起始页，
    /// 链接随后由调用方通过 DevTools 开在前台标签页里。
    pub async fn start_environment_for_link(
        env_uuid: String,
        launch_paths: LaunchPaths,
        status_emitter: Option<KernelStatusEmitter>,
    ) -> Result<()> {
        let app = get_app_handle()?;
        let mut request = Self::build_launch_request(
            app.clone(),
            env_uuid,
            &launch_paths,
            status_emitter.clone(),
            None,
        )
        .await?;
        request.urls = Some(Vec::new());

        KernelService::launch_environment(
            app,
            request.exe_path,
            request.env_uuid,
            request.cache_path,
            request.cookies,
            request.urls,
            request.proxy,
            request.fingerprint_config,
            request.accounts,
            request.extensions,
            status_emitter,
        )
        .await
    }

    pub async fn batch_start_environments_by_uuid(
        env_uuids: Vec<String>,
        launch_paths: LaunchPaths,
        status_emitter: Option<KernelStatusEmitter>,
        display_ids_by_env_uuid: Option<std::collections::HashMap<String, String>>,
    ) -> Result<Vec<BatchLaunchResult>> {
        let app = get_app_handle()?;
        let requests = try_join_all(env_uuids.into_iter().map(|env_uuid| {
            let display_id =
                display_ids_by_env_uuid.as_ref().and_then(|items| items.get(&env_uuid).cloned());
            Self::build_launch_request(
                app.clone(),
                env_uuid,
                &launch_paths,
                status_emitter.clone(),
                display_id,
            )
        }))
        .await?;

        KernelService::batch_launch_environments(app, requests, status_emitter).await
    }

    async fn build_launch_request(
        app: AppHandle,
        env_uuid: String,
        launch_paths: &LaunchPaths,
        status_emitter: Option<KernelStatusEmitter>,
        display_id: Option<String>,
    ) -> Result<BatchLaunchRequest> {
        let detail = get_environment_launch_detail(&env_uuid).await?;
        let env = detail
            .environment
            .as_ref()
            .ok_or("Environment detail is missing environment uuid.")?;

        // Resolve policy before downloads or process creation. Broken bindings
        // must never be interpreted as an explicit choice to use direct access.
        let proxy = resolve_environment_proxy_config(&app, &env.uuid, detail.proxy.clone())?;
        if proxy.is_none() && env.proxy_uuid.is_some() {
            return Err("环境绑定的代理已不存在或不可访问，已阻止无代理启动".into());
        }

        let resolved_kernel = resolve_kernel_launch(
            app.clone(),
            &detail,
            &launch_paths.profiles_path,
            status_emitter.clone(),
        )
        .await?;

        let mut fingerprint_config = build_fingerprint_config(detail.config.as_ref());
        if let (Some(user_agent), Some(major)) =
            (fingerprint_config.user_agent.as_mut(), resolved_kernel.major_version)
        {
            *user_agent = kernel::align_user_agent_major(user_agent, major);
        }
        fingerprint_config.env_id = display_id;
        fingerprint_config.env_name = Some(
            env.name
                .clone()
                .filter(|name| !name.trim().is_empty())
                .unwrap_or_else(|| "Unnamed Environment".to_string()),
        );

        Ok(BatchLaunchRequest {
            exe_path: resolved_kernel.exe_path,
            env_uuid: env.uuid.clone(),
            cache_path: launch_paths.cache_path.clone(),
            cookies: normalize_cookies(detail.cookies),
            urls: normalize_urls(detail.urls),
            proxy,
            fingerprint_config: Some(fingerprint_config),
            accounts: normalize_accounts(detail.accounts),
            extensions: normalize_extensions(detail.extensions),
        })
    }
}

fn resolve_environment_proxy_config(
    app: &AppHandle,
    env_uuid: &str,
    remote_proxy: Option<EnvironmentProxyLike>,
) -> Result<Option<ProxyConfig>> {
    resolve_proxy_config(
        env_uuid,
        tauri_store::get_store_key_checked(app, ENVIRONMENT_LOCAL_PROXY_BINDINGS_STORE_KEY)?,
        tauri_store::get_store_key_checked(app, MIHOMO_LOCAL_PROXIES_STORE_KEY)?,
        remote_proxy,
    )
    .map_err(Into::into)
}

fn normalize_accounts(accounts: Option<Vec<AccountInfo>>) -> Option<Vec<AccountInfo>> {
    accounts.filter(|items| !items.is_empty())
}

fn normalize_extensions(extensions: Option<Vec<ExtensionInfo>>) -> Option<Vec<ExtensionInfo>> {
    extensions.filter(|items| !items.is_empty())
}

fn normalize_cookies(
    cookies: Option<Vec<self::types::EnvironmentCookieLike>>,
) -> Option<Vec<CookieGroup>> {
    let cookies = cookies?
        .into_iter()
        .map(|item| CookieGroup {
            site: item.site.trim().to_string(),
            cookie_text: item.cookie_text.trim().to_string(),
        })
        .filter(|item| !item.site.is_empty() && !item.cookie_text.is_empty())
        .collect::<Vec<_>>();

    if cookies.is_empty() {
        None
    } else {
        Some(cookies)
    }
}

fn normalize_urls(urls: Option<Vec<self::types::EnvironmentUrlLike>>) -> Option<Vec<String>> {
    let urls = urls?
        .into_iter()
        .map(|item| item.url)
        .map(|url| url.trim().to_string())
        .filter(|url| !url.is_empty())
        .collect::<Vec<_>>();

    if urls.is_empty() { None } else { Some(urls) }
}
