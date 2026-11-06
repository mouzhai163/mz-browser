use std::{
    net::SocketAddr,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};

use anyhow::{Context, Result};
use tokio::{net::TcpListener, sync::oneshot, task::JoinHandle};

use crate::local_api::{
    router::build::build_router, server::state::LocalApiServerState, types::LocalApiRuntimeConfig,
};

pub struct LocalApiServerHandle {
    shutdown_tx: Option<oneshot::Sender<()>>,
    join_handle: JoinHandle<()>,
}

impl LocalApiServerHandle {
    pub async fn shutdown(mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        let _ = self.join_handle.await;
    }
}

pub fn spawn_local_api_server(
    config: LocalApiRuntimeConfig,
    running: Arc<AtomicBool>,
) -> Result<LocalApiServerHandle> {
    let addr = if config.remote_access {
        SocketAddr::from(([0, 0, 0, 0], config.port as u16))
    } else {
        SocketAddr::from(([127, 0, 0, 1], config.port as u16))
    };

    let state = LocalApiServerState {
        config: Arc::new(config),
    };
    let app = build_router(state);
    let (shutdown_tx, shutdown_rx) = oneshot::channel();

    let join_handle = tokio::spawn(async move {
        let listener = match TcpListener::bind(addr)
            .await
            .with_context(|| format!("failed to bind local api server on {}", addr))
        {
            Ok(listener) => listener,
            Err(error) => {
                running.store(false, Ordering::SeqCst);
                log::error!("{}", error);
                return;
            }
        };

        log::info!("local api server listening on {}", addr);

        let server = axum::serve(listener, app).with_graceful_shutdown(async move {
            let _ = shutdown_rx.await;
        });

        if let Err(error) = server.await {
            log::error!("local api server stopped with error: {}", error);
        }

        running.store(false, Ordering::SeqCst);
    });

    Ok(LocalApiServerHandle {
        shutdown_tx: Some(shutdown_tx),
        join_handle,
    })
}
