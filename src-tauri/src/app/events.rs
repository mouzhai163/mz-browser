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
            // 同步器窗口是唯一的操作入口，窗口关了不能让同步继续在后台跑
            if window.label() == "syncer" {
                tauri::async_runtime::spawn(async {
                    if let Err(error) = crate::services::environment::EnvironmentService::stop_sync().await {
                        log::warn!("failed to stop sync when its window closed: {error}");
                    }
                });
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
