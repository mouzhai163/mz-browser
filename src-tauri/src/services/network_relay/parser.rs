use std::collections::HashMap;

use base64::Engine;
use serde_json::{Map, Value as JsonValue, json};
use uuid::Uuid;

use super::types::{ManualNodeInput, RelayNode};

/// 解析订阅文本（支持 Clash YAML、Base64 编码节点列表、明文节点列表）
pub fn parse_subscription_content(content: &str) -> Result<Vec<RelayNode>, String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("订阅内容为空".to_string());
    }

    // 1. 优先尝试解析为 Clash / Mihomo YAML（包含 proxies 字段）
    if let Ok(yaml_val) = serde_yaml::from_str::<serde_yaml::Value>(trimmed) {
        if let Some(proxies) = yaml_val.get("proxies").and_then(|v| v.as_sequence()) {
            let mut nodes = Vec::new();
            for item in proxies {
                if let Some(node) = parse_yaml_proxy_item(item) {
                    nodes.push(node);
                }
            }
            if !nodes.is_empty() {
                return Ok(dedupe_node_names(nodes));
            }
        }
    }

    // 2. 尝试当作明文多行分享链接解析
    let direct_nodes = parse_share_links(trimmed);
    if !direct_nodes.is_empty() {
        return Ok(dedupe_node_names(direct_nodes));
    }

    // 3. 尝试 Base64 解码后再按多行分享链接解析
    if let Some(decoded) = decode_base64_flexible(trimmed) {
        let decoded_nodes = parse_share_links(&decoded);
        if !decoded_nodes.is_empty() {
            return Ok(dedupe_node_names(decoded_nodes));
        }
    }

    Err("未能从订阅内容中解析出有效节点（支持 Clash YAML 或 Base64/明文节点链接）".to_string())
}

/// 解析多行分享链接文本
pub fn parse_share_links(raw: &str) -> Vec<RelayNode> {
    let mut nodes = Vec::new();
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(node) = parse_single_link(line) {
            nodes.push(node);
        }
    }
    dedupe_node_names(nodes)
}

/// 从手动表单构造节点
pub fn build_manual_node(input: &ManualNodeInput) -> Result<RelayNode, String> {
    let server = input.server.trim();
    if server.is_empty() || input.port == 0 {
        return Err("服务器地址或端口无效".to_string());
    }
    let proto = input.protocol.trim().to_ascii_lowercase();
    let mihomo_type = match proto.as_str() {
        "http" | "https" => "http",
        "socks5" | "socks" => "socks5",
        other => return Err(format!("手动添加暂不支持协议: {other}")),
    };
    let name = if input.name.trim().is_empty() {
        format!("{server}:{}", input.port)
    } else {
        input.name.trim().to_string()
    };

    let mut obj = Map::new();
    obj.insert("name".into(), json!(name));
    obj.insert("type".into(), json!(mihomo_type));
    obj.insert("server".into(), json!(server));
    obj.insert("port".into(), json!(input.port));
    if proto == "https" {
        obj.insert("tls".into(), json!(true));
    }
    if let Some(user) = input.username.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        obj.insert("username".into(), json!(user));
    }
    if let Some(pass) = input.password.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        obj.insert("password".into(), json!(pass));
    }
    obj.insert("udp".into(), json!(true));

    Ok(RelayNode {
        id: Uuid::new_v4().to_string(),
        country_code: infer_country_code(&name),
        name,
        protocol: mihomo_type.to_string(),
        server: server.to_string(),
        port: input.port,
        raw_proxy: JsonValue::Object(obj),
        latency_ms: None,
    })
}

fn parse_yaml_proxy_item(item: &serde_yaml::Value) -> Option<RelayNode> {
    let json_val = serde_json::to_value(item).ok()?;
    let obj = json_val.as_object()?;
    let name = obj.get("name")?.as_str()?.trim().to_string();
    let protocol = obj.get("type")?.as_str()?.trim().to_ascii_lowercase();
    let server = obj.get("server")?.as_str()?.trim().to_string();
    let port = obj.get("port").and_then(|v| {
        v.as_u64()
            .and_then(|n| u16::try_from(n).ok())
            .or_else(|| v.as_str().and_then(|s| s.parse::<u16>().ok()))
    })?;

    if name.is_empty() || server.is_empty() || port == 0 {
        return None;
    }

    Some(RelayNode {
        id: Uuid::new_v4().to_string(),
        country_code: infer_country_code(&name),
        name,
        protocol,
        server,
        port,
        raw_proxy: json_val,
        latency_ms: None,
    })
}

fn parse_single_link(link: &str) -> Option<RelayNode> {
    let lower = link.to_ascii_lowercase();
    if lower.starts_with("vmess://") {
        parse_vmess_link(link)
    } else if lower.starts_with("vless://") {
        parse_vless_link(link)
    } else if lower.starts_with("trojan://") {
        parse_trojan_link(link)
    } else if lower.starts_with("ss://") {
        parse_ss_link(link)
    } else if lower.starts_with("hysteria2://") || lower.starts_with("hy2://") {
        parse_hysteria2_link(link)
    } else if lower.starts_with("socks5://")
        || lower.starts_with("socks://")
        || lower.starts_with("http://")
        || lower.starts_with("https://")
    {
        parse_standard_proxy_link(link)
    } else {
        None
    }
}

fn parse_vmess_link(link: &str) -> Option<RelayNode> {
    let encoded = link.strip_prefix("vmess://").or_else(|| link.get(8..))?;
    let decoded = decode_base64_flexible(encoded)?;
    let data: JsonValue = serde_json::from_str(&decoded).ok()?;
    let obj = data.as_object()?;

    let server = obj.get("add")?.as_str()?.trim().to_string();
    let port = obj.get("port").and_then(|v| {
        v.as_u64()
            .and_then(|n| u16::try_from(n).ok())
            .or_else(|| v.as_str().and_then(|s| s.parse::<u16>().ok()))
    })?;
    let uuid = obj.get("id")?.as_str()?.trim().to_string();
    let aid = obj
        .get("aid")
        .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse::<u64>().ok())))
        .unwrap_or(0);
    let name = obj
        .get("ps")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| format!("vmess-{server}:{port}"));

    let net = obj.get("net").and_then(|v| v.as_str()).unwrap_or("tcp").trim();
    let tls = obj.get("tls").and_then(|v| v.as_str()).unwrap_or("").trim();
    let sni = obj.get("sni").and_then(|v| v.as_str()).unwrap_or("").trim();
    let host = obj.get("host").and_then(|v| v.as_str()).unwrap_or("").trim();
    let path = obj.get("path").and_then(|v| v.as_str()).unwrap_or("").trim();
    let cipher = obj
        .get("scy")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("auto");

    let mut proxy = Map::new();
    proxy.insert("name".into(), json!(name));
    proxy.insert("type".into(), json!("vmess"));
    proxy.insert("server".into(), json!(server));
    proxy.insert("port".into(), json!(port));
    proxy.insert("uuid".into(), json!(uuid));
    proxy.insert("alterId".into(), json!(aid));
    proxy.insert("cipher".into(), json!(cipher));
    proxy.insert("udp".into(), json!(true));

    if tls.eq_ignore_ascii_case("tls") {
        proxy.insert("tls".into(), json!(true));
        if !sni.is_empty() {
            proxy.insert("servername".into(), json!(sni));
        } else if !host.is_empty() {
            proxy.insert("servername".into(), json!(host));
        }
    }

    if !net.is_empty() && net != "tcp" {
        proxy.insert("network".into(), json!(net));
        if net == "ws" {
            let mut ws_opts = Map::new();
            if !path.is_empty() {
                ws_opts.insert("path".into(), json!(path));
            }
            if !host.is_empty() {
                ws_opts.insert("headers".into(), json!({ "Host": host }));
            }
            proxy.insert("ws-opts".into(), JsonValue::Object(ws_opts));
        } else if net == "grpc" && !path.is_empty() {
            proxy.insert("grpc-opts".into(), json!({ "grpc-service-name": path }));
        }
    }

    Some(RelayNode {
        id: Uuid::new_v4().to_string(),
        country_code: infer_country_code(&name),
        name,
        protocol: "vmess".to_string(),
        server,
        port,
        raw_proxy: JsonValue::Object(proxy),
        latency_ms: None,
    })
}

fn parse_vless_link(link: &str) -> Option<RelayNode> {
    let rest = link.get(8..)?;
    let (main, fragment) = split_fragment(rest);
    let (authority, query) = split_query(main);
    let (uuid, host_port) = authority.split_once('@')?;
    let (server, port) = split_host_port(host_port)?;
    let params = parse_query_params(query);

    let name = fragment
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("vless-{server}:{port}"));

    let mut proxy = Map::new();
    proxy.insert("name".into(), json!(name));
    proxy.insert("type".into(), json!("vless"));
    proxy.insert("server".into(), json!(server));
    proxy.insert("port".into(), json!(port));
    proxy.insert("uuid".into(), json!(uuid));
    proxy.insert("udp".into(), json!(true));

    if let Some(flow) = params.get("flow").filter(|s| !s.is_empty()) {
        proxy.insert("flow".into(), json!(flow));
    }

    let security = params.get("security").map(String::as_str).unwrap_or("");
    if security == "tls" || security == "reality" {
        proxy.insert("tls".into(), json!(true));
        if let Some(sni) = params.get("sni").filter(|s| !s.is_empty()) {
            proxy.insert("servername".into(), json!(sni));
        }
        if let Some(fp) = params.get("fp").filter(|s| !s.is_empty()) {
            proxy.insert("client-fingerprint".into(), json!(fp));
        }
        if security == "reality" {
            let mut reality = Map::new();
            if let Some(pbk) = params.get("pbk").filter(|s| !s.is_empty()) {
                reality.insert("public-key".into(), json!(pbk));
            }
            if let Some(sid) = params.get("sid").filter(|s| !s.is_empty()) {
                reality.insert("short-id".into(), json!(sid));
            }
            proxy.insert("reality-opts".into(), JsonValue::Object(reality));
        }
    }

    let net = params.get("type").map(String::as_str).unwrap_or("tcp");
    if net != "tcp" && !net.is_empty() {
        proxy.insert("network".into(), json!(net));
        if net == "ws" {
            let mut ws_opts = Map::new();
            if let Some(path) = params.get("path").filter(|s| !s.is_empty()) {
                ws_opts.insert("path".into(), json!(path));
            }
            if let Some(host) = params.get("host").filter(|s| !s.is_empty()) {
                ws_opts.insert("headers".into(), json!({ "Host": host }));
            }
            proxy.insert("ws-opts".into(), JsonValue::Object(ws_opts));
        } else if net == "grpc" {
            if let Some(sn) = params.get("serviceName").filter(|s| !s.is_empty()) {
                proxy.insert("grpc-opts".into(), json!({ "grpc-service-name": sn }));
            }
        }
    }

    Some(RelayNode {
        id: Uuid::new_v4().to_string(),
        country_code: infer_country_code(&name),
        name,
        protocol: "vless".to_string(),
        server,
        port,
        raw_proxy: JsonValue::Object(proxy),
        latency_ms: None,
    })
}

fn parse_trojan_link(link: &str) -> Option<RelayNode> {
    let rest = link.get(9..)?;
    let (main, fragment) = split_fragment(rest);
    let (authority, query) = split_query(main);
    let (password, host_port) = authority.split_once('@')?;
    let (server, port) = split_host_port(host_port)?;
    let params = parse_query_params(query);

    let name = fragment
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("trojan-{server}:{port}"));

    let mut proxy = Map::new();
    proxy.insert("name".into(), json!(name));
    proxy.insert("type".into(), json!("trojan"));
    proxy.insert("server".into(), json!(server));
    proxy.insert("port".into(), json!(port));
    proxy.insert("password".into(), json!(percent_decode(password)));
    proxy.insert("udp".into(), json!(true));

    if let Some(sni) = params.get("sni").or_else(|| params.get("peer")).filter(|s| !s.is_empty()) {
        proxy.insert("sni".into(), json!(sni));
    }
    if params.get("allowInsecure").map(String::as_str) == Some("1") {
        proxy.insert("skip-cert-verify".into(), json!(true));
    }

    let net = params.get("type").map(String::as_str).unwrap_or("tcp");
    if net == "ws" {
        proxy.insert("network".into(), json!("ws"));
        let mut ws_opts = Map::new();
        if let Some(path) = params.get("path").filter(|s| !s.is_empty()) {
            ws_opts.insert("path".into(), json!(path));
        }
        if let Some(host) = params.get("host").filter(|s| !s.is_empty()) {
            ws_opts.insert("headers".into(), json!({ "Host": host }));
        }
        proxy.insert("ws-opts".into(), JsonValue::Object(ws_opts));
    } else if net == "grpc" {
        proxy.insert("network".into(), json!("grpc"));
        if let Some(sn) = params.get("serviceName").filter(|s| !s.is_empty()) {
            proxy.insert("grpc-opts".into(), json!({ "grpc-service-name": sn }));
        }
    }

    Some(RelayNode {
        id: Uuid::new_v4().to_string(),
        country_code: infer_country_code(&name),
        name,
        protocol: "trojan".to_string(),
        server,
        port,
        raw_proxy: JsonValue::Object(proxy),
        latency_ms: None,
    })
}

fn parse_ss_link(link: &str) -> Option<RelayNode> {
    let rest = link.get(5..)?;
    let (main, fragment) = split_fragment(rest);
    let (main, _query) = split_query(main);

    let (cipher, password, server, port) = if let Some((userinfo, host_port)) = main.split_once('@')
    {
        let decoded_info =
            decode_base64_flexible(userinfo).unwrap_or_else(|| percent_decode(userinfo));
        let (cipher, password) = decoded_info.split_once(':')?;
        let (server, port) = split_host_port(host_port)?;
        (cipher.to_string(), password.to_string(), server, port)
    } else {
        let decoded = decode_base64_flexible(main)?;
        let (userinfo, host_port) = decoded.split_once('@')?;
        let (cipher, password) = userinfo.split_once(':')?;
        let (server, port) = split_host_port(host_port)?;
        (cipher.to_string(), password.to_string(), server, port)
    };

    let name = fragment
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("ss-{server}:{port}"));

    let mut proxy = Map::new();
    proxy.insert("name".into(), json!(name));
    proxy.insert("type".into(), json!("ss"));
    proxy.insert("server".into(), json!(server));
    proxy.insert("port".into(), json!(port));
    proxy.insert("cipher".into(), json!(cipher));
    proxy.insert("password".into(), json!(password));
    proxy.insert("udp".into(), json!(true));

    Some(RelayNode {
        id: Uuid::new_v4().to_string(),
        country_code: infer_country_code(&name),
        name,
        protocol: "ss".to_string(),
        server,
        port,
        raw_proxy: JsonValue::Object(proxy),
        latency_ms: None,
    })
}

fn parse_hysteria2_link(link: &str) -> Option<RelayNode> {
    let rest = link.split_once("://").map(|(_, r)| r)?;
    let (main, fragment) = split_fragment(rest);
    let (authority, query) = split_query(main);
    let (password, host_port) = authority.split_once('@')?;
    let (server, port) = split_host_port(host_port)?;
    let params = parse_query_params(query);

    let name = fragment
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("hy2-{server}:{port}"));

    let mut proxy = Map::new();
    proxy.insert("name".into(), json!(name));
    proxy.insert("type".into(), json!("hysteria2"));
    proxy.insert("server".into(), json!(server));
    proxy.insert("port".into(), json!(port));
    proxy.insert("password".into(), json!(percent_decode(password)));

    if let Some(sni) = params.get("sni").filter(|s| !s.is_empty()) {
        proxy.insert("sni".into(), json!(sni));
    }
    if params.get("insecure").map(String::as_str) == Some("1") {
        proxy.insert("skip-cert-verify".into(), json!(true));
    }

    Some(RelayNode {
        id: Uuid::new_v4().to_string(),
        country_code: infer_country_code(&name),
        name,
        protocol: "hysteria2".to_string(),
        server,
        port,
        raw_proxy: JsonValue::Object(proxy),
        latency_ms: None,
    })
}

fn parse_standard_proxy_link(link: &str) -> Option<RelayNode> {
    let (scheme, rest) = link.split_once("://")?;
    let scheme = scheme.to_ascii_lowercase();
    let (main, fragment) = split_fragment(rest);
    let main = main.trim_end_matches('/');

    let (auth, host_port) = if let Some((a, hp)) = main.rsplit_once('@') {
        (Some(a), hp)
    } else {
        (None, main)
    };
    let (server, port) = split_host_port(host_port)?;

    let mihomo_type = match scheme.as_str() {
        "socks5" | "socks" => "socks5",
        _ => "http",
    };

    let name = fragment
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("{mihomo_type}-{server}:{port}"));

    let mut proxy = Map::new();
    proxy.insert("name".into(), json!(name));
    proxy.insert("type".into(), json!(mihomo_type));
    proxy.insert("server".into(), json!(server));
    proxy.insert("port".into(), json!(port));
    if scheme == "https" {
        proxy.insert("tls".into(), json!(true));
    }
    if let Some(auth_str) = auth {
        let decoded = decode_base64_flexible(auth_str).unwrap_or_else(|| percent_decode(auth_str));
        if let Some((u, p)) = decoded.split_once(':') {
            proxy.insert("username".into(), json!(u));
            proxy.insert("password".into(), json!(p));
        }
    }
    proxy.insert("udp".into(), json!(true));

    Some(RelayNode {
        id: Uuid::new_v4().to_string(),
        country_code: infer_country_code(&name),
        name,
        protocol: mihomo_type.to_string(),
        server,
        port,
        raw_proxy: JsonValue::Object(proxy),
        latency_ms: None,
    })
}

fn dedupe_node_names(mut nodes: Vec<RelayNode>) -> Vec<RelayNode> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for node in &mut nodes {
        let count = counts.entry(node.name.clone()).or_insert(0);
        *count += 1;
        if *count > 1 {
            let unique_name = format!("{} #{}", node.name, *count);
            node.name = unique_name.clone();
            if let Some(obj) = node.raw_proxy.as_object_mut() {
                obj.insert("name".into(), json!(unique_name));
            }
        }
    }
    nodes
}

fn split_fragment(input: &str) -> (&str, Option<String>) {
    match input.split_once('#') {
        Some((head, frag)) => (head, Some(percent_decode(frag.trim()))),
        None => (input, None),
    }
}

fn split_query(input: &str) -> (&str, &str) {
    match input.split_once('?') {
        Some((head, q)) => (head, q),
        None => (input, ""),
    }
}

fn split_host_port(input: &str) -> Option<(String, u16)> {
    let cleaned = input.trim().trim_end_matches('/');
    let (host, port_str) = if cleaned.starts_with('[') {
        let (h, p) = cleaned.rsplit_once("]:")?;
        (h.trim_start_matches('['), p)
    } else {
        cleaned.rsplit_once(':')?
    };
    let port: u16 = port_str.trim().parse().ok()?;
    if host.is_empty() || port == 0 {
        return None;
    }
    Some((host.to_string(), port))
}

fn parse_query_params(query: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if !k.is_empty() {
                map.insert(k.to_string(), percent_decode(v));
            }
        }
    }
    map
}

fn decode_base64_flexible(input: &str) -> Option<String> {
    let cleaned: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    if cleaned.is_empty() {
        return None;
    }
    let engines = [
        base64::engine::general_purpose::STANDARD,
        base64::engine::general_purpose::STANDARD_NO_PAD,
        base64::engine::general_purpose::URL_SAFE,
        base64::engine::general_purpose::URL_SAFE_NO_PAD,
    ];
    for engine in engines {
        if let Ok(bytes) = engine.decode(&cleaned) {
            if let Ok(text) = String::from_utf8(bytes) {
                return Some(text);
            }
        }
    }
    None
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (from_hex(bytes[i + 1]), from_hex(bytes[i + 2])) {
                out.push((hi << 4) | lo);
                i += 3;
                continue;
            }
        } else if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn from_hex(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

/// 根据节点名称推断常见国家/地区代码（用于前端展示地区徽章）
pub fn infer_country_code(name: &str) -> Option<String> {
    let upper = name.to_uppercase();
    let rules: &[(&[&str], &str)] = &[
        (
            &["香港", "HONG KONG", "HONGKONG", " HK", "HK-", "HK_", "🇭🇰"],
            "HK",
        ),
        (&["台湾", "台灣", "TAIWAN", " TW", "TW-", "TW_", "🇹🇼"], "TW"),
        (
            &["日本", "JAPAN", "TOKYO", "OSAKA", " JP", "JP-", "JP_", "🇯🇵"],
            "JP",
        ),
        (&["新加坡", "SINGAPORE", " SG", "SG-", "SG_", "🇸🇬"], "SG"),
        (
            &[
                "美国",
                "美國",
                "UNITED STATES",
                "USA",
                "LOS ANGELES",
                "SAN JOSE",
                " US",
                "US-",
                "US_",
                "🇺🇸",
            ],
            "US",
        ),
        (
            &["韩国", "韓國", "KOREA", "SEOUL", " KR", "KR-", "KR_", "🇰🇷"],
            "KR",
        ),
        (
            &[
                "英国",
                "英國",
                "UNITED KINGDOM",
                "LONDON",
                " UK",
                "GB",
                "🇬🇧",
            ],
            "GB",
        ),
        (
            &["德国", "德國", "GERMANY", "FRANKFURT", " DE", "DE-", "🇩🇪"],
            "DE",
        ),
        (
            &["法国", "法國", "FRANCE", "PARIS", " FR", "FR-", "🇫🇷"],
            "FR",
        ),
        (&["加拿大", "CANADA", " CA", "CA-", "🇨🇦"], "CA"),
        (
            &[
                "澳大利亚",
                "澳洲",
                "AUSTRALIA",
                "SYDNEY",
                " AU",
                "AU-",
                "🇦🇺",
            ],
            "AU",
        ),
        (&["荷兰", "荷蘭", "NETHERLANDS", " NL", "NL-", "🇳🇱"], "NL"),
        (&["俄罗斯", "俄羅斯", "RUSSIA", " RU", "RU-", "🇷🇺"], "RU"),
        (&["印度", "INDIA", " IN", "IN-", "🇮🇳"], "IN"),
        (&["马来西亚", "馬來西亞", "MALAYSIA", " MY", "🇲🇾"], "MY"),
        (&["泰国", "泰國", "THAILAND", " TH", "🇹🇭"], "TH"),
        (&["越南", "VIETNAM", " VN", "🇻🇳"], "VN"),
        (&["菲律宾", "菲律賓", "PHILIPPINES", " PH", "🇵🇭"], "PH"),
        (&["土耳其", "TURKEY", " TR", "🇹🇷"], "TR"),
    ];

    for (keywords, code) in rules {
        if keywords.iter().any(|kw| upper.contains(kw) || name.contains(kw)) {
            return Some((*code).to_string());
        }
    }

    // 兜底：匹配开头的两位国家码，如 "HK 01"、"US-02"
    let trimmed = upper.trim();
    for code in [
        "HK", "TW", "JP", "SG", "US", "KR", "GB", "UK", "DE", "FR", "CA", "AU", "NL",
    ] {
        if let Some(rest) = trimmed.strip_prefix(code) {
            if rest.is_empty() || !rest.chars().next().unwrap_or('A').is_ascii_alphabetic() {
                return Some(if code == "UK" { "GB" } else { code }.to_string());
            }
        }
    }

    None
}
