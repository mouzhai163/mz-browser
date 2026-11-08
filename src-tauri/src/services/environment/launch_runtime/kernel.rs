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

/// 环境创建时写入的 UA 带着当时内核的版本号；之后换了内核，UA 里的 Chrome/NNN 会和真实内核对不上，
/// 这里把主版本号改成当前内核的，其余部分（系统、Safari/537.36 等）原样保留。
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
    format!("{}{}{}", &user_agent[..digits_start], kernel_major, &rest[digits_len..])
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
    fn only_the_chrome_major_is_replaced() {
        let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";
        assert_eq!(
            align_user_agent_major(ua, 159),
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/159.0.0.0 Safari/537.36"
        );
        assert_eq!(align_user_agent_major("custom agent", 159), "custom agent");
        assert_eq!(align_user_agent_major("Chrome/x.0", 159), "Chrome/x.0");
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
