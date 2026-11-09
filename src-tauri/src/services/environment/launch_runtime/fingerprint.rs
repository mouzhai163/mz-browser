use serde_json::Value;

use crate::infrastructure::runtime::FingerprintConfig;

use super::gpu_ids::GPU_DEVICE_IDS;
use super::kernel::get_window_info;

pub(super) fn build_fingerprint_config(config: Option<&Value>) -> FingerprintConfig {
    let window_info = get_window_info(config);
    let basic_settings = get_object(config, "basic_settings");
    let fingerprint_settings = get_object(config, "fingerprint_settings");
    let device_settings = get_object(config, "device_settings");
    let preference_settings = get_object(config, "preference_settings");

    FingerprintConfig {
        language: get_string(&basic_settings, "language"),
        interface_language: get_string(&basic_settings, "interfaceLanguage"),
        timezone: get_string(&basic_settings, "timezone"),
        geolocation_prompt: get_string(&basic_settings, "geolocationPrompt"),
        geolocation: get_json_string(&basic_settings, "geolocation"),
        platform: get_string_from_map(&window_info, "system"),
        // 环境里存的都是 Windows 的版本号；macOS / Linux 环境发出去会和 platform 矛盾
        platform_version: get_string_from_map(&window_info, "platformVersion")
            .filter(|_| window_info.get("system").and_then(Value::as_str) == Some("Windows")),
        user_agent: get_string_from_map(&window_info, "userAgent"),
        sound: get_bool(&basic_settings, "sound"),
        images: get_bool(&basic_settings, "images"),
        video: get_bool(&basic_settings, "video"),
        window_size: get_string(&basic_settings, "windowSize"),
        window_width: get_i32(&basic_settings, "windowWidth"),
        window_height: get_i32(&basic_settings, "windowHeight"),
        window_position: get_string(&basic_settings, "windowPosition"),
        window_x: get_i32(&basic_settings, "windowX"),
        window_y: get_i32(&basic_settings, "windowY"),
        resolution: get_value(&fingerprint_settings, "resolution"),
        color_depth: get_i32(&fingerprint_settings, "colorDepth"),
        device_pixel_ratio: get_f64(&fingerprint_settings, "devicePixelRatio"),
        max_touch_points: get_i32(&fingerprint_settings, "maxTouchPoints"),
        canvas: get_string(&fingerprint_settings, "canvas"),
        webgl_image: get_string(&fingerprint_settings, "webglImage"),
        webgl_info: get_string(&fingerprint_settings, "webglInfo"),
        webgl_vendor: get_string(&fingerprint_settings, "webglVendor"),
        webgl_renderer: get_string(&fingerprint_settings, "webglRenderer").map(|renderer| with_device_id(&renderer)),
        webgpu: get_string(&fingerprint_settings, "webgpu"),
        font_fingerprint: get_string(&fingerprint_settings, "fontFingerprint"),
        font_list: get_value(&fingerprint_settings, "fontList"),
        audio_context: get_string(&fingerprint_settings, "audioContext"),
        speech_voices: get_string(&fingerprint_settings, "speechVoices"),
        client_rects: get_string(&fingerprint_settings, "clientRects"),
        media_devices: get_string(&fingerprint_settings, "mediaDevices"),
        webrtc: get_string(&fingerprint_settings, "webrtc"),
        do_not_track: get_bool(&fingerprint_settings, "doNotTrack"),
        device_name: get_string(&device_settings, "deviceName"),
        device_name_random: get_bool(&device_settings, "deviceNameRandom"),
        mac_address: get_string(&device_settings, "macAddress"),
        mac_address_mode: get_string(&device_settings, "macAddressMode"),
        hardware_concurrency: get_i32(&device_settings, "hardwareConcurrency"),
        device_memory: get_i32(&device_settings, "deviceMemory"),
        ssl_fingerprint: get_bool(&device_settings, "sslFingerprint"),
        port_scan_protection: get_bool(&device_settings, "portScanProtection"),
        scan_whitelist: get_string(&device_settings, "scanWhitelist"),
        hardware_acceleration: get_bool(&device_settings, "hardwareAcceleration"),
        disable_sandbox: get_bool(&device_settings, "disableSandbox"),
        startup_parameters: get_string(&device_settings, "startupParameters"),
        random_fingerprint_on_launch: get_bool(&preference_settings, "randomFingerprintOnLaunch"),
        env_id: None,
        env_name: None,
    }
}

fn get_object(source: Option<&Value>, key: &str) -> Option<serde_json::Map<String, Value>> {
    source
        .and_then(Value::as_object)
        .and_then(|obj| obj.get(key))
        .and_then(Value::as_object)
        .cloned()
}

fn get_string(source: &Option<serde_json::Map<String, Value>>, key: &str) -> Option<String> {
    source
        .as_ref()
        .and_then(|obj| obj.get(key))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

fn get_string_from_map(source: &serde_json::Map<String, Value>, key: &str) -> Option<String> {
    source.get(key).and_then(Value::as_str).map(ToOwned::to_owned)
}

fn get_json_string(source: &Option<serde_json::Map<String, Value>>, key: &str) -> Option<String> {
    source.as_ref().and_then(|obj| obj.get(key)).map(|value| match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    })
}

fn get_bool(source: &Option<serde_json::Map<String, Value>>, key: &str) -> Option<bool> {
    source.as_ref().and_then(|obj| obj.get(key)).and_then(Value::as_bool)
}

fn get_i32(source: &Option<serde_json::Map<String, Value>>, key: &str) -> Option<i32> {
    source
        .as_ref()
        .and_then(|obj| obj.get(key))
        .and_then(Value::as_i64)
        .map(|value| value as i32)
}

fn get_f64(source: &Option<serde_json::Map<String, Value>>, key: &str) -> Option<f64> {
    source.as_ref().and_then(|obj| obj.get(key)).and_then(Value::as_f64)
}

fn get_value(source: &Option<serde_json::Map<String, Value>>, key: &str) -> Option<Value> {
    source.as_ref().and_then(|obj| obj.get(key)).cloned()
}

/// 和 gen-gpu-ids.py 里的 norm() 保持一致：小写、去掉 (R)/(TM)、只留字母数字、去掉厂商名和 "series"。
fn normalize_gpu_name(name: &str) -> String {
    let lowered = name.to_lowercase().replace("(r)", "").replace("(tm)", "");
    let mut key: String = lowered.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
    for word in ["nvidia", "amd", "intel", "series"] {
        key = key.replace(word, "");
    }
    key
}

/// 新版 Chrome 的 ANGLE 显卡串带 PCI 设备号，如 "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 ...)"。
/// 旧环境里的串没有设备号，这里按型号名补上；型号查不到、串格式不认识或已经带设备号时原样返回。
pub(super) fn with_device_id(renderer: &str) -> String {
    if renderer.contains("(0x") {
        return renderer.to_string();
    }
    let Some(d3d) = renderer.find(" Direct3D11") else {
        return renderer.to_string();
    };
    let Some(comma) = renderer[..d3d].find(", ") else {
        return renderer.to_string();
    };
    let key = normalize_gpu_name(&renderer[comma + 2..d3d]);
    match GPU_DEVICE_IDS.binary_search_by(|(name, _)| (*name).cmp(key.as_str())) {
        Ok(index) => format!("{} (0x{:08X}){}", &renderer[..d3d], GPU_DEVICE_IDS[index].1, &renderer[d3d..]),
        Err(_) => renderer.to_string(),
    }
}

#[cfg(test)]
mod device_id_tests {
    use super::{build_fingerprint_config, normalize_gpu_name, with_device_id, GPU_DEVICE_IDS};

    #[test]
    fn platform_version_is_only_sent_for_windows() {
        let config_for = |system: &str| {
            serde_json::json!({ "window_info": { "system": system, "platformVersion": "19.0.0" } })
        };
        assert_eq!(
            build_fingerprint_config(Some(&config_for("Windows"))).platform_version.as_deref(),
            Some("19.0.0")
        );
        assert_eq!(build_fingerprint_config(Some(&config_for("macOS"))).platform_version, None);
        assert_eq!(build_fingerprint_config(Some(&config_for("Linux"))).platform_version, None);
    }

    #[test]
    fn table_is_sorted_for_binary_search() {
        assert!(GPU_DEVICE_IDS.windows(2).all(|pair| pair[0].0 < pair[1].0));
    }

    #[test]
    fn old_renderer_strings_get_their_device_id() {
        assert_eq!(
            with_device_id("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)"),
            "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)"
        );
        assert_eq!(
            with_device_id("ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)"),
            "ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)"
        );
        assert_eq!(
            with_device_id("ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)"),
            "ANGLE (AMD, AMD Radeon RX 580 Series (0x000067DF) Direct3D11 vs_5_0 ps_5_0, D3D11)"
        );
        assert_eq!(
            with_device_id("ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)"),
            "ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)"
        );
    }

    #[test]
    fn unknown_or_already_complete_strings_are_left_alone() {
        let complete = "ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Ti (0x00002C05) Direct3D11 vs_5_0 ps_5_0, D3D11)";
        assert_eq!(with_device_id(complete), complete);
        let unknown = "ANGLE (NVIDIA, NVIDIA Made Up 9000 Direct3D11 vs_5_0 ps_5_0, D3D11)";
        assert_eq!(with_device_id(unknown), unknown);
        assert_eq!(with_device_id("Apple M1"), "Apple M1");
        assert_eq!(with_device_id(""), "");
    }

    #[test]
    fn normalisation_matches_the_generator() {
        assert_eq!(normalize_gpu_name("NVIDIA GeForce RTX 3060"), "geforcertx3060");
        assert_eq!(normalize_gpu_name("Intel(R) UHD Graphics 630"), "uhdgraphics630");
        assert_eq!(normalize_gpu_name("AMD Radeon RX 580 Series"), "radeonrx580");
    }
}
