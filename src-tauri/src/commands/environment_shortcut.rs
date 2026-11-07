//! 环境桌面快捷方式命令：命令层只做参数转发，逻辑在 services::environment_shortcut。

use serde::{Deserialize, Serialize};

use crate::services::environment_shortcut::shortcut;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutRequest {
    pub env_uuid: String,
    pub env_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutResult {
    pub env_uuid: String,
    pub ok: bool,
    /// 创建成功时的快捷方式完整路径
    pub path: Option<String>,
    /// 失败原因
    pub message: Option<String>,
}

/// 在桌面上为一个或多个环境创建快捷方式（双击直接打开该环境）。逐个创建，单个失败不影响其他。
#[tauri::command]
pub async fn create_environment_shortcuts(items: Vec<ShortcutRequest>) -> Vec<ShortcutResult> {
    let mut results = Vec::with_capacity(items.len());
    for item in items {
        let env_uuid = item.env_uuid.clone();
        // 写 .lnk 要启动 PowerShell，放到阻塞线程里，不卡住异步运行时。
        let outcome = tokio::task::spawn_blocking(move || {
            shortcut::create_desktop_shortcut(&item.env_uuid, &item.env_name)
        })
        .await;
        results.push(match outcome {
            Ok(Ok(path)) => ShortcutResult {
                env_uuid,
                ok: true,
                path: Some(path.to_string_lossy().to_string()),
                message: None,
            },
            Ok(Err(error)) => {
                ShortcutResult { env_uuid, ok: false, path: None, message: Some(error.to_string()) }
            }
            Err(error) => ShortcutResult {
                env_uuid,
                ok: false,
                path: None,
                message: Some(format!("创建快捷方式失败: {error}")),
            },
        });
    }
    results
}
