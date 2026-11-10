//! 内核服务工具函数

use crate::core::error::Result;
use crate::domain::environment::{EnvironmentStatus, KernelEngine};
use sha2::{Digest, Sha256};
use std::fs;
use std::io;
use std::io::Read;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::SystemTime;

use super::types::{
    EVENT_KERNEL_PREPARE_STATUS, KernelPrepareStatusPayload, KernelStatusEmitter,
    LEGACY_SIGNATURE_HASH_SIZE, SIGNATURE_HASH_SIZE,
};

/// 解析有效的 profiles 根目录：若传入为空则使用应用默认
pub fn resolve_profiles_base(
    app: &tauri::AppHandle,
    profiles_path_override: &str,
) -> Result<PathBuf> {
    let base = profiles_path_override.trim();
    if !base.is_empty() {
        let p = PathBuf::from(base);
        if p.is_absolute() {
            return Ok(p);
        }
        let app_data = crate::core::paths::PathManager::get_app_data_dir(app)?;
        return Ok(app_data.join(base));
    }
    crate::core::paths::PathManager::get_profiles_dir(app).map_err(Into::into)
}

/// Resolve a catalog-provided installation directory without allowing it to
/// escape the profiles root.
pub fn resolve_kernel_install_dir(base: &Path, install_dir_name: &str) -> Result<PathBuf> {
    let install_dir_name = install_dir_name.trim();
    let mut components = Path::new(install_dir_name).components();
    match (components.next(), components.next()) {
        (Some(std::path::Component::Normal(_)), None) => Ok(base.join(install_dir_name)),
        _ => Err("内核安装目录名称无效".into()),
    }
}

/// 将 zip 解压到目标目录
pub fn extract_zip_to_dir(zip_path: &Path, target_dir: &Path) -> Result<()> {
    let file = fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(io::BufReader::new(file))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let name = entry.name().to_string();
        let out_path = target_dir.join(&name);

        if name.ends_with('/') || entry.is_dir() {
            fs::create_dir_all(&out_path)?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut out_file = fs::File::create(&out_path)?;
            std::io::copy(&mut entry, &mut out_file)?;
        }
    }
    Ok(())
}

/// 可执行文件名。Firefox 内核目前用 Camoufox 的发布包，主程序是 camoufox.exe。
pub fn exe_name(engine: KernelEngine) -> &'static str {
    match engine {
        #[cfg(target_os = "windows")]
        KernelEngine::Chromium => "mz.exe",
        #[cfg(not(target_os = "windows"))]
        KernelEngine::Chromium => "mz",
        #[cfg(target_os = "windows")]
        KernelEngine::Gecko => "camoufox.exe",
        #[cfg(not(target_os = "windows"))]
        KernelEngine::Gecko => "camoufox",
    }
}

/// 校验内核目录是否包含启动所需的文件。
///
/// Windows 版本的 MZ指纹浏览器 Chromium 会在主进程启动时拉起 Crashpad
/// handler；只校验 chrome.dll 的哈希无法发现缺少该子进程的残缺安装包。
/// 当前内核可将 Crashpad handler 集成在主程序中，因此这里只要求主程序存在。
pub fn validate_kernel_package_layout(kernel_dir: &Path, engine: KernelEngine) -> Result<()> {
    // Firefox 的核心库直接放在根目录，没有 Chromium 那样的版本子目录
    let required_files: &[&str] = match engine {
        KernelEngine::Chromium => &[exe_name(engine)],
        KernelEngine::Gecko => &[exe_name(engine), core_dll_name(engine)],
    };
    for &file_name in required_files {
        let path = kernel_dir.join(file_name);
        if !path.is_file() {
            return Err(format!("内核包不完整：缺少 {}", path.display()).into());
        }
    }

    Ok(())
}

/// 核心 DLL 文件名，内核签名就是它的整文件 SHA-256
pub fn core_dll_name(engine: KernelEngine) -> &'static str {
    match engine {
        #[cfg(target_os = "windows")]
        KernelEngine::Chromium => "chrome.dll",
        #[cfg(target_os = "macos")]
        KernelEngine::Chromium => "Chromium Framework",
        #[cfg(target_os = "linux")]
        KernelEngine::Chromium => "libchrome.so",
        #[cfg(target_os = "windows")]
        KernelEngine::Gecko => "xul.dll",
        #[cfg(target_os = "macos")]
        KernelEngine::Gecko => "XUL",
        #[cfg(target_os = "linux")]
        KernelEngine::Gecko => "libxul.so",
    }
}

/// 计算文件前 N 字节的 SHA256 哈希
pub fn calculate_file_hash_head(file_path: &Path, size: u64) -> Result<String> {
    let mut file = fs::File::open(file_path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1024 * 1024];
    let mut total_read = 0u64;

    while total_read < size {
        let to_read = std::cmp::min(buffer.len() as u64, size - total_read) as usize;
        let n = file.read(&mut buffer[..to_read])?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
        total_read += n as u64;
    }

    Ok(format!("{:x}", hasher.finalize()))
}

type SignatureCache = Mutex<HashMap<PathBuf, (u64, SystemTime, String)>>;

/// 整文件哈希的进程内缓存。chrome.dll 有 300 多 MB，每次启动环境都重算一遍太慢；
/// 文件的大小和修改时间都没变时直接用上次的结果。
fn signature_cache() -> &'static SignatureCache {
    static CACHE: OnceLock<SignatureCache> = OnceLock::new();
    CACHE.get_or_init(Default::default)
}

fn whole_file_signature(file_path: &Path) -> Result<String> {
    let metadata = fs::metadata(file_path)?;
    let (len, modified) = (metadata.len(), metadata.modified()?);
    {
        let cache = signature_cache().lock().unwrap_or_else(|error| error.into_inner());
        if let Some((cached_len, cached_modified, signature)) = cache.get(file_path) {
            if *cached_len == len && *cached_modified == modified {
                return Ok(signature.clone());
            }
        }
    }
    let signature = calculate_file_hash_head(file_path, SIGNATURE_HASH_SIZE)?.to_lowercase();
    signature_cache()
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .insert(file_path.to_path_buf(), (len, modified, signature.clone()));
    Ok(signature)
}

/// 用 `expected`（小写）校验核心 DLL，返回实际匹配上的那个签名。
/// 先按现行的整文件算法比对，比不上再按第一版的开头 10 MiB 算法比对。
pub fn matched_core_dll_signature(dll_path: &Path, expected: &[String]) -> Result<Option<String>> {
    let whole = whole_file_signature(dll_path)?;
    if expected.contains(&whole) {
        return Ok(Some(whole));
    }
    let head = calculate_file_hash_head(dll_path, LEGACY_SIGNATURE_HASH_SIZE)?.to_lowercase();
    Ok(expected.contains(&head).then_some(head))
}

/// 从 XML 内容中提取属性值
pub fn extract_xml_attribute(content: &str, attr_name: &str) -> Option<String> {
    let patterns = [format!("{}='", attr_name), format!("{}=\"", attr_name)];

    for pattern in &patterns {
        if let Some(start_idx) = content.find(pattern) {
            let value_start = start_idx + pattern.len();
            let quote_char = if pattern.ends_with('\'') { '\'' } else { '"' };
            if let Some(end_offset) = content[value_start..].find(quote_char) {
                let value = &content[value_start..value_start + end_offset];
                return Some(value.to_string());
            }
        }
    }
    None
}

/// 发送内核准备状态事件
pub fn build_tauri_status_emitter(app: tauri::AppHandle) -> KernelStatusEmitter {
    use tauri::Emitter;

    std::sync::Arc::new(move |payload: KernelPrepareStatusPayload| {
        let _ = app.emit(EVENT_KERNEL_PREPARE_STATUS, payload);
    })
}

pub fn emit_status(
    emitter: Option<&KernelStatusEmitter>,
    env_uuid: &Option<String>,
    kernel_value: &str,
    status: EnvironmentStatus,
    message: Option<&str>,
    progress_percent: Option<f64>,
    downloaded: Option<u64>,
    total: Option<u64>,
) {
    if let Some(emitter) = emitter {
        emitter(KernelPrepareStatusPayload {
            env_uuid: env_uuid.clone(),
            kernel_value: kernel_value.to_string(),
            status,
            message: message.map(String::from),
            progress_percent: progress_percent.filter(|&p| p >= 0.0 && p <= 100.0),
            downloaded,
            total,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::{core_dll_name, exe_name, resolve_kernel_install_dir, validate_kernel_package_layout};
    use crate::domain::environment::KernelEngine;
    use std::path::Path;

    #[test]
    fn kernel_install_dir_must_be_one_normal_component() {
        let base = Path::new("profiles");
        assert_eq!(
            resolve_kernel_install_dir(base, "Chrome 144").unwrap(),
            base.join("Chrome 144")
        );
        assert!(resolve_kernel_install_dir(base, "").is_err());
        assert!(resolve_kernel_install_dir(base, "..").is_err());
        assert!(resolve_kernel_install_dir(base, "nested/kernel").is_err());
    }

    #[test]
    fn rejects_kernel_without_browser_executable() {
        let dir = std::env::temp_dir().join(format!(
            "mz-kernel-layout-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();

        let result = validate_kernel_package_layout(&dir, KernelEngine::Chromium);
        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn accepts_kernel_without_standalone_crashpad_handler() {
        let dir = std::env::temp_dir().join(format!(
            "mz-kernel-layout-valid-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(exe_name(KernelEngine::Chromium)), b"test").unwrap();

        assert!(validate_kernel_package_layout(&dir, KernelEngine::Chromium).is_ok());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn firefox_kernel_needs_its_executable_and_xul_at_the_top_level() {
        let dir = std::env::temp_dir().join(format!("mz-gecko-layout-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(exe_name(KernelEngine::Gecko)), b"exe").unwrap();
        assert!(validate_kernel_package_layout(&dir, KernelEngine::Gecko).is_err());

        std::fs::write(dir.join(core_dll_name(KernelEngine::Gecko)), b"xul").unwrap();
        assert!(validate_kernel_package_layout(&dir, KernelEngine::Gecko).is_ok());
        // Chromium 的主程序名不一样，同一个目录不能当 Chromium 内核用
        assert!(validate_kernel_package_layout(&dir, KernelEngine::Chromium).is_err());
        let _ = std::fs::remove_dir_all(dir);
    }
}

#[cfg(test)]
mod head_hash_tests {
    use super::{calculate_file_hash_head, matched_core_dll_signature};
    use crate::services::environment::kernel::types::{
        LEGACY_SIGNATURE_HASH_SIZE, SIGNATURE_HASH_SIZE,
    };

    #[test]
    fn both_signature_formats_are_recognised() {
        let dir = std::env::temp_dir().join(format!("mz-sig-formats-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let dll = dir.join("chrome.dll");
        std::fs::write(&dll, vec![3u8; 11 * 1024 * 1024]).unwrap();
        let whole = calculate_file_hash_head(&dll, SIGNATURE_HASH_SIZE).unwrap();
        let head = calculate_file_hash_head(&dll, LEGACY_SIGNATURE_HASH_SIZE).unwrap();
        assert_ne!(whole, head);

        assert_eq!(
            matched_core_dll_signature(&dll, &[whole.clone()]).unwrap(),
            Some(whole.clone())
        );
        assert_eq!(
            matched_core_dll_signature(&dll, &[head.clone()]).unwrap(),
            Some(head)
        );
        assert_eq!(
            matched_core_dll_signature(&dll, &["0".repeat(64)]).unwrap(),
            None
        );

        // 内容变了就不能再用缓存的结果
        std::fs::write(&dll, vec![4u8; 12 * 1024 * 1024]).unwrap();
        assert_eq!(matched_core_dll_signature(&dll, &[whole]).unwrap(), None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_change_late_in_the_file_changes_the_signature() {
        let dir = std::env::temp_dir().join(format!("mz-sig-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let (a, b) = (dir.join("a.dll"), dir.join("b.dll"));
        let mut data = vec![7u8; 12 * 1024 * 1024];
        std::fs::write(&a, &data).unwrap();
        *data.last_mut().unwrap() = 8; // 只改最后一个字节，远在开头 10 MiB 之外
        std::fs::write(&b, &data).unwrap();
        assert_ne!(
            calculate_file_hash_head(&a, SIGNATURE_HASH_SIZE).unwrap(),
            calculate_file_hash_head(&b, SIGNATURE_HASH_SIZE).unwrap()
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
