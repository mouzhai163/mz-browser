mod bidi;
pub mod cdp;
mod gecko;
mod gecko_relay;
pub mod job;
pub mod launcher;
mod socks_forward;
pub mod types;

use super::status_manager::EnvironmentStatusManager;
use crate::app::{EventPublisher, Result};
use cdp::CdpEndpointManager;
use job::JobManager;
use launcher::{
    batch_launch_environments, batch_stop_environments, close_rpa_tab, get_cdp_endpoint,
    get_connected_environments, launch_browser, list_rpa_tabs, refresh_proxy, select_rpa_tab,
    set_window_bounds, stop_environment,
};
use std::sync::Arc;
use types::{EnvironmentCommandRequest, EnvironmentCommandResponse};

pub struct KernelRuntime {
    cdp_endpoint_manager: Arc<CdpEndpointManager>,
    job_manager: Arc<JobManager>,
    status_manager: Arc<EnvironmentStatusManager>,
}

impl KernelRuntime {
    pub fn new(status_manager: Arc<EnvironmentStatusManager>) -> Self {
        Self {
            cdp_endpoint_manager: Arc::new(CdpEndpointManager::new()),
            job_manager: Arc::new(JobManager::new()),
            status_manager,
        }
    }

    pub async fn execute(
        &self,
        command: EnvironmentCommandRequest,
        events: EventPublisher,
    ) -> Result<EnvironmentCommandResponse> {
        match command {
            EnvironmentCommandRequest::StartEnvironment { request } => {
                let endpoint = launch_browser(
                    request,
                    self.cdp_endpoint_manager.clone(),
                    self.job_manager.clone(),
                    self.status_manager.clone(),
                    events,
                )
                .await?;
                Ok(EnvironmentCommandResponse::Started { endpoint })
            }
            EnvironmentCommandRequest::BatchStartEnvironments { requests } => {
                let results = batch_launch_environments(
                    requests,
                    self.cdp_endpoint_manager.clone(),
                    self.job_manager.clone(),
                    self.status_manager.clone(),
                    events,
                )
                .await?;
                Ok(EnvironmentCommandResponse::BatchLaunchResults { results })
            }
            EnvironmentCommandRequest::StopEnvironment { env_uuid } => {
                stop_environment(
                    env_uuid,
                    self.cdp_endpoint_manager.clone(),
                    self.job_manager.clone(),
                    self.status_manager.clone(),
                    events,
                )
                .await?;
                Ok(EnvironmentCommandResponse::Ack)
            }
            EnvironmentCommandRequest::BatchStopEnvironments { env_uuids } => {
                let results = batch_stop_environments(
                    env_uuids,
                    self.cdp_endpoint_manager.clone(),
                    self.job_manager.clone(),
                    self.status_manager.clone(),
                    events,
                )
                .await?;
                Ok(EnvironmentCommandResponse::BatchLaunchResults { results })
            }
            EnvironmentCommandRequest::RefreshProxy { env_uuid, proxy } => {
                refresh_proxy(env_uuid, proxy, events).await?;
                Ok(EnvironmentCommandResponse::Ack)
            }
            EnvironmentCommandRequest::SetWindowBounds { request } => {
                set_window_bounds(request, events).await?;
                Ok(EnvironmentCommandResponse::Ack)
            }
            EnvironmentCommandRequest::GetConnectedEnvironments => {
                let env_ids = get_connected_environments().await?;
                Ok(EnvironmentCommandResponse::ConnectedEnvironments { env_ids })
            }
            EnvironmentCommandRequest::GetCdpEndpoint { env_uuid } => {
                let endpoint =
                    get_cdp_endpoint(env_uuid, self.cdp_endpoint_manager.clone()).await?;
                Ok(EnvironmentCommandResponse::CdpEndpoint { endpoint })
            }
            EnvironmentCommandRequest::ListRpaTabs { env_uuid } => {
                let snapshot = list_rpa_tabs(env_uuid).await?;
                Ok(EnvironmentCommandResponse::RpaTabsSnapshot { snapshot })
            }
            EnvironmentCommandRequest::SelectRpaTab { env_uuid, position } => {
                let selection = select_rpa_tab(env_uuid, position).await?;
                Ok(EnvironmentCommandResponse::RpaTabSelected { selection })
            }
            EnvironmentCommandRequest::CloseRpaTab { env_uuid, position } => {
                let result = close_rpa_tab(env_uuid, position).await?;
                Ok(EnvironmentCommandResponse::RpaTabClosed { result })
            }
            EnvironmentCommandRequest::GetEnvironmentStatus { env_uuid } => {
                let status = self.status_manager.get_status(&env_uuid).await;
                Ok(EnvironmentCommandResponse::Status { status })
            }
            EnvironmentCommandRequest::GetAllEnvironmentStatuses => {
                let statuses = self.status_manager.get_all_statuses().await;
                Ok(EnvironmentCommandResponse::AllStatuses { statuses })
            }
        }
    }

    pub async fn handle_browser_disconnect(&self, env_uuid: &str, events: EventPublisher) {
        #[cfg(target_os = "windows")]
        {
            if let Some(manager) = crate::infrastructure::eventbus::get_eventbus_manager() {
                if manager.is_connected(env_uuid).await { return; }
            }
            let previous = self.status_manager.begin_disconnect(env_uuid).await;
            // 连接状态处理器和本处理器是同时触发的，它常常先一步把状态改成 Stopped，
            // 这时 begin_disconnect 返回 None。浏览器确实已经断开，job 和 CDP 端点仍然必须清理，
            // 否则之后会把"环境在运行"当真，去连一个已经不存在的调试端口。
            // 只有同一环境已经重新开始启动时才跳过：那时的端点属于新进程。
            if previous.is_none() && !disconnect_cleanup_allowed(self.status_manager.get_status(env_uuid).await) {
                return;
            }
            if let Err(error) = self.job_manager.finish_process(env_uuid).await {
                self.status_manager.set_status(env_uuid, super::EnvironmentStatus::Error).await;
                let _ = events.emit("environment.shutdown_failed", &serde_json::json!({"env_uuid": env_uuid, "error": error.to_string()}));
                return;
            }
            if matches!(previous, Some(super::EnvironmentStatus::Error)) {
                self.status_manager.set_status(env_uuid, super::EnvironmentStatus::Error).await;
            }
        }
        #[cfg(not(target_os = "windows"))]
        self.job_manager.remove(env_uuid).await;
        self.cdp_endpoint_manager.remove(env_uuid).await;
        self.status_manager.set_stopped_unless_error(env_uuid).await;
        let _ = events.emit(
            "environment.browser_disconnected",
            &serde_json::json!({ "env_uuid": env_uuid }),
        );
    }

    pub async fn clear_all(&self) {
        self.job_manager.clear_all().await;
        self.cdp_endpoint_manager.clear_all().await;
        self.status_manager.clear().await;
    }

    pub async fn get_connected_env_count(&self) -> usize {
        match crate::infrastructure::eventbus::get_eventbus_manager() {
            Some(manager) => manager.connected_env_count().await,
            None => 0,
        }
    }

    pub fn status_manager(&self) -> Arc<EnvironmentStatusManager> {
        self.status_manager.clone()
    }
}

/// 浏览器断开时状态已经不是 Running/Error：只有"已停止"或没有记录才继续清理；
/// 正在重新启动（Starting 等）时不能动，那时的 job 和端点属于新进程。
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn disconnect_cleanup_allowed(current: Option<super::EnvironmentStatus>) -> bool {
    matches!(current, None | Some(super::EnvironmentStatus::Stopped))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::event_channel;
    use crate::services::environment::EnvironmentStatus;

    #[tokio::test]
    async fn status_queries_return_runtime_environment_statuses() {
        let status_manager = Arc::new(EnvironmentStatusManager::new());
        status_manager.set_status("env-1", EnvironmentStatus::Running).await;
        status_manager.set_status("env-2", EnvironmentStatus::Stopped).await;

        let runtime = KernelRuntime::new(status_manager);
        let (events, _rx) = event_channel();

        let response = runtime
            .execute(
                EnvironmentCommandRequest::GetEnvironmentStatus {
                    env_uuid: "env-1".into(),
                },
                events.clone(),
            )
            .await
            .unwrap();
        match response {
            EnvironmentCommandResponse::Status { status } => {
                assert_eq!(status, Some(EnvironmentStatus::Running));
            }
            other => panic!("unexpected response: {:?}", other),
        }

        let response = runtime
            .execute(EnvironmentCommandRequest::GetAllEnvironmentStatuses, events)
            .await
            .unwrap();
        match response {
            EnvironmentCommandResponse::AllStatuses { statuses } => {
                assert_eq!(statuses.get("env-1"), Some(&EnvironmentStatus::Running));
                assert_eq!(statuses.get("env-2"), Some(&EnvironmentStatus::Stopped));
            }
            other => panic!("unexpected response: {:?}", other),
        }
    }

    #[tokio::test]
    async fn browser_disconnect_marks_environment_stopped() {
        let status_manager = Arc::new(EnvironmentStatusManager::new());
        status_manager.set_status("env-1", EnvironmentStatus::Running).await;

        let runtime = KernelRuntime::new(status_manager.clone());
        let (events, _rx) = event_channel();

        runtime.handle_browser_disconnect("env-1", events).await;

        assert_eq!(
            status_manager.get_status("env-1").await,
            Some(EnvironmentStatus::Stopped)
        );
    }

    #[tokio::test]
    async fn browser_disconnect_preserves_launch_error() {
        let status_manager = Arc::new(EnvironmentStatusManager::new());
        status_manager.set_status("env-1", EnvironmentStatus::Error).await;

        let runtime = KernelRuntime::new(status_manager.clone());
        let (events, _rx) = event_channel();

        runtime.handle_browser_disconnect("env-1", events).await;

        assert_eq!(
            status_manager.get_status("env-1").await,
            Some(EnvironmentStatus::Error)
        );
    }

    /// 回归：连接状态处理器先把状态改成 Stopped 时，CDP 端点也必须被清掉。
    /// 之前这里直接返回，端点残留，"在运行就开新标签页"会去连一个已经关闭的浏览器。
    #[tokio::test]
    async fn disconnect_after_status_already_stopped_still_removes_the_cdp_endpoint() {
        let status_manager = Arc::new(EnvironmentStatusManager::new());
        let runtime = KernelRuntime::new(status_manager.clone());
        runtime.cdp_endpoint_manager.allocate_port("env-1").await.unwrap();
        status_manager.set_status("env-1", EnvironmentStatus::Stopped).await;
        let (events, _rx) = event_channel();

        runtime.handle_browser_disconnect("env-1", events).await;

        assert_eq!(runtime.cdp_endpoint_manager.get_port("env-1").await, None);
        assert_eq!(status_manager.get_status("env-1").await, Some(EnvironmentStatus::Stopped));
    }

    /// 同一环境已经重新开始启动：旧浏览器的断开通知不能删掉新进程的端点。
    #[tokio::test]
    async fn disconnect_during_a_relaunch_keeps_the_new_endpoint() {
        let status_manager = Arc::new(EnvironmentStatusManager::new());
        let runtime = KernelRuntime::new(status_manager.clone());
        let port = runtime.cdp_endpoint_manager.allocate_port("env-1").await.unwrap();
        status_manager.set_status("env-1", EnvironmentStatus::Starting).await;
        let (events, _rx) = event_channel();

        runtime.handle_browser_disconnect("env-1", events).await;

        assert_eq!(runtime.cdp_endpoint_manager.get_port("env-1").await, Some(port));
        assert_eq!(status_manager.get_status("env-1").await, Some(EnvironmentStatus::Starting));
    }

    #[test]
    fn cleanup_runs_only_when_nothing_newer_is_in_progress() {
        assert!(disconnect_cleanup_allowed(None));
        assert!(disconnect_cleanup_allowed(Some(EnvironmentStatus::Stopped)));
        for busy in [
            EnvironmentStatus::Verifying,
            EnvironmentStatus::Downloading,
            EnvironmentStatus::Extracting,
            EnvironmentStatus::Ready,
            EnvironmentStatus::Initializing,
            EnvironmentStatus::Starting,
            EnvironmentStatus::Stopping,
        ] {
            assert!(!disconnect_cleanup_allowed(Some(busy.clone())), "{busy:?}");
        }
    }
}
