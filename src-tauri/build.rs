use std::env;
use std::fs;

use serde::Deserialize;

// =============================================================================
// 入口：构建脚本执行流程
// =============================================================================

fn main() {
    println!("cargo:rerun-if-env-changed=MZ_WEBVIEW_MODE");
    println!("cargo:rerun-if-changed=tauri.conf.json");

    let webview_mode =
        env::var("MZ_WEBVIEW_MODE").unwrap_or_else(|_| "embedBootstrapper".to_string());
    validate_selected_tauri_config(&webview_mode);
    println!("cargo:rustc-env=MZ_WEBVIEW_MODE={webview_mode}");

    // 构建 Tauri 应用（处理 Windows manifest / 权限等）
    tauri_build_pipeline::build_tauri();

    // The library test harness does not receive Tauri's binary-only .res file.
    // rfd imports TaskDialogIndirect, which requires Common Controls v6 at load
    // time. Embed the dependency for test harnesses as well as application bins.
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'"
        );
        // The main binary already has Tauri's complete manifest in resource.lib.
        // Do not generate a second RT_MANIFEST resource with the same ID there.
        println!("cargo:rustc-link-arg-bin=mz-browser=/MANIFEST:NO");
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SelectedTauriConfig {
    bundle: SelectedBundleConfig,
    plugins: SelectedPluginConfig,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SelectedBundleConfig {
    create_updater_artifacts: bool,
    windows: SelectedWindowsConfig,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SelectedWindowsConfig {
    webview_install_mode: SelectedWebviewInstallMode,
}

#[derive(Deserialize)]
struct SelectedWebviewInstallMode {
    #[serde(rename = "type")]
    kind: String,
    path: Option<String>,
}

#[derive(Deserialize)]
struct SelectedPluginConfig {
    updater: SelectedUpdaterConfig,
}

#[derive(Deserialize)]
struct SelectedUpdaterConfig {
    endpoints: Vec<String>,
}

fn validate_selected_tauri_config(mode: &str) {
    let raw = fs::read_to_string("tauri.conf.json")
        .unwrap_or_else(|err| panic!("failed to read selected Tauri config: {err}"));
    let config: SelectedTauriConfig = serde_json::from_str(&raw)
        .unwrap_or_else(|err| panic!("failed to parse selected Tauri config: {err}"));

    let (expected_install_mode, expected_manifest) = match mode {
        "embedBootstrapper" => ("embedBootstrapper", "latest.json"),
        "fixed-runtime" => ("fixedRuntime", "latest-fixed.json"),
        other => panic!(
            "unsupported MZ_WEBVIEW_MODE '{other}'; expected embedBootstrapper or fixed-runtime"
        ),
    };

    assert_eq!(
        config.bundle.windows.webview_install_mode.kind, expected_install_mode,
        "selected Tauri config does not match MZ_WEBVIEW_MODE '{mode}'"
    );
    assert!(
        config.bundle.create_updater_artifacts,
        "selected Tauri config must create signed updater artifacts"
    );

    let endpoint = config
        .plugins
        .updater
        .endpoints
        .first()
        .unwrap_or_else(|| panic!("selected Tauri config is missing an updater endpoint"));
    assert!(
        endpoint.ends_with(expected_manifest),
        "updater endpoint for mode '{mode}' must end with '{expected_manifest}'"
    );

    if mode == "fixed-runtime" {
        let expected_runtime_directory = fixed_runtime_directory_for_target_arch();
        let configured_path = config
            .bundle
            .windows
            .webview_install_mode
            .path
            .as_deref()
            .unwrap_or_else(|| panic!("fixed-runtime config is missing its WebView path"));
        let normalized_path = configured_path.replace('\\', "/");

        assert!(
            normalized_path.trim_end_matches('/').ends_with(expected_runtime_directory),
            "fixed-runtime path '{configured_path}' does not match target architecture directory '{expected_runtime_directory}'"
        );
    }
}

fn fixed_runtime_directory_for_target_arch() -> &'static str {
    match env::var("CARGO_CFG_TARGET_ARCH").as_deref() {
        Ok("x86_64") => "Microsoft.WebView2.FixedVersionRuntime.151.0.4129.78.x64",
        Ok("aarch64") => "Microsoft.WebView2.FixedVersionRuntime.151.0.4129.78.arm64",
        Ok("x86") => "Microsoft.WebView2.FixedVersionRuntime.151.0.4129.78.x86",
        Ok(arch) => panic!("unsupported Windows target architecture '{arch}' for fixed-runtime"),
        Err(err) => panic!("CARGO_CFG_TARGET_ARCH is unavailable: {err}"),
    }
}

// =============================================================================
// Tauri 应用构建（Windows manifest / 权限等）
// =============================================================================

mod tauri_build_pipeline {
    /// 构建 tauri 应用，处理不同平台下的 manifest / 权限等
    pub fn build_tauri() {
        // 开发环境不需要管理员权限，发布环境需要管理员权限
        #[cfg(target_os = "windows")]
        {
            // let is_dev = cfg!(debug_assertions);
            let is_dev = true; // 暂时跳过软件管理员申请，再后续评估再决定是否需要管理员。

            if !is_dev {
                // 发布环境：需要管理员权限. (主程序manifest)
                let manifest = include_str!("windows/main.manifest");
                let window_attributes =
                    tauri_build::WindowsAttributes::new().app_manifest(manifest);
                let attrs = tauri_build::Attributes::new().windows_attributes(window_attributes);
                tauri_build::try_build(attrs).unwrap_or_else(|e| {
                    panic!(
                        "[BUILD ERROR] Tauri build failed: {}\n\
                         Please check your Tauri configuration and dependencies.",
                        e
                    );
                });
            } else {
                // 开发环境：不需要管理员权限。
                tauri_build::build();
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            tauri_build::build();
        }
    }
}
