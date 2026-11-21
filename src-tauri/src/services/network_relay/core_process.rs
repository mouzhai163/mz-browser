//! 内置托管 Mihomo 内核进程管理
//!
//! 负责：
//! - 解析内置内核路径、自动下载安装官方 Mihomo 内核、支持手动指定本地内核
//! - 动态生成托管 config.yaml（以 node.id 为唯一代理名，彻底避免重名冲突）
//! - 启动 / 重载 / 热切换中转节点 / 测速 / 退出清理

use std::io::{Cursor, Read};
use std::net::TcpListener as StdTcpListener;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use reqwest::Client;
use serde_json::{Value as JsonValue, json};
use serde_yaml::{Mapping, Sequence, Value as YamlValue};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use crate::core::paths::PathManager;

use super::types::{RelayCoreStatus, RelayNode};

const DEFAULT_MIXED_PORT: u16 = 17890;
const DEFAULT_CONTROLLER_PORT: u16 = 17891;
const DEFAULT_TEST_URL: &str = "https://www.gstatic.com/generate_204";
const DEFAULT_TEST_TIMEOUT_MS: u64 = 5000;
const RELAY_PROXY_GROUP: &str = "RELAY_EXIT";

struct ManagedProcess {
    child: Child,
    mixed_port: u16,
    controller_port: u16,
}

pub struct ManagedMihomoCore {
    process: Mutex<Option<ManagedProcess>>,
    last_error: Mutex<Option<String>>,
}

impl ManagedMihomoCore {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            last_error: Mutex::new(None),
        }
    }

    pub fn relay_dir() -> Result<PathBuf, String> {
        let dir = PathManager::get_root_dir()
            .map_err(|e| format!("获取应用根目录失败: {e}"))?
            .join("relay");
        std::fs::create_dir_all(&dir).map_err(|e| format!("创建中转内核目录失败: {e}"))?;
        Ok(dir)
    }

    pub fn default_core_path() -> Result<PathBuf, String> {
        let binary = if cfg!(target_os = "windows") {
            "mihomo.exe"
        } else {
            "mihomo"
        };
        Ok(Self::relay_dir()?.join(binary))
    }

    pub fn resolve_core_path(custom_path: Option<&str>) -> Result<PathBuf, String> {
        if let Some(path) = custom_path.map(str::trim).filter(|s| !s.is_empty()) {
            return Ok(PathBuf::from(path));
        }
        Self::default_core_path()
    }

    pub async fn status(&self, custom_path: Option<&str>) -> RelayCoreStatus {
        let core_path =
            Self::resolve_core_path(custom_path).unwrap_or_else(|_| PathBuf::from("mihomo.exe"));
        let installed = core_path.is_file();

        let mut guard = self.process.lock().await;
        let mut running = false;
        let mut mixed_port = DEFAULT_MIXED_PORT;
        let mut controller_port = DEFAULT_CONTROLLER_PORT;

        if let Some(proc) = guard.as_mut() {
            match proc.child.try_wait() {
                Ok(None) => {
                    running = true;
                    mixed_port = proc.mixed_port;
                    controller_port = proc.controller_port;
                }
                _ => {
                    *guard = None;
                }
            }
        }

        let error = self.last_error.lock().await.clone();

        RelayCoreStatus {
            installed,
            running,
            core_path: core_path.to_string_lossy().into_owned(),
            mixed_port,
            controller_port,
            error,
        }
    }

    /// 返回当前运行中的 mixed-port（如未运行返回 None）
    pub async fn running_mixed_port(&self) -> Option<u16> {
        let mut guard = self.process.lock().await;
        if let Some(proc) = guard.as_mut() {
            if matches!(proc.child.try_wait(), Ok(None)) {
                return Some(proc.mixed_port);
            }
            *guard = None;
        }
        None
    }

    /// 确保托管内核已启动并加载最新节点配置
    pub async fn sync_and_start(
        &self,
        custom_path: Option<&str>,
        nodes: &[RelayNode],
        selected_node_id: Option<&str>,
    ) -> Result<RelayCoreStatus, String> {
        let core_path = Self::resolve_core_path(custom_path)?;
        if !core_path.is_file() {
            let msg =
                "尚未安装内置中转内核，请先点击「一键安装内核」或手动选择 mihomo.exe".to_string();
            *self.last_error.lock().await = Some(msg.clone());
            return Err(msg);
        }

        let relay_dir = Self::relay_dir()?;
        let config_path = relay_dir.join("config.yaml");

        // 检查是否已经在运行
        let existing_ports = {
            let mut guard = self.process.lock().await;
            if let Some(proc) = guard.as_mut() {
                if matches!(proc.child.try_wait(), Ok(None)) {
                    Some((proc.mixed_port, proc.controller_port))
                } else {
                    *guard = None;
                    None
                }
            } else {
                None
            }
        };

        let (mixed_port, controller_port, already_running) = match existing_ports {
            Some((mp, cp)) => (mp, cp, true),
            None => {
                let mp = pick_available_port(DEFAULT_MIXED_PORT)
                    .ok_or_else(|| "无法分配本地中转端口".to_string())?;
                let cp = pick_available_port(mp.saturating_add(1).max(DEFAULT_CONTROLLER_PORT))
                    .ok_or_else(|| "无法分配本地控制端口".to_string())?;
                (mp, cp, false)
            }
        };

        let yaml = build_managed_config_yaml(mixed_port, controller_port, nodes, selected_node_id)?;
        tokio::fs::write(&config_path, yaml)
            .await
            .map_err(|e| format!("写入中转内核配置失败: {e}"))?;

        if already_running {
            if let Err(err) = reload_via_api(controller_port, &config_path).await {
                log::warn!("reload managed mihomo failed, restarting: {err}");
                self.stop().await;
                self.spawn_process(
                    &core_path,
                    &relay_dir,
                    &config_path,
                    mixed_port,
                    controller_port,
                )
                .await?;
            }
        } else {
            self.spawn_process(
                &core_path,
                &relay_dir,
                &config_path,
                mixed_port,
                controller_port,
            )
            .await?;
        }

        if let Some(node_id) = selected_node_id {
            let _ = select_proxy_via_api(controller_port, node_id).await;
        }

        *self.last_error.lock().await = None;
        Ok(self.status(custom_path).await)
    }

    /// 热切换当前选中的中转节点（毫秒级，无需重启进程）
    pub async fn switch_active_node(&self, node_id: &str) -> Result<(), String> {
        let controller_port = {
            let mut guard = self.process.lock().await;
            if let Some(proc) = guard.as_mut() {
                if matches!(proc.child.try_wait(), Ok(None)) {
                    proc.controller_port
                } else {
                    *guard = None;
                    return Err("中转内核未运行".to_string());
                }
            } else {
                return Err("中转内核未运行".to_string());
            }
        };
        select_proxy_via_api(controller_port, node_id).await
    }

    /// 通过托管 Mihomo 控制器测试单个节点延迟
    pub async fn test_node_delay(&self, node_id: &str) -> Result<Option<u32>, String> {
        let controller_port = {
            let mut guard = self.process.lock().await;
            if let Some(proc) = guard.as_mut() {
                if matches!(proc.child.try_wait(), Ok(None)) {
                    proc.controller_port
                } else {
                    *guard = None;
                    return Err("中转内核未运行，请先启用或启动中转内核".to_string());
                }
            } else {
                return Err("中转内核未运行，请先启用或启动中转内核".to_string());
            }
        };

        let encoded = url_encode_segment(node_id);
        let url = format!(
            "http://127.0.0.1:{controller_port}/proxies/{encoded}/delay?url={}&timeout={DEFAULT_TEST_TIMEOUT_MS}",
            url_encode_segment(DEFAULT_TEST_URL)
        );
        let client = Client::builder()
            .no_proxy()
            .timeout(Duration::from_millis(DEFAULT_TEST_TIMEOUT_MS + 1500))
            .build()
            .map_err(|e| e.to_string())?;

        let response = match client.get(&url).send().await {
            Ok(resp) => resp,
            Err(_) => return Ok(None),
        };
        if !response.status().is_success() {
            return Ok(None);
        }
        let body: JsonValue = response.json().await.unwrap_or_default();
        let delay = body
            .get("delay")
            .and_then(|v| v.as_u64())
            .and_then(|d| u32::try_from(d).ok())
            .filter(|&d| d > 0);
        Ok(delay)
    }

    /// 停止托管内核进程
    pub async fn stop(&self) {
        let mut guard = self.process.lock().await;
        if let Some(mut proc) = guard.take() {
            let _ = proc.child.kill().await;
            let _ = proc.child.wait().await;
        }
    }

    async fn spawn_process(
        &self,
        core_path: &Path,
        relay_dir: &Path,
        config_path: &Path,
        mixed_port: u16,
        controller_port: u16,
    ) -> Result<(), String> {
        let mut cmd = Command::new(core_path);
        cmd.arg("-d")
            .arg(relay_dir)
            .arg("-f")
            .arg(config_path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd.spawn().map_err(|e| {
            let msg = format!("启动内置中转内核失败: {e}");
            msg
        })?;

        // 等待控制器就绪（最多 5 秒）
        let client = Client::builder()
            .no_proxy()
            .timeout(Duration::from_millis(500))
            .build()
            .map_err(|e| e.to_string())?;
        let health_url = format!("http://127.0.0.1:{controller_port}/version");

        let mut ready = false;
        for _ in 0..25 {
            if let Ok(Some(exit)) = child.try_wait() {
                let msg = format!("内置中转内核启动后异常退出 (code={:?})", exit.code());
                *self.last_error.lock().await = Some(msg.clone());
                return Err(msg);
            }
            if let Ok(resp) = client.get(&health_url).send().await {
                if resp.status().is_success() {
                    ready = true;
                    break;
                }
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }

        if !ready {
            let _ = child.kill().await;
            let msg = "内置中转内核启动超时，请检查配置或杀毒软件拦截".to_string();
            *self.last_error.lock().await = Some(msg.clone());
            return Err(msg);
        }

        let mut guard = self.process.lock().await;
        if let Some(mut old) = guard.replace(ManagedProcess {
            child,
            mixed_port,
            controller_port,
        }) {
            let _ = old.child.kill().await;
        }
        Ok(())
    }

    /// 自动下载官方 Mihomo 内核二进制到内置目录
    pub async fn install_builtin_core(&self) -> Result<PathBuf, String> {
        let target_path = Self::default_core_path()?;
        if target_path.is_file() {
            return Ok(target_path);
        }

        let client = Client::builder()
            .timeout(Duration::from_secs(90))
            .user_agent("MZBrowser/1.0")
            .build()
            .map_err(|e| format!("创建下载客户端失败: {e}"))?;

        // 获取最新 release 信息（依次尝试直连与镜像）
        let release_urls = ["https://api.github.com/repos/MetaCubeX/mihomo/releases/latest"];

        let mut download_url: Option<String> = None;
        for api_url in release_urls {
            if let Ok(resp) = client.get(api_url).send().await {
                if resp.status().is_success() {
                    if let Ok(json_val) = resp.json::<JsonValue>().await {
                        if let Some(url) = pick_release_asset_url(&json_val) {
                            download_url = Some(url);
                            break;
                        }
                    }
                }
            }
        }

        // 兜底固定稳定版本链接（避免 GitHub API 限流）
        let fallback_url = default_fallback_download_url();
        let primary_url = download_url.unwrap_or_else(|| fallback_url.clone());

        let candidate_urls = vec![
            primary_url.clone(),
            format!("https://gh-proxy.com/{primary_url}"),
            format!("https://mirror.ghproxy.com/{primary_url}"),
        ];

        let mut archive_bytes: Option<Vec<u8>> = None;
        let mut last_err = String::new();
        for url in &candidate_urls {
            log::info!("尝试下载内置 Mihomo 内核: {url}");
            match client.get(url).send().await {
                Ok(resp) if resp.status().is_success() => match resp.bytes().await {
                    Ok(bytes) if bytes.len() > 1024 * 1024 => {
                        archive_bytes = Some(bytes.to_vec());
                        break;
                    }
                    Ok(_) => last_err = "下载的文件内容不完整".to_string(),
                    Err(e) => last_err = e.to_string(),
                },
                Ok(resp) => last_err = format!("HTTP {}", resp.status()),
                Err(e) => last_err = e.to_string(),
            }
        }

        let bytes = archive_bytes.ok_or_else(|| {
            format!("自动下载内置内核失败（{last_err}）。你可以手动下载 mihomo.exe 并在界面点击「导入内核」")
        })?;

        extract_mihomo_binary(&bytes, &target_path)?;
        *self.last_error.lock().await = None;
        Ok(target_path)
    }
}

impl Default for ManagedMihomoCore {
    fn default() -> Self {
        Self::new()
    }
}

fn build_managed_config_yaml(
    mixed_port: u16,
    controller_port: u16,
    nodes: &[RelayNode],
    selected_node_id: Option<&str>,
) -> Result<String, String> {
    let mut root = Mapping::new();
    root.insert(
        YamlValue::String("mixed-port".into()),
        YamlValue::Number(serde_yaml::Number::from(mixed_port)),
    );
    root.insert(
        YamlValue::String("allow-lan".into()),
        YamlValue::Bool(false),
    );
    root.insert(
        YamlValue::String("bind-address".into()),
        YamlValue::String("127.0.0.1".into()),
    );
    root.insert(
        YamlValue::String("mode".into()),
        YamlValue::String("rule".into()),
    );
    root.insert(
        YamlValue::String("log-level".into()),
        YamlValue::String("warning".into()),
    );
    root.insert(
        YamlValue::String("external-controller".into()),
        YamlValue::String(format!("127.0.0.1:{controller_port}")),
    );
    root.insert(YamlValue::String("ipv6".into()), YamlValue::Bool(false));

    let mut proxies_seq = Sequence::new();
    let mut group_members = Sequence::new();

    // 如果有选中节点，排在最前面作为默认选中
    if let Some(sel_id) = selected_node_id {
        if nodes.iter().any(|n| n.id == sel_id) {
            group_members.push(YamlValue::String(sel_id.to_string()));
        }
    }

    for node in nodes {
        let mut raw = node.raw_proxy.clone();
        if let Some(obj) = raw.as_object_mut() {
            // 使用 node.id 作为 Mihomo 内部唯一名称，防止重名冲突
            obj.insert("name".into(), json!(node.id));
        }
        if let Ok(yaml_proxy) = serde_yaml::to_value(&raw) {
            proxies_seq.push(yaml_proxy);
            if selected_node_id != Some(node.id.as_str()) {
                group_members.push(YamlValue::String(node.id.clone()));
            }
        }
    }

    group_members.push(YamlValue::String("DIRECT".into()));

    root.insert(
        YamlValue::String("proxies".into()),
        YamlValue::Sequence(proxies_seq),
    );

    let mut relay_group = Mapping::new();
    relay_group.insert(
        YamlValue::String("name".into()),
        YamlValue::String(RELAY_PROXY_GROUP.into()),
    );
    relay_group.insert(
        YamlValue::String("type".into()),
        YamlValue::String("select".into()),
    );
    relay_group.insert(
        YamlValue::String("proxies".into()),
        YamlValue::Sequence(group_members),
    );

    let mut groups_seq = Sequence::new();
    groups_seq.push(YamlValue::Mapping(relay_group));
    root.insert(
        YamlValue::String("proxy-groups".into()),
        YamlValue::Sequence(groups_seq),
    );

    let mut rules_seq = Sequence::new();
    rules_seq.push(YamlValue::String(format!("MATCH,{RELAY_PROXY_GROUP}")));
    root.insert(
        YamlValue::String("rules".into()),
        YamlValue::Sequence(rules_seq),
    );

    serde_yaml::to_string(&YamlValue::Mapping(root))
        .map_err(|e| format!("序列化中转内核配置失败: {e}"))
}

async fn reload_via_api(controller_port: u16, config_path: &Path) -> Result<(), String> {
    let client = Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!("http://127.0.0.1:{controller_port}/configs?force=true");
    let resp = client
        .put(&url)
        .json(&json!({ "path": config_path.to_string_lossy() }))
        .send()
        .await
        .map_err(|e| format!("重载请求失败: {e}"))?;
    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Mihomo 重载返回错误: {text}"));
    }
    Ok(())
}

async fn select_proxy_via_api(controller_port: u16, node_id: &str) -> Result<(), String> {
    let client = Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!("http://127.0.0.1:{controller_port}/proxies/{RELAY_PROXY_GROUP}");
    let resp = client
        .put(&url)
        .json(&json!({ "name": node_id }))
        .send()
        .await
        .map_err(|e| format!("切换中转节点失败: {e}"))?;
    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("切换中转节点失败: {text}"));
    }
    Ok(())
}

fn pick_available_port(start: u16) -> Option<u16> {
    for port in start..start.saturating_add(200) {
        if StdTcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Some(port);
        }
    }
    StdTcpListener::bind(("127.0.0.1", 0))
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
}

fn pick_release_asset_url(release: &JsonValue) -> Option<String> {
    let assets = release.get("assets")?.as_array()?;
    let target_patterns: &[&str] = if cfg!(target_os = "windows") {
        &[
            "mihomo-windows-amd64-compatible-v",
            "mihomo-windows-amd64-v",
        ]
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            &["mihomo-darwin-arm64-v"]
        } else {
            &["mihomo-darwin-amd64-v"]
        }
    } else {
        &["mihomo-linux-amd64-compatible-v", "mihomo-linux-amd64-v"]
    };

    for pattern in target_patterns {
        for asset in assets {
            let name = asset.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if name.starts_with(pattern) && name.ends_with(".zip") {
                if let Some(url) = asset.get("browser_download_url").and_then(|v| v.as_str()) {
                    return Some(url.to_string());
                }
            }
        }
    }
    None
}

fn default_fallback_download_url() -> String {
    if cfg!(target_os = "windows") {
        "https://github.com/MetaCubeX/mihomo/releases/download/v1.19.2/mihomo-windows-amd64-compatible-v1.19.2.zip".to_string()
    } else if cfg!(target_os = "macos") {
        "https://github.com/MetaCubeX/mihomo/releases/download/v1.19.2/mihomo-darwin-arm64-v1.19.2.gz".to_string()
    } else {
        "https://github.com/MetaCubeX/mihomo/releases/download/v1.19.2/mihomo-linux-amd64-compatible-v1.19.2.gz".to_string()
    }
}

fn extract_mihomo_binary(archive_bytes: &[u8], target_path: &Path) -> Result<(), String> {
    let cursor = Cursor::new(archive_bytes);
    let mut zip =
        zip::ZipArchive::new(cursor).map_err(|e| format!("解压 Mihomo 压缩包失败: {e}"))?;

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_ascii_lowercase();
        let is_binary = if cfg!(target_os = "windows") {
            name.ends_with(".exe")
        } else {
            !entry.is_dir() && name.contains("mihomo")
        };

        if is_binary {
            let mut out = Vec::new();
            entry.read_to_end(&mut out).map_err(|e| format!("读取解压文件失败: {e}"))?;
            std::fs::write(target_path, out).map_err(|e| format!("保存内置内核失败: {e}"))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ =
                    std::fs::set_permissions(target_path, std::fs::Permissions::from_mode(0o755));
            }
            return Ok(());
        }
    }

    Err("压缩包中未找到 mihomo 可执行文件".to_string())
}

fn url_encode_segment(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
