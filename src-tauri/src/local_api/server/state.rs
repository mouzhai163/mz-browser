use std::sync::Arc;

use crate::local_api::types::LocalApiRuntimeConfig;

#[derive(Clone)]
pub struct LocalApiServerState {
    pub config: Arc<LocalApiRuntimeConfig>,
}
