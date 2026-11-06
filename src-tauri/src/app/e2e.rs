//! Opt-in local WebView inspection for an isolated desktop test build only.
use std::path::PathBuf;

pub fn browser_args() -> Result<String, String> {
    let root = PathBuf::from(std::env::var_os("SIMPRINT_ROOT_DIR").ok_or("desktop-e2e requires an isolated runtime root")?);
    let port = std::env::var("SIMPRINT_E2E_CDP_PORT").map_err(|_| "desktop-e2e requires an explicit debug port")?
        .parse::<u16>().map_err(|_| "Invalid desktop-e2e port")?;
    validate(&root, port)?;
    Ok(format!("--remote-debugging-port={port} --remote-debugging-address=127.0.0.1"))
}

fn validate(root: &std::path::Path, port: u16) -> Result<(), String> {
    if !root.is_absolute() || !root.join(".simprint-desktop-e2e").is_file() || !(37111..=37119).contains(&port) {
        return Err("desktop-e2e requires a marked absolute test directory and port 37111..37119".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn refuses_unmarked_roots_and_unrestricted_ports() {
        assert!(validate(std::path::Path::new("relative"), 37111).is_err());
        let root = std::env::temp_dir().join(format!("simprint-e2e-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        assert!(validate(&root, 37111).is_err());
        std::fs::write(root.join(".simprint-desktop-e2e"), "test-owned").unwrap();
        assert!(validate(&root, 9222).is_err());
        assert!(validate(&root, 37111).is_ok());
        std::fs::remove_file(root.join(".simprint-desktop-e2e")).unwrap();
        std::fs::remove_dir(root).unwrap();
    }
}
