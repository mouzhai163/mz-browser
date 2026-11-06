use serde_json::Value;

use crate::infrastructure::runtime::FingerprintConfig;

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
        webgl_renderer: get_string(&fingerprint_settings, "webglRenderer"),
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
