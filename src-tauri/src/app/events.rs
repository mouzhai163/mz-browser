use tauri::{AppHandle, RunEvent, Window, WindowEvent};

/// 窗口事件处理
pub fn window_event_handle(window: &Window, event: &WindowEvent) {
    match event {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            // 窗口如果是main，则阻止关闭
            if window.label() == "main" {
                api.prevent_close();
                let _ = window.hide();
            }
        }
        _ => {}
    }
}

/// 运行事件处理
pub fn run_event_handle(_app_handle: &AppHandle, event: RunEvent) {
    match event {
        tauri::RunEvent::ExitRequested { api, .. } => {
            api.prevent_exit();
        }
        tauri::RunEvent::Exit => {
            tauri::async_runtime::spawn(async {
                if let Err(error) = crate::app::lifecycle::shutdown().await {
                    log::warn!("failed to shutdown app lifecycle cleanly: {}", error);
                }
            });
        }
        _ => {}
    }
}
