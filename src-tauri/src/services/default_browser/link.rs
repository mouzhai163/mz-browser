//! 外部链接的识别与校验。
//!
//! 链接来自其他软件（邮件、聊天……），必须当作不可信输入：只接受 http / https，
//! 拒绝 `file:`、`javascript:`、`data:`、`chrome:`、`simprint:` 等一切其他协议，
//! 也不允许空白或控制字符（防止被拆成多个参数或夹带内容）。

/// 链接最大长度。浏览器地址栏的实际上限是 2MB，但外部链接超过这个长度几乎一定有问题。
const MAX_LINK_LEN: usize = 8192;

/// 校验外部链接，返回去掉首尾空白后的链接。
pub fn validate_link(raw: &str) -> Result<String, String> {
    let link = raw.trim();
    if link.is_empty() {
        return Err("链接为空".to_string());
    }
    if link.len() > MAX_LINK_LEN {
        return Err("链接过长".to_string());
    }
    if link.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("链接包含空白或控制字符".to_string());
    }

    let rest = strip_web_scheme(link).ok_or_else(|| "只支持 http 和 https 链接".to_string())?;
    // authority 到第一个 / ? # 为止；去掉 user:pass@ 之后必须还有主机名。
    let authority_end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let host = rest[..authority_end].rsplit('@').next().unwrap_or("");
    if host.is_empty() || host.starts_with(':') {
        return Err("链接缺少主机名".to_string());
    }
    Ok(link.to_string())
}

fn strip_web_scheme(link: &str) -> Option<&str> {
    let lower = link.to_ascii_lowercase();
    if lower.starts_with("https://") {
        Some(&link["https://".len()..])
    } else if lower.starts_with("http://") {
        Some(&link["http://".len()..])
    } else {
        None
    }
}

/// 从进程参数里找出被系统交给我们的 http(s) 链接（`Simprint.exe "https://…"`）。
pub fn link_from_args<I>(args: I) -> Option<String>
where
    I: IntoIterator<Item = String>,
{
    args.into_iter().find(|arg| strip_web_scheme(arg.trim()).is_some())
}

/// 把整个链接做百分号编码，用作 DevTools `/json/new?<url>` 的查询串。
///
/// DevTools 会对查询串解码一次再当 URL 用，所以链接里原有的 `%26`、`&`、`#` 等都要先整体编码，
/// 否则解码后含义会变。只保留 RFC 3986 的非保留字符。
pub fn percent_encode_all(value: &str) -> String {
    let mut out = String::with_capacity(value.len() * 3);
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_plain_web_links() {
        for link in [
            "https://example.com",
            "http://example.com/a?b=1&c=2#frag",
            "HTTPS://Example.COM/Path",
            "https://user:pass@example.com:8443/x",
            "https://[2001:db8::1]/",
            "https://例え.jp/パス",
        ] {
            assert_eq!(validate_link(link).as_deref(), Ok(link), "{link}");
        }
        assert_eq!(validate_link("  https://example.com  ").unwrap(), "https://example.com");
    }

    #[test]
    fn rejects_everything_that_is_not_http_or_https() {
        for link in [
            "",
            "   ",
            "file:///C:/Windows/win.ini",
            "javascript:alert(1)",
            "data:text/html,<script>1</script>",
            "chrome://settings",
            "simprint://login",
            "ftp://example.com/",
            "about:blank",
            "example.com",
            "//example.com",
            "httpss://example.com",
            "https:/example.com",
        ] {
            assert!(validate_link(link).is_err(), "{link}");
        }
    }

    #[test]
    fn rejects_links_without_a_host() {
        for link in ["https://", "http:///path", "https://?q=1", "https://#x", "https://user@/x", "https://:8080/"] {
            assert!(validate_link(link).is_err(), "{link}");
        }
    }

    #[test]
    fn rejects_whitespace_and_control_characters() {
        // 中间的空白和控制字符一律拒绝
        for link in [
            "https://example.com/a b",
            "https://example.com/a\nb",
            "https://example.com/\u{0}x",
            "https://example.com --no-sandbox",
            "https://example.com/a\tb",
        ] {
            assert!(validate_link(link).is_err(), "{link:?}");
        }
        // 只有首尾的空白会被去掉
        assert_eq!(validate_link("https://example.com/\n").unwrap(), "https://example.com/");
    }

    #[test]
    fn rejects_overlong_links() {
        let long = format!("https://example.com/{}", "a".repeat(MAX_LINK_LEN));
        assert!(validate_link(&long).is_err());
    }

    #[test]
    fn finds_the_link_in_process_arguments() {
        let args = |items: &[&str]| items.iter().map(|item| item.to_string()).collect::<Vec<_>>();
        assert_eq!(
            link_from_args(args(&["Simprint.exe", "https://example.com/x"])).as_deref(),
            Some("https://example.com/x")
        );
        assert_eq!(link_from_args(args(&["Simprint.exe", "simprint://login"])), None);
        assert_eq!(link_from_args(args(&["Simprint.exe"])), None);
        assert_eq!(
            link_from_args(args(&["Simprint.exe", "--flag", "HTTP://example.com"])).as_deref(),
            Some("HTTP://example.com")
        );
    }

    #[test]
    fn percent_encoding_preserves_the_original_meaning_after_one_decode() {
        assert_eq!(percent_encode_all("https://a.com/x?y=1&z=%26#f"), "https%3A%2F%2Fa.com%2Fx%3Fy%3D1%26z%3D%2526%23f");
        assert_eq!(percent_encode_all("abc-_.~"), "abc-_.~");
        assert_eq!(percent_encode_all("例"), "%E4%BE%8B");
    }
}
