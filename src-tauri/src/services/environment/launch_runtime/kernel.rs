use serde_json::Value;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::{
    core::error::Result,
    domain::environment::KernelDetail,
    services::environment::{KernelService, KernelStatusEmitter},
};

use super::types::EnvironmentLaunchDetail;

pub(super) struct ResolvedKernelLaunch {
    pub exe_path: String,
    /// 内核主版本号（来自安装目录名 "Chrome 159"），用来让 UA 的版本号和实际内核一致
    pub major_version: Option<u32>,
}

/// "Chrome 159" -> Some(159)
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
    canonical_platform_token(&aligned)
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
            url,
            hash,
            signature: Some(signature),
            compatible_signatures,
            requires_extract: kernel_detail.requires_extract,
        },
        status_emitter,
    )
    .await?;

    Ok(ResolvedKernelLaunch { exe_path, major_version })
}

pub(super) fn get_window_info(config: Option<&Value>) -> serde_json::Map<String, Value> {
    config
        .and_then(|config| config.get("window_info"))
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}
