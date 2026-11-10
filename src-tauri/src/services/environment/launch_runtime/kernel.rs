use serde_json::Value;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::{
    core::error::Result,
    domain::environment::{KernelDetail, KernelEngine},
    services::environment::{KernelService, KernelStatusEmitter},
};

use super::types::EnvironmentLaunchDetail;

pub(super) struct ResolvedKernelLaunch {
    pub exe_path: String,
    pub engine: KernelEngine,
    /// 内核主版本号（来自安装目录名 "Chrome 159"），用来让 UA 的版本号和实际内核一致
    pub major_version: Option<u32>,
}

/// "Chrome 159" / "Firefox 158" -> Some(159) / Some(158)
fn kernel_major_from_dir_name(name: &str) -> Option<u32> {
    let digits: String = name.chars().skip_while(|c| !c.is_ascii_digit()).take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().ok().filter(|major| (50..1000).contains(major))
}

/// 把 UA 整理成真实 Chrome 现在发出的样子：
/// - 版本号固定为 `主版本.0.0.0`（Chrome 的 UA 精简策略，完整版本只出现在 Client Hints 里）；
/// - 主版本号取当前内核的，环境创建之后换了内核也不会对不上；
/// - 系统部分只会是三种固定写法：Windows 恒为 NT 10.0，macOS 恒为 10_15_7，Linux 恒为 x86_64。
pub(super) fn align_user_agent_major(user_agent: &str, kernel_major: u32) -> String {
    let marker = "Chrome/";
    let Some(start) = user_agent.find(marker) else {
        return user_agent.to_string();
    };
    let digits_start = start + marker.len();
    let rest = &user_agent[digits_start..];
    let digits_len = rest.chars().take_while(|c| c.is_ascii_digit()).count();
    if digits_len == 0 || rest.as_bytes().get(digits_len) != Some(&b'.') {
        return user_agent.to_string();
    }
    let token_end = rest.find(' ').unwrap_or(rest.len());
    let aligned = format!("{}{}.0.0.0{}", &user_agent[..digits_start], kernel_major, &rest[token_end..]);
    // Edge 和 Chrome 主版本相同，Opera 比 Chrome 小 14（和前端生成器的规则一致）；Vivaldi 的版本号是独立的，不动。
    let aligned = align_brand_version(&aligned, "Edg/", kernel_major);
    let aligned = align_brand_version(&aligned, "OPR/", kernel_major.saturating_sub(14));
    canonical_platform_token(&aligned)
}

/// Firefox 内核的 UA：只保留系统（Windows / macOS / Linux），其余按真实 Firefox 的固定格式重写。
/// 环境原来是 Chrome 的 UA（比如后来换成了 Firefox 内核）也照样换成 Firefox 的。
pub(super) fn firefox_user_agent(user_agent: &str, kernel_major: u32) -> String {
    let platform = if user_agent.contains("Macintosh") || user_agent.contains("Mac OS X") {
        "Macintosh; Intel Mac OS X 10.15"
    } else if user_agent.contains("X11") || user_agent.contains("Linux") {
        "X11; Linux x86_64"
    } else {
        "Windows NT 10.0; Win64; x64"
    };
    format!("Mozilla/5.0 ({platform}; rv:{kernel_major}.0) Gecko/20100101 Firefox/{kernel_major}.0")
}

fn align_brand_version(user_agent: &str, marker: &str, major: u32) -> String {
    let Some(start) = user_agent.find(marker) else {
        return user_agent.to_string();
    };
    let version_start = start + marker.len();
    let rest = &user_agent[version_start..];
    let token_end = rest.find(' ').unwrap_or(rest.len());
    if !rest[..token_end].starts_with(|c: char| c.is_ascii_digit()) {
        return user_agent.to_string();
    }
    format!("{}{major}.0.0.0{}", &user_agent[..version_start], &rest[token_end..])
}

fn canonical_platform_token(user_agent: &str) -> String {
    let (Some(open), Some(close)) = (user_agent.find('('), user_agent.find(')')) else {
        return user_agent.to_string();
    };
    if close < open {
        return user_agent.to_string();
    }
    let inner = &user_agent[open + 1..close];
    let canonical = if inner.starts_with("Windows") {
        "Windows NT 10.0; Win64; x64"
    } else if inner.starts_with("Macintosh") {
        "Macintosh; Intel Mac OS X 10_15_7"
    } else if inner.starts_with("X11") {
        "X11; Linux x86_64"
    } else {
        return user_agent.to_string();
    };
    format!("{}{}{}", &user_agent[..open + 1], canonical, &user_agent[close..])
}

#[cfg(test)]
mod ua_tests {
    use super::{align_user_agent_major, kernel_major_from_dir_name};

    #[test]
    fn major_is_read_from_the_install_dir_name() {
        assert_eq!(kernel_major_from_dir_name("Chrome 159"), Some(159));
        assert_eq!(kernel_major_from_dir_name("Chrome 156"), Some(156));
        assert_eq!(kernel_major_from_dir_name("Firefox"), None);
        assert_eq!(kernel_major_from_dir_name(""), None);
    }

    #[test]
    fn version_is_reduced_to_the_kernel_major() {
        let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.6543.118 Safari/537.36";
        assert_eq!(
            align_user_agent_major(ua, 159),
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/159.0.0.0 Safari/537.36"
        );
        assert_eq!(align_user_agent_major("custom agent", 159), "custom agent");
        assert_eq!(align_user_agent_major("Chrome/x.0", 159), "Chrome/x.0");
    }

    #[test]
    fn edge_and_opera_versions_follow_the_kernel() {
        let edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.8078.94 Safari/537.36 Edg/156.0.5276.77";
        assert!(align_user_agent_major(edge, 159).ends_with("Chrome/159.0.0.0 Safari/537.36 Edg/159.0.0.0"));
        let opera = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 OPR/142.0.8000.70";
        assert!(align_user_agent_major(opera, 159).ends_with("Chrome/159.0.0.0 Safari/537.36 OPR/145.0.0.0"));
        let vivaldi = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Vivaldi/7.1.3200.5";
        assert!(align_user_agent_major(vivaldi, 159).ends_with("Vivaldi/7.1.3200.5"));
    }

    #[test]
    fn firefox_kernels_get_a_firefox_user_agent_for_the_same_system() {
        let chrome_win = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";
        assert_eq!(
            super::firefox_user_agent(chrome_win, 158),
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0"
        );
        let old_firefox_mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:133.0) Gecko/20100101 Firefox/133.0";
        assert_eq!(
            super::firefox_user_agent(old_firefox_mac, 158),
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:158.0) Gecko/20100101 Firefox/158.0"
        );
        assert!(super::firefox_user_agent("Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:120.0)", 158)
            .starts_with("Mozilla/5.0 (X11; Linux x86_64; rv:158.0)"));
        assert_eq!(kernel_major_from_dir_name("Firefox 158"), Some(158));
    }

    #[test]
    fn platform_part_is_one_of_the_three_real_chrome_strings() {
        let mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.6000.1 Safari/537.36";
        assert!(align_user_agent_major(mac, 158).contains("(Macintosh; Intel Mac OS X 10_15_7)"));
        let linux = "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.6000.1 Safari/537.36";
        assert!(align_user_agent_major(linux, 158).contains("(X11; Linux x86_64)"));
        let old_win = "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36";
        assert!(align_user_agent_major(old_win, 158).contains("(Windows NT 10.0; Win64; x64)"));
    }
}

pub(super) async fn resolve_kernel_launch(
    app: AppHandle,
    detail: &EnvironmentLaunchDetail,
    profiles_path: &str,
    status_emitter: Option<KernelStatusEmitter>,
) -> Result<ResolvedKernelLaunch> {
    let env = detail
        .environment
        .as_ref()
        .ok_or("Environment detail is missing environment uuid.")?;
    let environment_uuid = Uuid::parse_str(&env.uuid)
        .map_err(|error| format!("Invalid environment uuid {}: {error}", env.uuid))?;
    let context = app.state::<business::svc_ctx::SvcCtx>();
    let kernel_detail =
        business::services::browser_kernels::get_environment_kernel(&context.db, environment_uuid)
            .await?
            .ok_or("This environment has no browser kernel binding.")?;
    let kernel_id = kernel_detail.kernel_id.clone();
    let engine = KernelEngine::from_type_code(&kernel_detail.type_code);
    let install_dir_name = kernel_detail.install_dir_name.clone();
    let major_version = kernel_major_from_dir_name(&install_dir_name);

    let url = kernel_detail
        .url
        .filter(|value| !value.trim().is_empty())
        .ok_or("The selected browser kernel is missing download metadata.")?;
    let hash = kernel_detail.hash;
    let signature = kernel_detail.signature;
    let compatible_signatures = kernel_detail.compatible_signatures.0;

    let exe_path = KernelService::ensure_kernel_ready_for_artifact(
        app,
        Some(env.uuid.clone()),
        kernel_id,
        install_dir_name,
        profiles_path.to_string(),
        KernelDetail {
            engine,
            url,
            hash,
            signature: Some(signature),
            compatible_signatures,
            requires_extract: kernel_detail.requires_extract,
        },
        status_emitter,
    )
    .await?;

    Ok(ResolvedKernelLaunch { exe_path, engine, major_version })
}

pub(super) fn get_window_info(config: Option<&Value>) -> serde_json::Map<String, Value> {
    config
        .and_then(|config| config.get("window_info"))
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}
