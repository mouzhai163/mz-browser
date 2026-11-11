use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use serde::Serialize;
use serde_json::Value;
use std::env;
use std::path::PathBuf;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tokio::fs;
use tokio::process::Command;
use tokio::time::timeout;
use uuid::Uuid;

use crate::core::paths::PathManager;

#[derive(Debug, Serialize)]
pub struct LocalRpaScriptExecutionResult {
    pub value: String,
}

#[derive(Debug, serde::Deserialize)]
struct LocalRpaScriptEnvelope {
    ok: bool,
    value: Option<String>,
    error: Option<String>,
}

#[tauri::command]
pub async fn execute_local_rpa_script(
    script: String,
    variables: Value,
) -> std::result::Result<LocalRpaScriptExecutionResult, String> {
    ensure_node_runtime().await?;

    let script_path = build_temp_script_path();
    let script_source = build_runner_script(&script, &variables)?;

    fs::write(&script_path, script_source)
        .await
        .map_err(|_| "LOCAL_SCRIPT_PREPARE_FAILED".to_string())?;

    let mut command = Command::new("node");
    command.arg(&script_path);
    // 超时后 command.output() 的 future 被丢弃，这里保证 Node 进程跟着结束
    command.kill_on_drop(true);
    apply_hidden_window_flags(&mut command);

    let execution = timeout(Duration::from_secs(60), command.output()).await;

    let cleanup_result = fs::remove_file(&script_path).await;
    if cleanup_result.is_err() {
        let _ = cleanup_result;
    }

    let output = match execution {
        Ok(Ok(output)) => output,
        Ok(Err(error)) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err("NODE_RUNTIME_NOT_FOUND".to_string());
        }
        Ok(Err(_)) => return Err("LOCAL_SCRIPT_EXECUTION_FAILED".to_string()),
        Err(_) => return Err("LOCAL_SCRIPT_TIMEOUT".to_string()),
    };

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if let Ok(envelope) = serde_json::from_str::<LocalRpaScriptEnvelope>(&stdout) {
        if envelope.ok {
            return Ok(LocalRpaScriptExecutionResult {
                value: envelope.value.unwrap_or_default(),
            });
        }

        return Err(envelope
            .error
            .filter(|message| !message.trim().is_empty())
            .unwrap_or_else(|| "LOCAL_SCRIPT_EXECUTION_FAILED".to_string()));
    }

    if !stderr.is_empty() {
        return Err(stderr);
    }

    if !stdout.is_empty() {
        return Err(stdout);
    }

    if !output.status.success() {
        return Err("LOCAL_SCRIPT_EXECUTION_FAILED".to_string());
    }

    Ok(LocalRpaScriptExecutionResult {
        value: String::new(),
    })
}

/// 运行记录的文件都放在 data/rpa-runs/<任务>/<运行>/ 下。
/// 路径只由解析过的 UUID 拼成，前端传不出这个目录。
fn rpa_task_dir(task_uuid: &str) -> std::result::Result<PathBuf, String> {
    let task = Uuid::parse_str(task_uuid).map_err(|_| "RPA_INVALID_ID".to_string())?;
    let data = PathManager::get_data_dir().map_err(|error| error.to_string())?;
    Ok(data.join("rpa-runs").join(task.to_string()))
}

fn rpa_run_dir(task_uuid: &str, run_uuid: &str) -> std::result::Result<PathBuf, String> {
    let run = Uuid::parse_str(run_uuid).map_err(|_| "RPA_INVALID_ID".to_string())?;
    Ok(rpa_task_dir(task_uuid)?.join(run.to_string()))
}

async fn remove_dir_if_present(dir: PathBuf) -> std::result::Result<(), String> {
    match fs::remove_dir_all(&dir).await {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

/// 保存一张运行截图，返回文件名
#[tauri::command]
pub async fn save_rpa_run_screenshot(
    task_uuid: String,
    run_uuid: String,
    image_base64: String,
) -> std::result::Result<String, String> {
    let bytes = BASE64
        .decode(image_base64.as_bytes())
        .map_err(|_| "RPA_INVALID_IMAGE".to_string())?;
    let dir = rpa_run_dir(&task_uuid, &run_uuid)?;
    fs::create_dir_all(&dir).await.map_err(|error| error.to_string())?;
    let file = format!("{}.png", Uuid::new_v4());
    fs::write(dir.join(&file), bytes)
        .await
        .map_err(|error| error.to_string())?;
    Ok(file)
}

/// 读取一张运行截图，返回 base64
#[tauri::command]
pub async fn read_rpa_run_screenshot(
    task_uuid: String,
    run_uuid: String,
    file: String,
) -> std::result::Result<String, String> {
    let id = file
        .strip_suffix(".png")
        .and_then(|stem| Uuid::parse_str(stem).ok())
        .ok_or_else(|| "RPA_INVALID_ID".to_string())?;
    let path = rpa_run_dir(&task_uuid, &run_uuid)?.join(format!("{id}.png"));
    let bytes = fs::read(path).await.map_err(|error| error.to_string())?;
    Ok(BASE64.encode(bytes))
}

/// 删除运行记录的文件
#[tauri::command]
pub async fn delete_rpa_run_files(
    task_uuid: String,
    run_uuids: Vec<String>,
) -> std::result::Result<(), String> {
    for run_uuid in run_uuids {
        remove_dir_if_present(rpa_run_dir(&task_uuid, &run_uuid)?).await?;
    }
    Ok(())
}

/// 删除任务的全部运行文件
#[tauri::command]
pub async fn delete_rpa_task_files(task_uuids: Vec<String>) -> std::result::Result<(), String> {
    for task_uuid in task_uuids {
        remove_dir_if_present(rpa_task_dir(&task_uuid)?).await?;
    }
    Ok(())
}

/// 发送系统通知
#[tauri::command]
pub async fn send_rpa_notification(
    app: AppHandle,
    title: String,
    body: String,
) -> std::result::Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| error.to_string())
}

async fn ensure_node_runtime() -> std::result::Result<(), String> {
    let mut command = Command::new("node");
    command.arg("--version");
    apply_hidden_window_flags(&mut command);

    match command.output().await {
        Ok(output) if output.status.success() => Ok(()),
        Ok(_) => Err("NODE_RUNTIME_NOT_FOUND".to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Err("NODE_RUNTIME_NOT_FOUND".to_string())
        }
        Err(_) => Err("NODE_RUNTIME_NOT_FOUND".to_string()),
    }
}

fn build_temp_script_path() -> PathBuf {
    env::temp_dir().join(format!("mz-rpa-script-{}.cjs", Uuid::new_v4()))
}

fn apply_hidden_window_flags(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
}

fn build_runner_script(script: &str, variables: &Value) -> std::result::Result<String, String> {
    let script_body =
        serde_json::to_string(script).map_err(|_| "LOCAL_SCRIPT_PREPARE_FAILED".to_string())?;
    let variables_json =
        serde_json::to_string(variables).map_err(|_| "LOCAL_SCRIPT_PREPARE_FAILED".to_string())?;

    Ok(format!(
        r#"const vars = {variables_json};
const AsyncFunction = Object.getPrototypeOf(async function () {{}}).constructor;

(async () => {{
  try {{
    const runner = new AsyncFunction('vars', 'require', 'fetch', {script_body});
    const localFetch =
      typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined;
    const result = await runner(vars, require, localFetch);

    let value = '';
    if (typeof result === 'string') {{
      value = result;
    }} else if (result == null) {{
      value = '';
    }} else if (typeof result === 'object') {{
      value = JSON.stringify(result);
    }} else {{
      value = String(result);
    }}

    process.stdout.write(JSON.stringify({{ ok: true, value }}));
  }} catch (error) {{
    process.stdout.write(
      JSON.stringify({{
        ok: false,
        error: error instanceof Error ? error.message : String(error ?? 'LOCAL_SCRIPT_EXECUTION_FAILED'),
      }})
    );
    process.exitCode = 1;
  }}
}})();
"#
    ))
}
