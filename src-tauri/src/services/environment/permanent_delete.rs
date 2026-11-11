//! 彻底删除环境时，业务层只删数据库记录，这里负责浏览器数据目录。
//!
//! 目录先删：删不掉时环境还留在回收站，可以再试；反过来记录没了，目录就再也清不掉了。
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::Value;
use uuid::Uuid;

use crate::{
    app::handle::get_app_handle,
    domain::environment::EnvironmentStatus,
    services::environment::{EnvironmentLaunchRuntimeService, kernel::runtime_bridge},
};

const SINGLE_ROUTE: &str = "environments/recycle-bin/permanent-delete";
const BATCH_ROUTE: &str = "environments/recycle-bin/batch-permanent-delete";
/// 浏览器刚退出时文件可能还占用一小会儿
const REMOVE_ATTEMPTS: u32 = 5;
const REMOVE_RETRY_DELAY: Duration = Duration::from_millis(500);

/// 这个请求要彻底删除的环境。其他路由，或者请求里有无效的 ID（业务层会拒绝）时返回空。
fn environments_to_delete(route: &str, data: &Value) -> Vec<Uuid> {
    let values = match route.trim_start_matches('/') {
        SINGLE_ROUTE => vec![data["uuid"].clone()],
        BATCH_ROUTE => data["uuids"].as_array().cloned().unwrap_or_default(),
        _ => return Vec::new(),
    };
    values
        .iter()
        .map(|value| Uuid::parse_str(value.as_str()?).ok())
        .collect::<Option<Vec<_>>>()
        .unwrap_or_default()
}

/// 路径只由解析过的 UUID 拼成，不会指向 cache 目录之外。
fn profile_dir(cache_path: &str, env: &Uuid) -> PathBuf {
    Path::new(cache_path.trim()).join("browser").join("cache").join(env.to_string())
}

fn is_stopped(status: Option<EnvironmentStatus>) -> bool {
    matches!(status, None | Some(EnvironmentStatus::Stopped | EnvironmentStatus::Error))
}

/// 分发业务请求；彻底删除环境时先确认没在运行，删除成功后清理数据目录。
pub async fn dispatch_post(
    context: &business::svc_ctx::SvcCtx,
    route: &str,
    data: &Value,
) -> Option<Result<Value, String>> {
    let environments = environments_to_delete(route, data);
    for env in &environments {
        match runtime_bridge::get_environment_status(env.to_string()).await {
            Ok(status) => {
                if !is_stopped(status) {
                    return Some(Err("环境正在运行，请先关闭再删除".to_string()));
                }
            }
            Err(error) => return Some(Err(error.to_string())),
        }
    }

    if !environments.is_empty() {
        if let Err(error) = remove_profiles(environments.clone()).await {
            return Some(Err(error));
        }
    }
    business::dispatcher::dispatch_post(context, route, data).await
}

async fn remove_profiles(environments: Vec<Uuid>) -> Result<(), String> {
    let app = get_app_handle().map_err(|error| error.to_string())?;
    let paths = EnvironmentLaunchRuntimeService::resolve_launch_paths(&app).map_err(|error| error.to_string())?;
    // 配置目录可能有几百 MB，不能占着异步线程删
    tokio::task::spawn_blocking(move || {
        for env in &environments {
            remove_profile_dir(&profile_dir(&paths.cache_path, env))
                .map_err(|error| format!("环境 {env} 的数据目录删除失败，请稍后再试: {error}"))?;
        }
        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

fn remove_profile_dir(dir: &Path) -> std::io::Result<()> {
    for attempt in 1..=REMOVE_ATTEMPTS {
        match std::fs::remove_dir_all(dir) {
            Ok(()) => return Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(error) if attempt == REMOVE_ATTEMPTS => return Err(error),
            Err(_) => std::thread::sleep(REMOVE_RETRY_DELAY),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const ID: &str = "11111111-1111-4111-8111-111111111111";

    #[test]
    fn only_permanent_delete_routes_select_environments() {
        assert_eq!(environments_to_delete(SINGLE_ROUTE, &json!({ "uuid": ID })).len(), 1);
        assert_eq!(environments_to_delete(BATCH_ROUTE, &json!({ "uuids": [ID, ID] })).len(), 2);
        assert!(environments_to_delete("environments/delete", &json!({ "uuid": ID })).is_empty());
    }

    #[test]
    fn a_request_with_invalid_ids_removes_nothing_and_paths_stay_inside_the_cache() {
        assert!(environments_to_delete(BATCH_ROUTE, &json!({ "uuids": ["../../etc", 1, ID] })).is_empty());
        let ids = environments_to_delete(BATCH_ROUTE, &json!({ "uuids": [ID] }));
        let dir = profile_dir("C:/cache", &ids[0]);
        assert_eq!(dir, Path::new("C:/cache").join("browser").join("cache").join(ID));
    }

    #[test]
    fn a_missing_directory_counts_as_removed() {
        let dir = std::env::temp_dir().join(format!("mz-profile-test-{}", Uuid::new_v4()));
        assert!(remove_profile_dir(&dir).is_ok());
        std::fs::create_dir_all(dir.join("Default")).unwrap();
        std::fs::write(dir.join("Default").join("Cookies"), b"x").unwrap();
        assert!(remove_profile_dir(&dir).is_ok());
        assert!(!dir.exists());
    }

    #[test]
    fn running_environments_are_not_deletable() {
        assert!(is_stopped(None));
        assert!(is_stopped(Some(EnvironmentStatus::Stopped)));
        assert!(!is_stopped(Some(EnvironmentStatus::Running)));
        assert!(!is_stopped(Some(EnvironmentStatus::Starting)));
    }
}
