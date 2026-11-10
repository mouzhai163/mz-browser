mod detail;
mod fingerprint;
mod gpu_ids;
mod kernel;
mod paths;
mod proxy;
mod types;

use futures::future::try_join_all;
use tauri::{AppHandle, Manager};

use crate::{
    app::handle::get_app_handle,
    core::error::Result,
    domain::environment::KernelEngine,
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
            request.engine,
            request.env_uuid,
            request.cache_path,
            request.cookies,
            request.urls,
            request.proxy,
            request.fingerprint_config,
            request.accounts,
            request.extensions,
            request.exit_probe,
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
            request.engine,
            request.env_uuid,
            request.cache_path,
            request.cookies,
            request.urls,
            request.proxy,
            request.fingerprint_config,
            request.accounts,
            request.extensions,
            request.exit_probe,
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

        // 出口检测（语言/时区/定位“基于 IP”时要用）只依赖代理和指纹配置，和内核无关：
        // 跟内核校验（算 chrome.dll 哈希，必要时下载）同时做，不再排在它后面
        let probe_config = build_fingerprint_config(detail.config.as_ref());
        let (resolved_kernel, exit_probe) = tokio::join!(
            resolve_kernel_launch(
                app.clone(),
                &detail,
                &launch_paths.profiles_path,
                status_emitter.clone(),
            ),
            async {
                if crate::services::environment::kernel::network_fingerprint::needs_exit_probe(&probe_config) {
                    Some(
                        crate::services::environment::kernel::network_fingerprint::prefetch_exit(proxy.as_ref())
                            .await,
                    )
                } else {
                    None
                }
            }
        );
        let resolved_kernel = resolved_kernel?;

        let mut fingerprint_config = build_fingerprint_config(detail.config.as_ref());
        if let (Some(user_agent), Some(major)) =
            (fingerprint_config.user_agent.as_mut(), resolved_kernel.major_version)
        {
            *user_agent = match resolved_kernel.engine {
                KernelEngine::Chromium => kernel::align_user_agent_major(user_agent, major),
                KernelEngine::Gecko => kernel::firefox_user_agent(user_agent, major),
            };
        }
        // Client Hints 的完整版本号：环境创建时定下的那个（business::services::chrome_releases）。
        // 这个功能之前建的环境、或者内核换成了别的主版本时还没有合适的，这里挑一个存回去，以后不再变。
        if let (KernelEngine::Chromium, Some(major)) = (resolved_kernel.engine, resolved_kernel.major_version) {
            use business::services::chrome_releases;
            let stored = fingerprint_config
                .original_chrome_version
                .take()
                .filter(|version| chrome_releases::is_full_release_of(version, major));
            fingerprint_config.original_chrome_version = match stored {
                Some(version) => Some(version),
                None => {
                    let picked = chrome_releases::pick_random(major);
                    if let (Some(version), Ok(uuid)) = (&picked, uuid::Uuid::parse_str(&env_uuid)) {
                        let context = app.state::<business::svc_ctx::SvcCtx>();
                        if let Err(error) = business::models::set_window_info_string(
                            &context.db,
                            uuid,
                            chrome_releases::FULL_VERSION_KEY,
                            version,
                        )
                        .await
                        {
                            log::warn!("failed to save the Client Hints version for {env_uuid}: {error}");
                        }
                    }
                    picked
                }
            };
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
            engine: resolved_kernel.engine,
            env_uuid: env.uuid.clone(),
            cache_path: launch_paths.cache_path.clone(),
            cookies: normalize_cookies(detail.cookies),
            urls: normalize_urls(detail.urls),
            proxy,
            fingerprint_config: Some(fingerprint_config),
            accounts: normalize_accounts(detail.accounts),
            extensions: normalize_extensions(detail.extensions),
            exit_probe,
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
