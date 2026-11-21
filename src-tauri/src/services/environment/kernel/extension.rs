//! 浏览器扩展下载与安装模块

use crate::core::error::Result;
use std::fs;
use std::path::Path;

/// 最大并发下载数
const MAX_CONCURRENT_DOWNLOADS: usize = 4;

/// 下载重试次数
const DOWNLOAD_RETRY_COUNT: u32 = 3;

/// 安装扩展到 user_data_dir
/// 返回解压后的扩展目录列表，用于 --load-extension 参数
pub async fn install_extensions(
    app: &tauri::AppHandle,
    env_id: &str,
    cache_path: &str,
    user_data_dir: &Path,
    extensions: Vec<super::types::ExtensionInfo>,
) -> Result<Vec<String>> {
    if extensions.is_empty() {
        return Ok(vec![]);
    }

    crate::log_info!(
        crate::core::logger::modules::KERNEL,
        "开始为环境 {} 安装 {} 个扩展",
        env_id,
        extensions.len()
    );

    // CRX 文件下载目录：cache_path/browser/extensions
    let crx_download_dir = std::path::PathBuf::from(cache_path).join("browser").join("extensions");
    fs::create_dir_all(&crx_download_dir)?;

    // 临时解压目录：user_data_dir/temp_extensions
    let temp_extensions_dir = user_data_dir.join("temp_extensions");
    fs::create_dir_all(&temp_extensions_dir)?;

    // 使用 futures 的 stream 实现并发下载
    use futures::stream::{self, StreamExt};

    let results: Vec<Result<String>> = stream::iter(extensions)
        .map(|ext| {
            let app = app.clone();
            let env_id = env_id.to_string();
            let crx_download_dir = crx_download_dir.clone();
            let temp_extensions_dir = temp_extensions_dir.clone();

            async move {
                crate::log_info!(
                    crate::core::logger::modules::KERNEL,
                    "安装扩展: {} ({})",
                    ext.name,
                    ext.extension_id
                );

                // CRX 文件路径
                let crx_filename = format!("{}_{}.crx", ext.extension_id, ext.version);
                let crx_path = crx_download_dir.join(&crx_filename);

                // 检查本地是否已有 CRX 文件，并校验 hash
                let need_download = if crx_path.exists() {
                    match verify_extension_hash(&crx_path, &ext.hash) {
                        Ok(_) => {
                            crate::log_info!(
                                crate::core::logger::modules::KERNEL,
                                "扩展 {} 已存在且校验通过，跳过下载",
                                ext.name
                            );
                            false
                        }
                        Err(e) => {
                            crate::log_warn!(
                                crate::core::logger::modules::KERNEL,
                                "扩展 {} 校验失败: {}，重新下载",
                                ext.name,
                                e
                            );
                            let _ = fs::remove_file(&crx_path);
                            true
                        }
                    }
                } else {
                    true
                };

                // 获取扩展文件（如果需要）
                if need_download {
                    materialize_extension_crx(&app, &env_id, &ext, &crx_path).await?;
                    // 下载后校验哈希
                    verify_extension_hash(&crx_path, &ext.hash)?;
                }

                // 解压目录：temp_extensions/{extension_id}_{version}
                let extract_dir_name = format!("{}_{}", ext.extension_id, ext.version);
                let extract_dir = temp_extensions_dir.join(&extract_dir_name);

                // 删除旧的解压目录（如果存在）
                if extract_dir.exists() {
                    crate::log_info!(
                        crate::core::logger::modules::KERNEL,
                        "删除旧的扩展目录: {}",
                        extract_dir.display()
                    );
                    fs::remove_dir_all(&extract_dir)?;
                }

                // 解压到临时目录（使用 spawn_blocking 避免阻塞）
                let crx_path_clone = crx_path.clone();
                let extract_dir_clone = extract_dir.clone();
                match tokio::task::spawn_blocking(move || {
                    extract_crx_to_dir(&crx_path_clone, &extract_dir_clone)
                })
                .await
                {
                    Ok(result) => result?,
                    Err(e) => return Err(format!("解压扩展失败: {}", e).into()),
                }

                crate::log_info!(
                    crate::core::logger::modules::KERNEL,
                    "扩展安装成功: {} -> {}",
                    ext.name,
                    extract_dir.display()
                );

                Ok(extract_dir.to_string_lossy().to_string())
            }
        })
        .buffer_unordered(MAX_CONCURRENT_DOWNLOADS)
        .collect()
        .await;

    // 收集成功的扩展目录
    let mut extension_dirs = Vec::new();
    for result in results {
        match result {
            Ok(dir) => extension_dirs.push(dir),
            Err(e) => {
                crate::log_error!(crate::core::logger::modules::KERNEL, "安装扩展失败: {}", e);
                // 继续安装其他扩展，不中断整个流程
            }
        }
    }

    crate::log_info!(
        crate::core::logger::modules::KERNEL,
        "环境 {} 成功安装 {} 个扩展",
        env_id,
        extension_dirs.len()
    );

    Ok(extension_dirs)
}

/// 准备扩展 CRX 文件：远端下载或本地复制
async fn materialize_extension_crx(
    app: &tauri::AppHandle,
    env_id: &str,
    ext: &super::types::ExtensionInfo,
    crx_path: &Path,
) -> Result<()> {
    if let Some(local_path) = ext.managed_crx_path.as_deref() {
        copy_local_extension_crx(local_path, crx_path)?;
        return Ok(());
    }

    download_extension_with_retry(app, env_id, ext, crx_path).await
}

/// 下载扩展文件（带重试机制）
async fn download_extension_with_retry(
    app: &tauri::AppHandle,
    env_id: &str,
    ext: &super::types::ExtensionInfo,
    crx_path: &Path,
) -> Result<()> {
    let mut last_error = None;

    for attempt in 1..=DOWNLOAD_RETRY_COUNT {
        match download_extension(app, env_id, ext, crx_path).await {
            Ok(_) => return Ok(()),
            Err(e) => {
                last_error = Some(e);
                if attempt < DOWNLOAD_RETRY_COUNT {
                    crate::log_warn!(
                        crate::core::logger::modules::KERNEL,
                        "下载扩展失败 (尝试 {}/{}): {}，正在重试...",
                        attempt,
                        DOWNLOAD_RETRY_COUNT,
                        last_error.as_ref().unwrap()
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                }
            }
        }
    }

    Err(format!(
        "下载扩展失败，已重试 {} 次: {}",
        DOWNLOAD_RETRY_COUNT,
        last_error.unwrap()
    )
    .into())
}

/// 下载扩展文件
async fn download_extension(
    app: &tauri::AppHandle,
    env_id: &str,
    ext: &super::types::ExtensionInfo,
    crx_path: &Path,
) -> Result<()> {
    use futures::StreamExt;
    let download_url = ext.download_url.as_deref().ok_or("远端扩展缺少 download_url")?;

    crate::log_info!(
        crate::core::logger::modules::KERNEL,
        "下载扩展: {} from {}",
        ext.name,
        download_url
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()?;

    let response = client.get(download_url).send().await?;
    if !response.status().is_success() {
        return Err(format!("下载扩展失败: HTTP {}", response.status()).into());
    }

    let total_len = response.content_length();
    let mut file = fs::File::create(crx_path)?;
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        downloaded += chunk.len() as u64;
        std::io::Write::write_all(&mut file, &chunk)?;

        if let Some(total) = total_len {
            let pct = (downloaded as f64 / total as f64) * 100.0;
            if downloaded % (100 * 1024) == 0 || downloaded >= total {
                crate::log_debug!(
                    crate::core::logger::modules::KERNEL,
                    "下载扩展 {}: {:.1}% ({}/{})",
                    ext.name,
                    pct,
                    downloaded,
                    total
                );
            }
        }
    }

    Ok(())
}

fn copy_local_extension_crx(source_path: &str, crx_path: &Path) -> Result<()> {
    let source = Path::new(source_path);
    if !source.exists() {
        return Err(format!("本地插件文件不存在: {}", source.display()).into());
    }

    if let Some(parent) = crx_path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::copy(source, crx_path)?;
    Ok(())
}

/// 校验扩展文件哈希
fn verify_extension_hash(crx_path: &Path, expected_hash: &str) -> Result<()> {
    use crate::core::utils::hash::calculate_file_hash;

    let actual_hash = calculate_file_hash(crx_path)?;
    let expected = expected_hash.trim().to_lowercase();
    let actual = actual_hash.to_lowercase();

    if actual != expected {
        let _ = fs::remove_file(crx_path);
        return Err(format!(
            "扩展文件校验失败（哈希不一致）。预期: {} 实际: {}",
            expected, actual
        )
        .into());
    }

    Ok(())
}

/// 解压 CRX / ZIP 扩展文件到目标目录
fn extract_crx_to_dir(crx_path: &Path, target_dir: &Path) -> Result<()> {
    use std::io::{Read, Seek};

    crate::log_info!(
        crate::core::logger::modules::KERNEL,
        "开始解压扩展文件: {} -> {}",
        crx_path.display(),
        target_dir.display()
    );

    let mut file = fs::File::open(crx_path)?;
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic)?;

    let zip_offset = if &magic[0..2] == b"PK" {
        0u64
    } else if &magic == b"Cr24" {
        let mut version_bytes = [0u8; 4];
        file.read_exact(&mut version_bytes)?;
        let version = u32::from_le_bytes(version_bytes);
        match version {
            3 => {
                let mut header_len_bytes = [0u8; 4];
                file.read_exact(&mut header_len_bytes)?;
                12 + u32::from_le_bytes(header_len_bytes) as u64
            }
            2 => {
                let mut pubkey_len_bytes = [0u8; 4];
                let mut sig_len_bytes = [0u8; 4];
                file.read_exact(&mut pubkey_len_bytes)?;
                file.read_exact(&mut sig_len_bytes)?;
                16 + u32::from_le_bytes(pubkey_len_bytes) as u64
                    + u32::from_le_bytes(sig_len_bytes) as u64
            }
            _ => return Err(format!("暂不支持的 CRX 版本: {version}").into()),
        }
    } else {
        return Err("不是有效的 CRX 或 ZIP 扩展文件格式".into());
    };

    file.seek(std::io::SeekFrom::Start(zip_offset))?;

    // 解压 ZIP 数据
    let mut archive = zip::ZipArchive::new(file)?;
    fs::create_dir_all(target_dir)?;

    // 如果 manifest.json 位于单层子目录下（常见于手动压缩文件夹的 .zip），自动剥离该顶层目录前缀
    let strip_prefix: Option<String> = {
        let mut root_manifest = false;
        let mut nested_prefix: Option<String> = None;
        for i in 0..archive.len() {
            if let Some(name) = archive.name_for_index(i) {
                let normalized = name.replace('\\', "/");
                if normalized == "manifest.json" {
                    root_manifest = true;
                    break;
                }
                if normalized.ends_with("/manifest.json")
                    && !normalized.starts_with("__MACOSX/")
                    && normalized.matches('/').count() == 1
                {
                    if let Some((prefix, _)) = normalized.split_once('/') {
                        nested_prefix = Some(format!("{prefix}/"));
                    }
                }
            }
        }
        if root_manifest { None } else { nested_prefix }
    };

    crate::log_info!(
        crate::core::logger::modules::KERNEL,
        "扩展包包含 {} 个文件",
        archive.len()
    );

    let canonical_target = target_dir.canonicalize()?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let raw_name = file.name().replace('\\', "/");
        if raw_name.starts_with("__MACOSX/") {
            continue;
        }
        let file_name = if let Some(prefix) = strip_prefix.as_deref() {
            match raw_name.strip_prefix(prefix) {
                Some(rest) if !rest.is_empty() => rest,
                _ => continue,
            }
        } else {
            raw_name.as_str()
        };

        // 安全检查：防止路径遍历攻击
        if file_name.contains("..") || file_name.starts_with('/') || file_name.starts_with('\\') {
            return Err(format!("检测到不安全的文件路径: {}", file_name).into());
        }

        let outpath = target_dir.join(file_name);

        // 二次验证：确保解压路径在目标目录内
        if let Some(parent) = outpath.parent() {
            fs::create_dir_all(parent)?;
            if let Ok(canonical_parent) = parent.canonicalize() {
                if !canonical_parent.starts_with(&canonical_target) {
                    return Err(format!("路径遍历攻击检测: {}", file_name).into());
                }
            }
        }

        if file.is_dir() {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut outfile = fs::File::create(&outpath)?;
            std::io::copy(&mut file, &mut outfile)?;
        }
    }

    crate::log_info!(
        crate::core::logger::modules::KERNEL,
        "扩展文件解压完成: {}",
        target_dir.display()
    );

    Ok(())
}
