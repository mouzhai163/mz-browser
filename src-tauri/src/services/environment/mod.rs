pub mod kernel;
pub mod launch_runtime;
pub mod position_manager;
pub mod status_manager;

use crate::core::error::Result;
use serde::{Deserialize, Serialize};

pub use kernel::{
    AccountInfo, BatchLaunchRequest, BatchLaunchResult, CdpEndpointResponse, CookieGroup,
    ExtensionInfo, KernelPrepareStatusPayload, KernelService, KernelStatusEmitter, ProxyConfig,
    RpaTabCloseResult, RpaTabInfo, RpaTabSelection, RpaTabsSnapshot,
};
pub use launch_runtime::EnvironmentLaunchRuntimeService;
pub use position_manager::EnvironmentPositionManager;
pub use status_manager::EnvironmentStatusManager;

/// 运行中的环境信息
#[derive(Debug, Clone, Serialize)]
pub struct RunningEnvironment {
    pub uuid: String,
    pub name: String,
    pub status: String,
}

/// 开启同步时的参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSyncParams {
    pub master_env_id: String,
    pub slave_env_ids: Vec<String>,
}

pub struct EnvironmentService;

impl EnvironmentService {
    /// 获取运行中的环境列表
    pub async fn get_running_environments() -> Vec<RunningEnvironment> {
        use crate::app::context::AppContext;
        use crate::infrastructure::runtime::{SyncCommandRequest, SyncCommandResponse};

        let Some(ctx) = AppContext::try_get() else {
            return vec![];
        };

        match ctx
            .simprint_runtime_manager
            .send_sync_command(SyncCommandRequest::GetRunningEnvironments)
            .await
        {
            Ok(SyncCommandResponse::RunningEnvironments { environments }) => environments
                .into_iter()
                .map(|environment| RunningEnvironment {
                    uuid: environment.uuid,
                    name: environment.name,
                    status: environment.status,
                })
                .collect(),
            Ok(SyncCommandResponse::Ack) => vec![],
            Err(error) => {
                log::warn!(
                    "failed to query running environments from simprint-runtime: {}",
                    error
                );
                vec![]
            }
        }
    }

    /// 开启同步
    pub async fn start_sync(params: StartSyncParams) -> Result<()> {
        use crate::app::context::AppContext;
        use crate::infrastructure::runtime::{SyncCommandRequest, SyncCommandResponse};

        let ctx = AppContext::get();
        let response = ctx
            .simprint_runtime_manager
            .send_sync_command(SyncCommandRequest::StartSync {
                master_env_id: params.master_env_id,
                slave_env_ids: params.slave_env_ids,
            })
            .await?;

        match response {
            SyncCommandResponse::Ack => Ok(()),
            other => Err(format!("simprint-runtime 返回了非预期响应: {:?}", other).into()),
        }
    }

    /// 关闭同步
    pub async fn stop_sync() -> Result<()> {
        use crate::app::context::AppContext;
        use crate::infrastructure::runtime::{SyncCommandRequest, SyncCommandResponse};

        let ctx = AppContext::get();
        let response = ctx
            .simprint_runtime_manager
            .send_sync_command(SyncCommandRequest::StopSync)
            .await?;

        match response {
            SyncCommandResponse::Ack => Ok(()),
            other => Err(format!("simprint-runtime 返回了非预期响应: {:?}", other).into()),
        }
    }
}
