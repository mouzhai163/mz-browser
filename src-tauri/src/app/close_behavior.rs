use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;

const GENERAL_SETTINGS_STORE_KEY: &str = "general";

static EXPLICIT_QUIT_REQUESTED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum WindowCloseAction {
    HideToTray,
    QuitApplication,
}

impl Default for WindowCloseAction {
    fn default() -> Self {
        Self::HideToTray
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeneralSettingsSnapshot {
    window_close_action: Option<WindowCloseAction>,
}

fn close_action_from_settings_value(raw: serde_json::Value) -> WindowCloseAction {
    serde_json::from_value::<GeneralSettingsSnapshot>(raw)
        .ok()
        .and_then(|settings| settings.window_close_action)
        .unwrap_or_default()
}

/// 主窗口关闭按钮是否应当真正退出应用。默认保持历史行为：隐藏到后台。
pub fn should_quit_on_main_window_close(app: &AppHandle) -> bool {
    crate::infrastructure::persistence::tauri_store::get_store_key(app, GENERAL_SETTINGS_STORE_KEY)
        .map(close_action_from_settings_value)
        .is_some_and(|action| matches!(action, WindowCloseAction::QuitApplication))
}

/// 统一的用户显式退出入口。先记录意图，再让 Tauri 走正常 ExitRequested/Exit 流程。
pub fn request_application_quit(app: &AppHandle) {
    if EXPLICIT_QUIT_REQUESTED.swap(true, Ordering::AcqRel) {
        return;
    }
    log::info!("Explicit application quit requested");
    app.exit(0);
}

/// 只有用户显式退出时才放行 ExitRequested；普通最后一个窗口关闭仍保持后台运行。
pub fn explicit_quit_requested() -> bool {
    EXPLICIT_QUIT_REQUESTED.load(Ordering::Acquire)
}

#[cfg(test)]
mod tests {
    use super::close_action_from_settings_value;

    #[test]
    fn missing_or_invalid_close_action_keeps_the_background_default() {
        assert!(matches!(
            close_action_from_settings_value(serde_json::json!({})),
            super::WindowCloseAction::HideToTray
        ));
        assert!(matches!(
            close_action_from_settings_value(serde_json::json!({
                "windowCloseAction": "not-a-real-action"
            })),
            super::WindowCloseAction::HideToTray
        ));
    }

    #[test]
    fn quit_application_close_action_is_read_from_general_settings() {
        assert!(matches!(
            close_action_from_settings_value(serde_json::json!({
                "windowCloseAction": "quit-application"
            })),
            super::WindowCloseAction::QuitApplication
        ));
    }
}
