pub mod client;
pub mod context;
pub mod entitys;
pub mod handlers;
pub mod manager;
pub mod middleware;
pub mod router;
pub mod routes;
pub mod server;
pub mod services;
pub mod types;

use crate::app::context::AppContext;

pub use manager::runtime::LocalApiManager;

pub fn stop_runtime() {
    if let Some(ctx) = AppContext::try_get() {
        let manager = ctx.local_api_manager.clone();

        tokio::spawn(async move {
            manager.stop().await;
        });
    }
}
