//! 外部链接的识别与校验。
//!
//! 链接来自其他软件（邮件、聊天……），必须当作不可信输入：只接受 http / https，
//! 拒绝 `file:`、`javascript:`、`data:`、`chrome:`、`simprint:` 等一切其他协议，
//! 也不允许空白或控制字符（防止被拆成多个参数或夹带内容）。

/// 链接最大长度。浏览器地址栏的实际上限是 2MB，但外部链接超过这个长度几乎一定有问题。
pub(super) const MAX_LINK_LEN: usize = 8192;

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

/// 参数分隔符：它之后的参数全部是"数据"，不是选项。
pub const ARGS_SEPARATOR: &str = "--";
/// 登记命令里携带的数据目录参数（仅开发/隔离运行需要，见 `registry`）。
pub const ROOT_ARG_PREFIX: &str = "--simprint-root=";

/// 从进程参数里取出被系统交给我们的 http(s) 链接。
///
/// 登记的命令是 `Simprint.exe [--simprint-root=<目录>] -- "<链接>"`：`--` 之后必须**恰好一个**参数，
/// 且是 http(s) 链接。链接里夹带引号会被拆成多个参数，此时整个请求作废，而不是挑其中一个去用。
pub fn link_from_args<I>(args: I) -> Option<String>
where
    I: IntoIterator<Item = String>,
{
    let args: Vec<String> = args.into_iter().collect();
    let separator = args.iter().position(|arg| arg == ARGS_SEPARATOR)?;
    match &args[separator + 1..] {
        [only] if strip_web_scheme(only.trim()).is_some() => Some(only.clone()),
        _ => None,
    }
}

/// 从进程参数里取出 `--simprint-root=<绝对路径>`（只看 `--` 之前的参数）。
pub fn root_from_args<I>(args: I) -> Option<String>
where
    I: IntoIterator<Item = String>,
{
    args.into_iter()
        .take_while(|arg| arg != ARGS_SEPARATOR)
        .filter_map(|arg| arg.strip_prefix(ROOT_ARG_PREFIX).map(str::to_string))
        .find(|value| std::path::Path::new(value).is_absolute())
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

    fn args(items: &[&str]) -> Vec<String> {
        items.iter().map(|item| item.to_string()).collect()
    }

    #[test]
    fn finds_the_link_after_the_separator() {
        assert_eq!(
            link_from_args(args(&["Simprint.exe", "--", "https://example.com/x"])).as_deref(),
            Some("https://example.com/x")
        );
        assert_eq!(
            link_from_args(args(&["Simprint.exe", "--simprint-root=C:/d", "--", "HTTP://example.com"])).as_deref(),
            Some("HTTP://example.com")
        );
        // 没有分隔符、不是 http(s)、没有链接：都不算
        assert_eq!(link_from_args(args(&["Simprint.exe", "https://example.com/x"])), None);
        assert_eq!(link_from_args(args(&["Simprint.exe", "--", "simprint://login"])), None);
        assert_eq!(link_from_args(args(&["Simprint.exe", "--"])), None);
        assert_eq!(link_from_args(args(&["Simprint.exe"])), None);
    }

    #[test]
    fn a_link_that_splits_into_several_arguments_is_rejected_entirely() {
        // 链接里的引号会让命令行多出参数；不能从中挑一个用
        assert_eq!(link_from_args(args(&["S.exe", "--", "https://a.com/", "--simprint-root=C:/evil"])), None);
        assert_eq!(link_from_args(args(&["S.exe", "--", "https://a.com/", "https://b.com/"])), None);
    }

    #[test]
    fn the_data_root_only_counts_before_the_separator() {
        assert_eq!(
            root_from_args(args(&["S.exe", "--simprint-root=C:/data", "--", "https://a.com/"])).as_deref(),
            Some("C:/data")
        );
        // 链接那一侧的内容不能改数据目录
        assert_eq!(root_from_args(args(&["S.exe", "--", "--simprint-root=C:/evil"])), None);
        // 必须是绝对路径
        assert_eq!(root_from_args(args(&["S.exe", "--simprint-root=data"])), None);
        assert_eq!(root_from_args(args(&["S.exe", "--simprint-root="])), None);
        assert_eq!(root_from_args(args(&["S.exe"])), None);
    }

    #[test]
    fn percent_encoding_preserves_the_original_meaning_after_one_decode() {
        assert_eq!(percent_encode_all("https://a.com/x?y=1&z=%26#f"), "https%3A%2F%2Fa.com%2Fx%3Fy%3D1%26z%3D%2526%23f");
        assert_eq!(percent_encode_all("abc-_.~"), "abc-_.~");
        assert_eq!(percent_encode_all("例"), "%E4%BE%8B");
    }
}
