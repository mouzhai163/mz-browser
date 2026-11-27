//! 内核下载控制状态机
//!
//! 用安装目录名作为任务键。下载暂停时后端调用仍保持等待，恢复后继续原来的准备/启动流程。

use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, watch};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KernelDownloadControlState {
    Running,
    /// 代理配置已更新：尽快断开当前连接，但保留分片并用新配置重连。
    RestartRequested,
    PauseRequested,
    Paused,
    Cancelled,
}

/// 单个内核下载任务的控制句柄。watch channel  itself 已经提供状态修改的同步语义。
pub struct KernelDownloadControl {
    sender: watch::Sender<KernelDownloadControlState>,
}

impl KernelDownloadControl {
    pub fn new() -> Self {
        let (sender, _) = watch::channel(KernelDownloadControlState::Running);
        Self { sender }
    }

    pub fn subscribe(&self) -> watch::Receiver<KernelDownloadControlState> {
        self.sender.subscribe()
    }

    pub fn current(&self) -> KernelDownloadControlState {
        *self.sender.borrow()
    }

    pub fn pause(&self) {
        self.sender.send_modify(|state| {
            if matches!(
                *state,
                KernelDownloadControlState::Running | KernelDownloadControlState::RestartRequested
            ) {
                *state = KernelDownloadControlState::PauseRequested;
            }
        });
    }

    /// 请求下载尽快断开并用最新配置重连。只在运行中有意义；暂停中的下载恢复时本来就会重读配置。
    pub fn restart(&self) {
        self.sender.send_modify(|state| {
            if matches!(*state, KernelDownloadControlState::Running) {
                *state = KernelDownloadControlState::RestartRequested;
            }
        });
    }

    /// 外层下载循环已经观察到重连请求，恢复 Running 后继续下一轮循环。
    pub fn acknowledge_restart(&self) {
        self.sender.send_modify(|state| {
            if matches!(*state, KernelDownloadControlState::RestartRequested) {
                *state = KernelDownloadControlState::Running;
            }
        });
    }

    pub fn mark_paused(&self) {
        self.sender.send_modify(|state| {
            if matches!(*state, KernelDownloadControlState::PauseRequested) {
                *state = KernelDownloadControlState::Paused;
            }
        });
    }

    pub fn resume(&self) {
        self.sender.send_modify(|state| {
            if matches!(
                *state,
                KernelDownloadControlState::PauseRequested | KernelDownloadControlState::Paused
            ) {
                *state = KernelDownloadControlState::Running;
            }
        });
    }

    pub fn cancel(&self) {
        self.sender.send_replace(KernelDownloadControlState::Cancelled);
    }

    /// 等到需要中断当前网络活动的控制请求。用于重试退避等“下载仍在跑但没有在读流”的位置。
    pub async fn wait_for_interruption(&self) -> KernelDownloadControlState {
        let mut receiver = self.subscribe();
        loop {
            let state = *receiver.borrow();
            if matches!(
                state,
                KernelDownloadControlState::RestartRequested
                    | KernelDownloadControlState::PauseRequested
                    | KernelDownloadControlState::Cancelled
            ) {
                return state;
            }
            if receiver.changed().await.is_err() {
                return KernelDownloadControlState::Cancelled;
            }
        }
    }

    /// 下载已经标记为 Paused 后，等待恢复或取消。
    pub async fn wait_for_resume_or_cancel(&self) -> KernelDownloadControlState {
        let mut receiver = self.subscribe();
        loop {
            let state = *receiver.borrow();
            match state {
                KernelDownloadControlState::Running
                | KernelDownloadControlState::RestartRequested
                | KernelDownloadControlState::Cancelled => {
                    return state;
                }
                KernelDownloadControlState::PauseRequested | KernelDownloadControlState::Paused => {
                    if receiver.changed().await.is_err() {
                        return KernelDownloadControlState::Cancelled;
                    }
                }
            }
        }
    }
}

impl Default for KernelDownloadControl {
    fn default() -> Self {
        Self::new()
    }
}

static KERNEL_DOWNLOAD_CONTROLS: Lazy<Mutex<HashMap<String, Arc<KernelDownloadControl>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub async fn register_kernel_download_control(kernel_value: &str) -> Arc<KernelDownloadControl> {
    let mut controls = KERNEL_DOWNLOAD_CONTROLS.lock().await;
    controls
        .entry(kernel_value.to_string())
        .or_insert_with(|| Arc::new(KernelDownloadControl::new()))
        .clone()
}

pub async fn unregister_kernel_download_control(
    kernel_value: &str,
    control: &Arc<KernelDownloadControl>,
) {
    let mut controls = KERNEL_DOWNLOAD_CONTROLS.lock().await;
    if controls.get(kernel_value).is_some_and(|current| Arc::ptr_eq(current, control)) {
        controls.remove(kernel_value);
    }
}

async fn control_for(kernel_value: &str) -> Option<Arc<KernelDownloadControl>> {
    KERNEL_DOWNLOAD_CONTROLS.lock().await.get(kernel_value).cloned()
}

/// 是否还有已注册、尚未结束的下载控制句柄。暂停中的下载仍算未结束。
pub async fn has_kernel_download_control(kernel_value: &str) -> bool {
    control_for(kernel_value).await.is_some()
}

/// 让所有已注册、尚未结束的下载尽快使用最新代理配置重连。返回实际触发重连的运行中任务数。
pub async fn restart_all_kernel_downloads() -> usize {
    let controls: Vec<Arc<KernelDownloadControl>> = {
        let guard = KERNEL_DOWNLOAD_CONTROLS.lock().await;
        guard.values().cloned().collect()
    };
    let mut restarted = 0;
    for control in controls {
        let was_running = matches!(control.current(), KernelDownloadControlState::Running);
        control.restart();
        if was_running && matches!(control.current(), KernelDownloadControlState::RestartRequested) {
            restarted += 1;
        }
    }
    restarted
}

pub async fn pause_kernel_download(kernel_value: &str) -> Result<(), String> {
    let control = control_for(kernel_value)
        .await
        .ok_or_else(|| "没有找到正在进行的内核下载".to_string())?;
    control.pause();
    Ok(())
}

pub async fn resume_kernel_download(kernel_value: &str) -> Result<(), String> {
    let control = control_for(kernel_value)
        .await
        .ok_or_else(|| "没有找到可恢复的内核下载".to_string())?;
    control.resume();
    Ok(())
}

pub async fn cancel_kernel_download(kernel_value: &str) -> Result<(), String> {
    let control = control_for(kernel_value)
        .await
        .ok_or_else(|| "没有找到可取消的内核下载".to_string())?;
    control.cancel();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{KernelDownloadControl, KernelDownloadControlState};
    use std::sync::Arc;
    use std::time::Duration;

    #[tokio::test]
    async fn pause_resume_and_cancel_transitions() {
        let control = KernelDownloadControl::new();
        assert_eq!(control.current(), KernelDownloadControlState::Running);

        control.pause();
        assert_eq!(
            control.current(),
            KernelDownloadControlState::PauseRequested
        );
        control.mark_paused();
        assert_eq!(control.current(), KernelDownloadControlState::Paused);

        control.resume();
        assert_eq!(control.current(), KernelDownloadControlState::Running);

        control.pause();
        control.cancel();
        assert_eq!(control.current(), KernelDownloadControlState::Cancelled);
    }

    #[tokio::test]
    async fn pause_interrupts_retry_backoff_waiters() {
        let control = Arc::new(KernelDownloadControl::new());
        let waiting_control = control.clone();
        let waiter = tokio::spawn(async move { waiting_control.wait_for_interruption().await });

        tokio::time::sleep(Duration::from_millis(10)).await;
        control.pause();

        let state = tokio::time::timeout(Duration::from_millis(200), waiter)
            .await
            .expect("pause should wake the waiter")
            .expect("waiter should join");
        assert_eq!(state, KernelDownloadControlState::PauseRequested);
    }

    #[tokio::test]
    async fn resume_wakes_a_paused_download() {
        let control = Arc::new(KernelDownloadControl::new());
        control.pause();
        control.mark_paused();

        let waiting_control = control.clone();
        let waiter = tokio::spawn(async move { waiting_control.wait_for_resume_or_cancel().await });
        tokio::time::sleep(Duration::from_millis(10)).await;
        control.resume();

        let state = tokio::time::timeout(Duration::from_millis(200), waiter)
            .await
            .expect("resume should wake the waiter")
            .expect("waiter should join");
        assert_eq!(state, KernelDownloadControlState::Running);
    }

    #[tokio::test]
    async fn restart_interrupts_a_running_download_and_can_be_acknowledged() {
        let control = Arc::new(KernelDownloadControl::new());
        let waiting_control = control.clone();
        let waiter = tokio::spawn(async move { waiting_control.wait_for_interruption().await });

        tokio::time::sleep(Duration::from_millis(10)).await;
        control.restart();

        let state = tokio::time::timeout(Duration::from_millis(200), waiter)
            .await
            .expect("restart should wake the waiter")
            .expect("waiter should join");
        assert_eq!(state, KernelDownloadControlState::RestartRequested);

        control.acknowledge_restart();
        assert_eq!(control.current(), KernelDownloadControlState::Running);
    }
}
