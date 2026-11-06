use crate::core::error::Result;
use tauri::AppHandle;
#[cfg(desktop)]
use tauri_plugin_autostart::ManagerExt;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoStartState {
    pub enabled: bool,
}

pub struct AppService;

impl AppService {
    pub fn get_auto_start_state(app: &AppHandle) -> Result<AutoStartState> {
        #[cfg(desktop)]
        {
            let enabled = app
                .autolaunch()
                .is_enabled()
                .map_err(|e| format!("获取开机自动启动状态失败: {}", e))?;

            return Ok(AutoStartState { enabled });
        }

        #[allow(unreachable_code)]
        Ok(AutoStartState { enabled: false })
    }

    pub fn set_auto_start_enabled(app: &AppHandle, enabled: bool) -> Result<AutoStartState> {
        #[cfg(desktop)]
        {
            let autolaunch = app.autolaunch();

            if enabled {
                autolaunch.enable().map_err(|e| format!("启用开机自动启动失败: {}", e))?;
            } else {
                autolaunch.disable().map_err(|e| format!("关闭开机自动启动失败: {}", e))?;
            }

            let actual_enabled = autolaunch
                .is_enabled()
                .map_err(|e| format!("获取开机自动启动状态失败: {}", e))?;

            return Ok(AutoStartState {
                enabled: actual_enabled,
            });
        }

        #[allow(unreachable_code)]
        Ok(AutoStartState { enabled: false })
    }
}
