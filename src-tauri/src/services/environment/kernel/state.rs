use once_cell::sync::Lazy;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{Mutex, OwnedMutexGuard};

static KERNEL_PREPARE_LOCKS: Lazy<Mutex<HashMap<String, Arc<Mutex<()>>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

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
