//! 在桌面上创建指向某个环境的 `.lnk` 快捷方式。
//!
//! 用 Windows 自带的 `WScript.Shell` 写 `.lnk`（通过 PowerShell，所有值走环境变量，不拼进脚本，
//! 环境名里的引号、`$`、反引号都不会被当成代码）。

use std::path::{Path, PathBuf};

use super::{is_valid_env_uuid, OPEN_ENV_ARG};
use crate::core::error::Result;

/// 快捷方式文件名最大长度（不含扩展名）。
const MAX_FILE_NAME_CHARS: usize = 80;

/// Windows 保留设备名，不能当文件名。
const RESERVED_NAMES: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// 把环境名变成安全的文件名：去掉非法字符、控制字符，限制长度，避开保留名。
pub fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_control() || matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '_' } else { c })
        .collect();
    // 末尾的点和空格 Windows 会悄悄去掉，先去掉避免名字和预期不一致
    let trimmed = cleaned.trim().trim_end_matches(['.', ' ']);
    let mut result: String = trimmed.chars().take(MAX_FILE_NAME_CHARS).collect();
    result = result.trim().trim_end_matches(['.', ' ']).to_string();
    if result.is_empty() {
        return "Simprint 环境".to_string();
    }
    let stem = result.split('.').next().unwrap_or("").to_ascii_uppercase();
    if RESERVED_NAMES.contains(&stem.as_str()) {
        result.insert(0, '_');
    }
    result
}

/// 快捷方式的启动参数。
pub fn shortcut_arguments(env_uuid: &str) -> String {
    format!("{OPEN_ENV_ARG}{env_uuid}")
}

/// 桌面目录（正确处理被 OneDrive 等重定向的桌面）。
fn desktop_dir() -> Result<PathBuf> {
    directories::UserDirs::new()
        .and_then(|dirs| dirs.desktop_dir().map(Path::to_path_buf))
        .ok_or_else(|| "无法确定桌面目录".into())
}

/// 在桌面上为环境创建（或更新）快捷方式，返回快捷方式的完整路径。
pub fn create_desktop_shortcut(env_uuid: &str, env_name: &str) -> Result<PathBuf> {
    create_shortcut_in(&desktop_dir()?, env_uuid, env_name, &std::env::current_exe().map_err(|e| format!("无法获取程序路径: {e}"))?)
}

/// 在指定目录创建快捷方式。同名文件规则：
/// - 已有的是同一个环境的快捷方式 → 更新它；
/// - 已有的是别的东西（别的环境、用户自己的文件） → 改用带环境 ID 前 6 位的名字，绝不覆盖；
/// - 两个名字都被别的东西占了 → 报错。
pub fn create_shortcut_in(dir: &Path, env_uuid: &str, env_name: &str, exe: &Path) -> Result<PathBuf> {
    if !is_valid_env_uuid(env_uuid) {
        return Err("环境 ID 无效".into());
    }
    let base = sanitize_file_name(env_name);
    let arguments = shortcut_arguments(env_uuid);
    let candidates = [format!("{base}.lnk"), format!("{base} ({}).lnk", &env_uuid[..6])];

    for file_name in candidates {
        let path = dir.join(file_name);
        let ours = !path.exists()
            || read_shortcut_arguments(&path).map(|existing| existing.eq_ignore_ascii_case(&arguments)).unwrap_or(false);
        if ours {
            let workdir = exe.parent().unwrap_or_else(|| Path::new("")).to_string_lossy().to_string();
            write_shortcut(&path, &exe.to_string_lossy(), &arguments, &workdir, &format!("{},0", exe.display()), env_name)?;
            return Ok(path);
        }
    }
    Err("桌面上已有同名文件，无法创建快捷方式".into())
}

/// 读取已有快捷方式的启动参数；不是有效快捷方式返回 None。
pub fn read_shortcut_arguments(path: &Path) -> Option<String> {
    let script = r#"
$ErrorActionPreference = 'Stop'
$link = (New-Object -ComObject WScript.Shell).CreateShortcut($env:SP_LNK_PATH)
[Console]::Out.Write($link.Arguments)
"#;
    run_powershell(script, &[("SP_LNK_PATH", &path.to_string_lossy())]).ok()
}

fn write_shortcut(path: &Path, target: &str, arguments: &str, workdir: &str, icon: &str, description: &str) -> Result<()> {
    let script = r#"
$ErrorActionPreference = 'Stop'
$link = (New-Object -ComObject WScript.Shell).CreateShortcut($env:SP_LNK_PATH)
$link.TargetPath = $env:SP_LNK_TARGET
$link.Arguments = $env:SP_LNK_ARGS
$link.WorkingDirectory = $env:SP_LNK_WORKDIR
$link.IconLocation = $env:SP_LNK_ICON
$link.Description = $env:SP_LNK_DESC
$link.Save()
"#;
    run_powershell(
        script,
        &[
            ("SP_LNK_PATH", &path.to_string_lossy()),
            ("SP_LNK_TARGET", target),
            ("SP_LNK_ARGS", arguments),
            ("SP_LNK_WORKDIR", workdir),
            ("SP_LNK_ICON", icon),
            ("SP_LNK_DESC", description),
        ],
    )
    .map(|_| ())
}

/// 运行一段 PowerShell。脚本通过标准输入传入，参数通过环境变量传入，永远不拼接字符串。
#[cfg(windows)]
fn run_powershell(script: &str, envs: &[(&str, &str)]) -> Result<String> {
    use std::io::Write;
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut command = Command::new("powershell.exe");
    command
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW);
    for (key, value) in envs {
        command.env(key, value);
    }
    let mut child = command.spawn().map_err(|e| format!("无法运行 PowerShell: {e}"))?;
    child
        .stdin
        .take()
        .ok_or("无法写入 PowerShell")?
        .write_all(script.as_bytes())
        .map_err(|e| format!("无法写入 PowerShell: {e}"))?;
    let output = child.wait_with_output().map_err(|e| format!("PowerShell 运行失败: {e}"))?;
    if !output.status.success() {
        return Err(format!("创建快捷方式失败: {}", String::from_utf8_lossy(&output.stderr).trim()).into());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(not(windows))]
fn run_powershell(_script: &str, _envs: &[(&str, &str)]) -> Result<String> {
    Err("当前系统暂不支持创建快捷方式".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    const UUID_A: &str = "c85aac79-2b43-3d15-d8ce-15e7a511a15b";
    const UUID_B: &str = "01f68366-65c2-1d26-497e-4c66a1225212";

    #[test]
    fn file_names_are_made_safe() {
        assert_eq!(sanitize_file_name("反重力三号机"), "反重力三号机");
        assert_eq!(sanitize_file_name("a/b\\c:d*e?f\"g<h>i|j"), "a_b_c_d_e_f_g_h_i_j");
        assert_eq!(sanitize_file_name("  name. . "), "name");
        assert_eq!(sanitize_file_name(""), "Simprint 环境");
        assert_eq!(sanitize_file_name("   "), "Simprint 环境");
        assert_eq!(sanitize_file_name("..."), "Simprint 环境");
        assert_eq!(sanitize_file_name("a\u{0}b\nc"), "a_b_c");
        assert_eq!(sanitize_file_name("CON"), "_CON");
        assert_eq!(sanitize_file_name("nul.txt"), "_nul.txt");
        assert_eq!(sanitize_file_name(&"长".repeat(200)).chars().count(), MAX_FILE_NAME_CHARS);
        assert!(!sanitize_file_name("..\\..\\Windows\\evil").contains('\\'));
    }

    #[test]
    fn shortcut_arguments_carry_only_the_environment_id() {
        assert_eq!(shortcut_arguments(UUID_A), format!("--open-env={UUID_A}"));
    }

    #[cfg(windows)]
    mod windows_only {
        use super::*;

        fn temp_dir(tag: &str) -> PathBuf {
            let dir = std::env::temp_dir().join(format!("simprint-shortcut-test-{tag}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            dir
        }

        fn exe() -> PathBuf {
            PathBuf::from(r"C:\Windows\System32\notepad.exe")
        }

        #[test]
        fn creates_a_shortcut_that_opens_the_environment() {
            let dir = temp_dir("create");
            let path = create_shortcut_in(&dir, UUID_A, "反重力 \"三号机\" $(calc) `x`", &exe()).unwrap();
            assert!(path.exists());
            assert_eq!(path.extension().and_then(|e| e.to_str()), Some("lnk"));
            // 环境名里的引号、$()、反引号只是文件名和描述里的普通字符，不会被当成代码执行
            assert_eq!(read_shortcut_arguments(&path).unwrap(), shortcut_arguments(UUID_A));
            let _ = std::fs::remove_dir_all(&dir);
        }

        #[test]
        fn recreating_updates_the_same_file_and_never_overwrites_something_else() {
            let dir = temp_dir("collide");
            let first = create_shortcut_in(&dir, UUID_A, "测试环境", &exe()).unwrap();
            let again = create_shortcut_in(&dir, UUID_A, "测试环境", &exe()).unwrap();
            assert_eq!(first, again, "same environment: update in place");

            // 另一个环境同名：不能覆盖，改用带 ID 前缀的名字
            let other = create_shortcut_in(&dir, UUID_B, "测试环境", &exe()).unwrap();
            assert_ne!(first, other);
            assert!(other.file_name().unwrap().to_string_lossy().contains("01f683"));
            assert_eq!(read_shortcut_arguments(&first).unwrap(), shortcut_arguments(UUID_A));
            assert_eq!(read_shortcut_arguments(&other).unwrap(), shortcut_arguments(UUID_B));

            // 用户自己的同名文件：绝不覆盖
            std::fs::write(dir.join("我的文件.lnk"), b"not a shortcut").unwrap();
            let kept = create_shortcut_in(&dir, UUID_A, "我的文件", &exe()).unwrap();
            assert_eq!(std::fs::read(dir.join("我的文件.lnk")).unwrap(), b"not a shortcut");
            assert!(kept.file_name().unwrap().to_string_lossy().contains("c85aac"));

            // 两个名字都被别的东西占了：报错而不是覆盖
            std::fs::write(&kept, b"squatter").unwrap();
            assert!(create_shortcut_in(&dir, UUID_A, "我的文件", &exe()).is_err());
            assert_eq!(std::fs::read(&kept).unwrap(), b"squatter");
            let _ = std::fs::remove_dir_all(&dir);
        }

        #[test]
        fn rejects_invalid_environment_ids() {
            let dir = temp_dir("invalid");
            assert!(create_shortcut_in(&dir, "../evil", "x", &exe()).is_err());
            assert!(std::fs::read_dir(&dir).unwrap().next().is_none());
            let _ = std::fs::remove_dir_all(&dir);
        }
    }
}
