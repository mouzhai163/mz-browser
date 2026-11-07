//! 把 Simprint 登记为 Windows 的"可选浏览器"（只写 HKCU，不需要管理员权限）。
//!
//! Windows 8 起程序不能自己把自己设为默认浏览器（`UserChoice` 有哈希保护），只能先登记成候选，
//! 再由用户在"设置 → 应用 → 默认应用"里选择。登记的内容与 Chrome / Edge 相同：
//!
//! - `<root>\Classes\<ProgId>`：协议/文件的打开命令；
//! - `<root>\Clients\StartMenuInternet\<AppKey>\Capabilities`：声明能处理 http、https、.htm、.html、.xhtml；
//! - `<root>\RegisteredApplications`：指向上面的 Capabilities。
//!
//! `<root>` 正式使用时是 `Software`；测试用一个临时子树，避免碰真实的注册表项。

use std::io;
use std::path::Path;

use winreg::{enums::*, RegKey};

const FILE_TYPES: [&str; 3] = [".htm", ".html", ".xhtml"];
const URL_SCHEMES: [&str; 2] = ["http", "https"];

/// 登记用的名字。隔离/开发运行用另一套名字，避免覆盖已安装版本的登记。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Names {
    pub prog_id: &'static str,
    pub app_key: &'static str,
    pub display_name: &'static str,
}

pub const RELEASE_NAMES: Names =
    Names { prog_id: "SimprintHTML", app_key: "Simprint", display_name: "Simprint" };
pub const ISOLATED_NAMES: Names =
    Names { prog_id: "SimprintDevHTML", app_key: "SimprintDev", display_name: "Simprint (Dev)" };

fn quoted(exe: &Path) -> String {
    format!("\"{}\"", exe.display())
}

fn client_path(root: &str, names: &Names) -> String {
    format!("{root}\\Clients\\StartMenuInternet\\{}", names.app_key)
}

/// 登记（可重复调用，会覆盖旧值）。
pub fn register(root: &str, names: &Names, exe: &Path) -> io::Result<()> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let command = format!("{} \"%1\"", quoted(exe));
    let icon = format!("{},0", quoted(exe));

    let (prog, _) = hkcu.create_subkey(format!("{root}\\Classes\\{}", names.prog_id))?;
    prog.set_value("", &format!("{} HTML Document", names.display_name))?;
    prog.create_subkey("DefaultIcon")?.0.set_value("", &icon)?;
    prog.create_subkey("shell\\open\\command")?.0.set_value("", &command)?;

    let (client, _) = hkcu.create_subkey(client_path(root, names))?;
    client.set_value("", &names.display_name)?;
    client.create_subkey("DefaultIcon")?.0.set_value("", &icon)?;
    client.create_subkey("shell\\open\\command")?.0.set_value("", &quoted(exe))?;

    let (capabilities, _) = client.create_subkey("Capabilities")?;
    capabilities.set_value("ApplicationName", &names.display_name)?;
    capabilities.set_value("ApplicationDescription", &"Simprint fingerprint browser workbench")?;
    capabilities.set_value("ApplicationIcon", &icon)?;
    let (files, _) = capabilities.create_subkey("FileAssociations")?;
    for extension in FILE_TYPES {
        files.set_value(extension, &names.prog_id)?;
    }
    let (urls, _) = capabilities.create_subkey("URLAssociations")?;
    for scheme in URL_SCHEMES {
        urls.set_value(scheme, &names.prog_id)?;
    }

    let (registered, _) = hkcu.create_subkey(format!("{root}\\RegisteredApplications"))?;
    registered.set_value(
        names.app_key,
        &format!("{}\\Capabilities", client_path(root, names)),
    )?;
    Ok(())
}

/// 取消登记。项目本来就不存在不算错误。
pub fn unregister(root: &str, names: &Names) -> io::Result<()> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    ignore_not_found(hkcu.delete_subkey_all(format!("{root}\\Classes\\{}", names.prog_id)))?;
    ignore_not_found(hkcu.delete_subkey_all(client_path(root, names)))?;
    if let Ok(registered) =
        hkcu.open_subkey_with_flags(format!("{root}\\RegisteredApplications"), KEY_SET_VALUE)
    {
        ignore_not_found(registered.delete_value(names.app_key))?;
    }
    Ok(())
}

fn ignore_not_found(result: io::Result<()>) -> io::Result<()> {
    match result {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        other => other,
    }
}

/// 是否已登记，且打开命令指向当前这个 exe（路径变了需要重新登记）。
pub fn is_registered(root: &str, names: &Names, exe: &Path) -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let expected = format!("{} \"%1\"", quoted(exe));
    let command: io::Result<String> = hkcu
        .open_subkey(format!("{root}\\Classes\\{}\\shell\\open\\command", names.prog_id))
        .and_then(|key| key.get_value(""));
    let capabilities = hkcu.open_subkey(format!("{}\\Capabilities", client_path(root, names))).is_ok();
    capabilities && command.map(|value| value == expected).unwrap_or(false)
}

/// Windows 当前对 http 的默认处理程序是不是我们（真实路径，只读）。
pub fn is_system_default(names: &Names) -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    hkcu.open_subkey(
        "Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice",
    )
    .and_then(|key| key.get_value::<String, _>("ProgId"))
    .map(|prog_id| prog_id == names.prog_id)
    .unwrap_or(false)
}

/// 通知资源管理器文件/协议关联变了，让"默认应用"页面立即看到登记结果。
pub fn notify_association_changed() {
    use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
    // SAFETY: SHCNE_ASSOCCHANGED 不使用 dwItem1/dwItem2，两个指针传 None；没有借用任何 Rust 内存。
    #[allow(unsafe_code)]
    unsafe {
        SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None)
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 每个测试用自己的临时子树，结束后整棵删除，绝不碰真实的 Classes/Clients/RegisteredApplications。
    struct TestRoot(String);

    impl TestRoot {
        fn new(tag: &str) -> Self {
            Self(format!("Software\\SimprintTest\\{}_{}", tag, std::process::id()))
        }
    }

    impl Drop for TestRoot {
        fn drop(&mut self) {
            let _ = RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(&self.0);
        }
    }

    fn exe() -> &'static Path {
        Path::new("C:\\Program Files\\Simprint\\Simprint.exe")
    }

    #[test]
    fn register_writes_everything_windows_needs_and_unregister_removes_it() {
        let root = TestRoot::new("roundtrip");
        assert!(!is_registered(&root.0, &RELEASE_NAMES, exe()));

        register(&root.0, &RELEASE_NAMES, exe()).unwrap();
        assert!(is_registered(&root.0, &RELEASE_NAMES, exe()));

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let caps_path = format!("{}\\Capabilities", client_path(&root.0, &RELEASE_NAMES));
        let caps = hkcu.open_subkey(&caps_path).unwrap();
        assert_eq!(caps.get_value::<String, _>("ApplicationName").unwrap(), "Simprint");
        let urls = caps.open_subkey("URLAssociations").unwrap();
        assert_eq!(urls.get_value::<String, _>("http").unwrap(), "SimprintHTML");
        assert_eq!(urls.get_value::<String, _>("https").unwrap(), "SimprintHTML");
        let files = caps.open_subkey("FileAssociations").unwrap();
        for extension in FILE_TYPES {
            assert_eq!(files.get_value::<String, _>(extension).unwrap(), "SimprintHTML");
        }
        let registered = hkcu.open_subkey(format!("{}\\RegisteredApplications", root.0)).unwrap();
        assert_eq!(registered.get_value::<String, _>("Simprint").unwrap(), caps_path);

        unregister(&root.0, &RELEASE_NAMES).unwrap();
        assert!(!is_registered(&root.0, &RELEASE_NAMES, exe()));
        assert!(hkcu.open_subkey(&caps_path).is_err());
        let registered = hkcu.open_subkey(format!("{}\\RegisteredApplications", root.0)).unwrap();
        assert!(registered.get_value::<String, _>("Simprint").is_err());
    }

    #[test]
    fn registration_follows_the_executable_path() {
        let root = TestRoot::new("path");
        register(&root.0, &RELEASE_NAMES, exe()).unwrap();
        let moved = Path::new("D:\\Apps\\Simprint\\Simprint.exe");
        assert!(!is_registered(&root.0, &RELEASE_NAMES, moved));
        register(&root.0, &RELEASE_NAMES, moved).unwrap();
        assert!(is_registered(&root.0, &RELEASE_NAMES, moved));
        assert!(!is_registered(&root.0, &RELEASE_NAMES, exe()));
    }

    #[test]
    fn unregister_is_idempotent() {
        let root = TestRoot::new("idempotent");
        unregister(&root.0, &RELEASE_NAMES).unwrap();
        register(&root.0, &RELEASE_NAMES, exe()).unwrap();
        unregister(&root.0, &RELEASE_NAMES).unwrap();
        unregister(&root.0, &RELEASE_NAMES).unwrap();
    }

    #[test]
    fn isolated_runs_use_different_names_so_they_cannot_clobber_an_installed_app() {
        assert_ne!(RELEASE_NAMES.prog_id, ISOLATED_NAMES.prog_id);
        assert_ne!(RELEASE_NAMES.app_key, ISOLATED_NAMES.app_key);
        let root = TestRoot::new("isolated");
        register(&root.0, &RELEASE_NAMES, exe()).unwrap();
        register(&root.0, &ISOLATED_NAMES, Path::new("C:\\dev\\simprint.exe")).unwrap();
        unregister(&root.0, &ISOLATED_NAMES).unwrap();
        assert!(is_registered(&root.0, &RELEASE_NAMES, exe()));
    }
}
