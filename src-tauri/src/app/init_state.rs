use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tokio::sync::OnceCell;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInitState {
    pub is_initialized: bool,
    pub is_updating: bool,
}

impl Default for AppInitState {
    fn default() -> Self {
        Self {
            is_initialized: false,
            is_updating: false,
        }
    }
}

/// 全局的应用初始化状态
pub static APP_INIT_STATE: OnceCell<Arc<RwLock<AppInitState>>> = OnceCell::const_new();

/// 初始化全局的应用初始化状态
pub async fn init_app_init_state() -> &'static Arc<RwLock<AppInitState>> {
    APP_INIT_STATE
        .get_or_init(|| async { Arc::new(RwLock::new(AppInitState::default())) })
        .await
}

/// 获取全局的应用初始化状态
fn get_app_init_state() -> &'static Arc<RwLock<AppInitState>> {
    match APP_INIT_STATE.get() {
        Some(app_init_state) => app_init_state,
        None => {
            log::error!(
                "APP_INIT_STATE is not initialized. Please call init_app_init_state() first."
            );
            std::process::exit(-1);
        }
    }
}

/// 读取 应用初始化状态
pub fn read_app_init_state() -> AppInitState {
    let app_init_state = get_app_init_state().read().unwrap();
    app_init_state.clone()
}

/// 更新应用初始化状态
pub fn update_app_init_state(app_init_next_state: AppInitState) -> Result<(), ()> {
    let mut app_init_state = get_app_init_state().write().unwrap();
    *app_init_state = app_init_next_state;

    Ok(())
}
