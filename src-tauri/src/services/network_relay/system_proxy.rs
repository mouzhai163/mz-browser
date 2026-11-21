use super::types::SystemProxyInfo;

/// 检测当前操作系统的系统代理配置
pub fn detect_system_proxy() -> SystemProxyInfo {
    #[cfg(target_os = "windows")]
    {
        if let Some(info) = detect_windows_system_proxy() {
            return info;
        }
    }

    detect_env_system_proxy()
}

#[cfg(target_os = "windows")]
fn detect_windows_system_proxy() -> Option<SystemProxyInfo> {
    use winreg::RegKey;
    use winreg::enums::HKEY_CURRENT_USER;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu
        .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings")
        .ok()?;

    let enabled: u32 = key.get_value("ProxyEnable").unwrap_or(0);
    let raw_server: String = key.get_value("ProxyServer").unwrap_or_default();

    if enabled == 0 || raw_server.trim().is_empty() {
        return Some(SystemProxyInfo {
            enabled: false,
            server: None,
            host: None,
            port: None,
            scheme: "http".to_string(),
        });
    }

    let (scheme, host, port, display) = parse_windows_proxy_server(&raw_server)?;
    Some(SystemProxyInfo {
        enabled: true,
        server: Some(display),
        host: Some(host),
        port: Some(port),
        scheme,
    })
}

#[cfg(target_os = "windows")]
fn parse_windows_proxy_server(raw: &str) -> Option<(String, String, u16, String)> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    // 可能是 "http=127.0.0.1:7890;https=127.0.0.1:7890;socks=127.0.0.1:7891" 或 "127.0.0.1:7890"
    let mut http_candidate: Option<String> = None;
    let mut https_candidate: Option<String> = None;
    let mut socks_candidate: Option<String> = None;

    if trimmed.contains('=') {
        for part in trimmed.split(';') {
            let part = part.trim();
            if let Some((proto, addr)) = part.split_once('=') {
                let proto = proto.trim().to_ascii_lowercase();
                let addr = addr.trim().to_string();
                if addr.is_empty() {
                    continue;
                }
                match proto.as_str() {
                    "http" => http_candidate = Some(addr),
                    "https" => https_candidate = Some(addr),
                    "socks" | "socks5" => socks_candidate = Some(addr),
                    _ => {}
                }
            }
        }
    } else {
        http_candidate = Some(trimmed.to_string());
    }

    let (scheme, target) = if let Some(addr) = http_candidate.or(https_candidate) {
        ("http".to_string(), addr)
    } else if let Some(addr) = socks_candidate {
        ("socks5".to_string(), addr)
    } else {
        return None;
    };

    parse_host_port_with_scheme(&target, &scheme)
}

fn detect_env_system_proxy() -> SystemProxyInfo {
    for var in [
        "ALL_PROXY",
        "all_proxy",
        "HTTPS_PROXY",
        "https_proxy",
        "HTTP_PROXY",
        "http_proxy",
    ] {
        if let Ok(value) = std::env::var(var) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                if let Some((scheme, host, port, display)) =
                    parse_host_port_with_scheme(trimmed, "http")
                {
                    return SystemProxyInfo {
                        enabled: true,
                        server: Some(display),
                        host: Some(host),
                        port: Some(port),
                        scheme,
                    };
                }
            }
        }
    }

    SystemProxyInfo {
        enabled: false,
        server: None,
        host: None,
        port: None,
        scheme: "http".to_string(),
    }
}

fn parse_host_port_with_scheme(
    raw: &str,
    default_scheme: &str,
) -> Option<(String, String, u16, String)> {
    let trimmed = raw.trim().trim_end_matches('/');
    let (scheme, rest) = if let Some((s, r)) = trimmed.split_once("://") {
        let s = s.trim().to_ascii_lowercase();
        let mapped = match s.as_str() {
            "socks" | "socks5" | "socks5h" => "socks5".to_string(),
            "https" => "https".to_string(),
            _ => "http".to_string(),
        };
        (mapped, r)
    } else {
        (default_scheme.to_string(), trimmed)
    };

    // 去掉可能的 user:pass@
    let host_port = rest.rsplit_once('@').map(|(_, hp)| hp).unwrap_or(rest);
    let (host, port_str) = host_port.rsplit_once(':')?;
    let host = host.trim().trim_start_matches('[').trim_end_matches(']').to_string();
    let port: u16 = port_str.trim().parse().ok()?;
    if host.is_empty() || port == 0 {
        return None;
    }

    let display = format!("{host}:{port}");
    Some((scheme, host, port, display))
}
