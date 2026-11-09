use once_cell::sync::Lazy;
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::{Mutex, OwnedMutexGuard};

static KERNEL_PREPARE_LOCKS: Lazy<Mutex<HashMap<String, Arc<Mutex<()>>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 新内核下载失败后，这段时间内不再尝试升级：已装的旧版本能用，批量启动时不必每个环境都等一轮超时。
const UPGRADE_RETRY_COOLDOWN: Duration = Duration::from_secs(10 * 60);

static FAILED_UPGRADES: Lazy<std::sync::Mutex<HashMap<String, Instant>>> =
    Lazy::new(|| std::sync::Mutex::new(HashMap::new()));

pub fn remember_upgrade_failure(kernel_id: &str) {
    FAILED_UPGRADES
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .insert(kernel_id.to_string(), Instant::now());
}

pub fn upgrade_recently_failed(kernel_id: &str) -> bool {
    FAILED_UPGRADES
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .get(kernel_id)
        .is_some_and(|failed_at| failed_at.elapsed() < UPGRADE_RETRY_COOLDOWN)
}

pub async fn acquire_kernel_prepare_lock(kernel_value: &str) -> OwnedMutexGuard<()> {
    let lock = {
        let mut guard = KERNEL_PREPARE_LOCKS.lock().await;
        guard
            .entry(kernel_value.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    };

    lock.lock_owned().await
}
