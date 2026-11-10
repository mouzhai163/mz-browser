//! Firefox（Camoufox）内核的启动配置。
//!
//! Chromium 内核通过命名管道从运行时拿指纹；Camoufox 在启动时从环境变量读一份 JSON
//! （`CAMOU_CONFIG`，键名见内核包里的 `properties.json`），Firefox 偏好项走 `CAMOU_PREFS`。
//! 这里把环境配置换算成这两份数据，环境变量的分段由运行时负责。
//!
//! 原则和 Camoufox 一致：只改能识别出机器或网络的值，其余保持 Firefox 原样。
//! Canvas / 音频 / ClientRects 噪声在真实 Firefox 上不存在，噪声本身就是特征，所以不加。

use serde_json::{Map, Value, json};

use crate::infrastructure::runtime::{FingerprintConfig, GeckoLaunchSpec};

/// 真实 Windows Firefox 的 WebGL 渲染器字符串：ANGLE 名称后面没有 PCI 设备号，结尾是 ", or similar"。
fn firefox_webgl_renderer(renderer: &str) -> String {
    let renderer = renderer.trim();
    if renderer.ends_with(", or similar") || !renderer.starts_with("ANGLE (") {
        return renderer.to_string();
    }
    // Chromium 的写法：ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)
    let mut name = renderer.to_string();
    if let Some(start) = name.find(" (0x") {
        if let Some(len) = name[start..].find(')') {
            name.replace_range(start..start + len + 1, "");
        }
    }
    let name = name.trim_end_matches(", D3D11)").trim_end_matches(')').to_string();
    format!("{name}), or similar")
}

fn locale_parts(language: &str) -> Option<(String, Option<String>)> {
    let first = language.split(',').next()?.trim();
    if first.is_empty() || first.eq_ignore_ascii_case("ip") {
        return None;
    }
    let mut parts = first.split(['-', '_']);
    let lang = parts.next()?.to_ascii_lowercase();
    let region = parts.last().filter(|part| part.len() == 2).map(str::to_ascii_uppercase);
    Some((lang, region))
}

fn parse_geolocation(value: &str) -> Option<(f64, f64)> {
    let value = value.trim();
    if let Ok(object) = serde_json::from_str::<Value>(value) {
        let lat = object.get("latitude").and_then(Value::as_f64);
        let lng = object.get("longitude").and_then(Value::as_f64);
        if let (Some(lat), Some(lng)) = (lat, lng) {
            return Some((lat, lng));
        }
    }
    let (lat, lng) = value.split_once(',')?;
    let (lat, lng) = (lat.trim().parse().ok()?, lng.trim().parse().ok()?);
    ((-90.0..=90.0).contains(&lat) && (-180.0..=180.0).contains(&lng)).then_some((lat, lng))
}

fn resolution(config: &FingerprintConfig) -> Option<(i64, i64)> {
    let value = config.resolution.as_ref()?;
    let width = value.get("width").and_then(Value::as_i64)?;
    let height = value.get("height").and_then(Value::as_i64)?;
    (width > 0 && height > 0).then_some((width, height))
}

/// `exit_ip`：WebRTC 选“替换”时，ICE 候选里要写成的出口 IP。
pub fn build_gecko_launch(
    config: &FingerprintConfig,
    window: Option<(i32, i32, i32, i32)>,
    exit_ip: Option<&str>,
) -> GeckoLaunchSpec {
    let mut camou = Map::new();
    let mut prefs = Map::new();
    let mut set = |key: &str, value: Value| {
        camou.insert(key.to_string(), value);
    };

    if let Some(user_agent) = config.user_agent.as_deref().filter(|ua| !ua.trim().is_empty()) {
        set("navigator.userAgent", json!(user_agent));
        // Firefox 的 oscpu / platform / appVersion 都由 UA 里的系统决定
        let (platform, oscpu, app_version) = if user_agent.contains("Macintosh") {
            ("MacIntel", "Intel Mac OS X 10.15", "5.0 (Macintosh)")
        } else if user_agent.contains("X11") || user_agent.contains("Linux") {
            ("Linux x86_64", "Linux x86_64", "5.0 (X11)")
        } else {
            ("Win32", "Windows NT 10.0; Win64; x64", "5.0 (Windows)")
        };
        set("navigator.platform", json!(platform));
        set("navigator.oscpu", json!(oscpu));
        set("navigator.appVersion", json!(app_version));
    }
    if let Some(cores) = config.hardware_concurrency.filter(|cores| *cores > 0) {
        set("navigator.hardwareConcurrency", json!(cores));
    }
    if let Some(points) = config.max_touch_points.filter(|points| *points >= 0) {
        set("navigator.maxTouchPoints", json!(points));
    }

    if let Some((width, height)) = resolution(config) {
        // 任务栏占掉的高度：Windows 10/11 在 100% 缩放下是 40/48 像素，这里取 Windows 11 的
        let avail_height = (height - 48).max(1);
        set("screen.width", json!(width));
        set("screen.height", json!(height));
        set("screen.availWidth", json!(width));
        set("screen.availHeight", json!(avail_height));
        set("screen.availLeft", json!(0));
        set("screen.availTop", json!(0));
    }
    // Windows / Linux 上的 Firefox 恒报 24
    let depth = config.color_depth.filter(|depth| *depth == 24 || *depth == 30).unwrap_or(24);
    set("screen.colorDepth", json!(depth));
    set("screen.pixelDepth", json!(depth));

    if let Some(timezone) = config.timezone.as_deref().filter(|tz| tz.contains('/')) {
        set("timezone", json!(timezone));
    }
    let language = config.language.as_deref().or(config.interface_language.as_deref());
    let locale = language.and_then(locale_parts);
    if let Some((lang, region)) = &locale {
        set("locale:language", json!(lang));
        if let Some(region) = region {
            set("locale:region", json!(region));
        }
    }
    // 界面语言（表单控件文字、校验提示）跟随环境语言，否则会露出宿主机的语言
    let requested = locale
        .as_ref()
        .map(|(lang, region)| match region {
            Some(region) => format!("{lang}-{region}"),
            None => lang.clone(),
        })
        .unwrap_or_else(|| "en-US".to_string());
    prefs.insert("intl.locale.requested".into(), json!(requested));

    match config.geolocation_prompt.as_deref() {
        Some("forbid") => {
            prefs.insert("permissions.default.geo".into(), json!(2));
        }
        _ => {
            if let Some((lat, lng)) = config.geolocation.as_deref().and_then(parse_geolocation) {
                set("geolocation:latitude", json!(lat));
                set("geolocation:longitude", json!(lng));
                set("geolocation:accuracy", json!(30.0));
                // 页面能拿到坐标时，permissions.query 也必须是 granted，否则两者矛盾
                if config.geolocation_prompt.as_deref() == Some("allow") {
                    prefs.insert("permissions.default.geo".into(), json!(1));
                }
            }
        }
    }

    match config.webrtc.as_deref() {
        Some("real") => {}
        Some("replace") => {
            if let Some(ip) = exit_ip.filter(|ip| !ip.trim().is_empty()) {
                let key = if ip.contains(':') { "webrtc:ipv6" } else { "webrtc:ipv4" };
                set(key, json!(ip.trim()));
            }
            // 有代理时只让候选走代理，不暴露本机网卡地址
            prefs.insert("media.peerconnection.ice.proxy_only_if_behind_proxy".into(), json!(true));
            prefs.insert("media.peerconnection.ice.default_address_only".into(), json!(true));
        }
        _ => {
            prefs.insert("media.peerconnection.enabled".into(), json!(false));
        }
    }

    let custom_webgl = config.webgl_info.as_deref() != Some("real");
    if custom_webgl {
        if let (Some(vendor), Some(renderer)) = (
            config.webgl_vendor.as_deref().filter(|v| !v.trim().is_empty()),
            config.webgl_renderer.as_deref().filter(|r| !r.trim().is_empty()),
        ) {
            set("webGl:vendor", json!(vendor));
            set("webGl:renderer", json!(firefox_webgl_renderer(renderer)));
        }
    }
    prefs.insert("webgl.force-enabled".into(), json!(true));

    // 字体：宿主机是 Windows、环境也是 Windows 时 Camoufox 用系统真实字体，列表只决定页面能看到哪些
    if let Some(fonts) = config
        .font_list
        .as_ref()
        .and_then(|list| list.get("fonts"))
        .and_then(Value::as_array)
        .filter(|fonts| !fonts.is_empty())
    {
        set("fonts", Value::Array(fonts.clone()));
    }

    // 语音：真实 / 系统模式用本机（Windows 自带的 SAPI 语音就是真实 Firefox 会报的），其余一律不报，
    // 否则会把宿主机装的语音全部暴露出来
    if !matches!(config.speech_voices.as_deref(), Some("real" | "system")) {
        set("voices", json!([]));
        set("voices:blockIfNotDefined", json!(true));
    }

    let dnt = config.do_not_track.unwrap_or(false);
    prefs.insert("privacy.donottrackheader.enabled".into(), json!(dnt));
    if config.images == Some(false) {
        prefs.insert("permissions.default.image".into(), json!(2));
    }
    if config.sound == Some(false) {
        prefs.insert("media.volume_scale".into(), json!("0.0"));
    }
    // Windows 11 默认是悬浮滚动条（页面量出 0 px 宽）
    prefs.insert("ui.useOverlayScrollbars".into(), json!(1));

    if let Some((x, y, width, height)) = window {
        set("window.outerWidth", json!(width));
        set("window.outerHeight", json!(height));
        set("window.screenX", json!(x));
        set("window.screenY", json!(y));
    }

    GeckoLaunchSpec {
        config: camou,
        prefs,
        window,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(value: Value) -> FingerprintConfig {
        let mut base = json!({
            "language": "ja-JP", "interface_language": "ja-JP", "timezone": "Asia/Tokyo",
            "geolocation_prompt": "ask", "geolocation": "35.68,139.76",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0",
            "resolution": {"width": 1920, "height": 1080}, "color_depth": 24,
            "hardware_concurrency": 8, "max_touch_points": 0, "webrtc": "disable",
            "webgl_info": "custom", "webgl_vendor": "Google Inc. (NVIDIA)",
            "webgl_renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "speech_voices": "random", "do_not_track": false
        });
        for (key, item) in value.as_object().unwrap() {
            base[key] = item.clone();
        }
        serde_json::from_value(base).unwrap()
    }

    #[test]
    fn chrome_style_angle_renderers_are_written_the_way_firefox_reports_them() {
        assert_eq!(
            firefox_webgl_renderer("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)"),
            "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0), or similar"
        );
        let firefox = "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0), or similar";
        assert_eq!(firefox_webgl_renderer(firefox), firefox);
    }

    #[test]
    fn a_windows_environment_becomes_a_complete_camoufox_identity() {
        let spec = build_gecko_launch(&config(json!({})), Some((10, 20, 1200, 800)), None);
        let c = &spec.config;
        assert_eq!(c["navigator.platform"], "Win32");
        assert_eq!(c["navigator.oscpu"], "Windows NT 10.0; Win64; x64");
        assert_eq!(c["navigator.hardwareConcurrency"], 8);
        assert_eq!(c["screen.width"], 1920);
        assert_eq!(c["screen.availHeight"], 1032);
        assert_eq!(c["timezone"], "Asia/Tokyo");
        assert_eq!(c["locale:language"], "ja");
        assert_eq!(c["locale:region"], "JP");
        assert_eq!(c["geolocation:latitude"], 35.68);
        assert!(c["webGl:renderer"].as_str().unwrap().ends_with(", or similar"));
        assert_eq!(c["voices"], json!([]));
        assert_eq!(c["window.screenX"], 10);
        assert_eq!(spec.prefs["intl.locale.requested"], "ja-JP");
        assert_eq!(spec.prefs["media.peerconnection.enabled"], false);
    }

    #[test]
    fn webrtc_replace_reports_the_exit_ip_and_real_keeps_firefox_defaults() {
        let spec = build_gecko_launch(&config(json!({"webrtc": "replace"})), None, Some("203.0.113.9"));
        assert_eq!(spec.config["webrtc:ipv4"], "203.0.113.9");
        assert!(!spec.prefs.contains_key("media.peerconnection.enabled"));

        let spec = build_gecko_launch(&config(json!({"webrtc": "real"})), None, None);
        assert!(!spec.config.contains_key("webrtc:ipv4"));
        assert!(!spec.prefs.contains_key("media.peerconnection.enabled"));
    }

    #[test]
    fn real_mode_leaves_webgl_and_voices_to_the_machine() {
        let spec = build_gecko_launch(&config(json!({"webgl_info": "real", "speech_voices": "real"})), None, None);
        assert!(!spec.config.contains_key("webGl:renderer"));
        assert!(!spec.config.contains_key("voices"));
        let spec = build_gecko_launch(&config(json!({"speech_voices": "system"})), None, None);
        assert!(!spec.config.contains_key("voices"));
    }

    #[test]
    fn forbidden_geolocation_sends_no_coordinates() {
        let spec = build_gecko_launch(&config(json!({"geolocation_prompt": "forbid"})), None, None);
        assert!(!spec.config.contains_key("geolocation:latitude"));
        assert_eq!(spec.prefs["permissions.default.geo"], 2);
    }
}
