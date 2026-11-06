use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;

use crate::infrastructure::persistence::tauri_store;

const ACCOUNT_SECURITY_STORE_KEY: &str = "accountSecurity";
const SESSION_LOCKED_EVENT: &str = "session_locked";
const SESSION_UNLOCKED_EVENT: &str = "session_unlocked";
const SESSION_LOCK_CHECK_INTERVAL: Duration = Duration::from_secs(1);

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountSecuritySettingsSnapshot {
    auto_lock_enabled: Option<bool>,
    auto_lock_time: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLockStateResponse {
    pub locked: bool,
    pub locked_at_ms: Option<u64>,
}

#[derive(Debug)]
struct SessionLockInner {
    is_locked: bool,
    last_activity_at: Instant,
    locked_at_ms: Option<u64>,
}

#[derive(Clone)]
pub struct SessionLockManager {
    inner: Arc<RwLock<SessionLockInner>>,
}

impl SessionLockManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(SessionLockInner {
                is_locked: false,
                last_activity_at: Instant::now(),
                locked_at_ms: None,
            })),
        }
    }

    pub async fn report_activity(&self) {
        let mut inner = self.inner.write().await;
        if inner.is_locked {
            return;
        }
        inner.last_activity_at = Instant::now();
    }

    pub async fn get_state(&self) -> SessionLockStateResponse {
        let inner = self.inner.read().await;
        SessionLockStateResponse {
            locked: inner.is_locked,
            locked_at_ms: inner.locked_at_ms,
        }
    }

    pub async fn unlock(&self, app: &AppHandle) {
        let should_emit = {
            let mut inner = self.inner.write().await;
            let was_locked = inner.is_locked;
            inner.is_locked = false;
            inner.locked_at_ms = None;
            inner.last_activity_at = Instant::now();
            was_locked
        };

        if should_emit {
            let _ = app.emit(
                SESSION_UNLOCKED_EVENT,
                SessionLockStateResponse {
                    locked: false,
                    locked_at_ms: None,
                },
            );
        }
    }

    async fn lock(&self, app: &AppHandle) {
        let payload = {
            let mut inner = self.inner.write().await;
            if inner.is_locked {
                return;
            }

            inner.is_locked = true;
            inner.locked_at_ms = Some(now_unix_ms());

            SessionLockStateResponse {
                locked: true,
                locked_at_ms: inner.locked_at_ms,
            }
        };

        let _ = app.emit(SESSION_LOCKED_EVENT, payload);
    }
}

pub fn init_session_lock_background(app: AppHandle, manager: SessionLockManager) {
    tokio::spawn(async move {
        manager.report_activity().await;

        loop {
            tokio::time::sleep(SESSION_LOCK_CHECK_INTERVAL).await;

            let Some(timeout) = get_auto_lock_timeout(&app) else {
                continue;
            };

            let should_lock = {
                let inner = manager.inner.read().await;
                !inner.is_locked && inner.last_activity_at.elapsed() >= timeout
            };

            if should_lock {
                manager.lock(&app).await;
            }
        }
    });
}

fn get_auto_lock_timeout(app: &AppHandle) -> Option<Duration> {
    let raw = tauri_store::get_store_key(app, ACCOUNT_SECURITY_STORE_KEY)?;
    let settings: AccountSecuritySettingsSnapshot = serde_json::from_value(raw).ok()?;

    if !settings.auto_lock_enabled.unwrap_or(false) {
        return None;
    }

    let minutes = settings.auto_lock_time.unwrap_or(5);
    Some(Duration::from_secs(minutes.saturating_mul(60)))
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
