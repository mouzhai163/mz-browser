//! 环境窗口位置管理器
//!
//! 维护所有环境的窗口位置，避免窗口重叠

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// 默认窗口起始位置（左上角偏移）
const DEFAULT_WINDOW_OFFSET_X: i32 = 100;
const DEFAULT_WINDOW_OFFSET_Y: i32 = 100;

/// 窗口层叠偏移量
const WINDOW_CASCADE_OFFSET: i32 = 40;

/// 环境窗口位置管理器
pub struct EnvironmentPositionManager {
    /// 环境位置映射 (env_uuid -> position_index)
    positions: Arc<RwLock<HashMap<String, usize>>>,
    /// 下一个可用的位置索引
    next_index: Arc<RwLock<usize>>,
}

impl EnvironmentPositionManager {
    /// 创建新的位置管理器
    pub fn new() -> Self {
        Self {
            positions: Arc::new(RwLock::new(HashMap::new())),
            next_index: Arc::new(RwLock::new(0)),
        }
    }

    /// 为环境分配窗口位置，返回 (x, y) 坐标
    pub async fn allocate_position(&self, env_uuid: &str) -> (i32, i32) {
        let mut positions = self.positions.write().await;
        let mut next_index = self.next_index.write().await;

        // 如果已经分配过位置，返回现有位置
        if let Some(&index) = positions.get(env_uuid) {
            return Self::calculate_position(index);
        }

        // 分配新位置
        let index = *next_index;
        positions.insert(env_uuid.to_string(), index);
        *next_index += 1;

        Self::calculate_position(index)
    }

    /// 释放环境的窗口位置
    pub async fn release_position(&self, env_uuid: &str) {
        let mut positions = self.positions.write().await;
        positions.remove(env_uuid);

        // 如果所有环境都已关闭，重置索引
        if positions.is_empty() {
            let mut next_index = self.next_index.write().await;
            *next_index = 0;
        }
    }

    /// 获取环境的当前位置
    pub async fn get_position(&self, env_uuid: &str) -> Option<(i32, i32)> {
        let positions = self.positions.read().await;
        positions.get(env_uuid).map(|&index| Self::calculate_position(index))
    }

    /// 获取所有已分配的位置
    pub async fn get_all_positions(&self) -> HashMap<String, (i32, i32)> {
        let positions = self.positions.read().await;
        positions
            .iter()
            .map(|(uuid, &index)| (uuid.clone(), Self::calculate_position(index)))
            .collect()
    }

    /// 清空所有位置
    pub async fn clear(&self) {
        let mut positions = self.positions.write().await;
        let mut next_index = self.next_index.write().await;
        positions.clear();
        *next_index = 0;
    }

    /// 根据索引计算窗口位置
    fn calculate_position(index: usize) -> (i32, i32) {
        let offset = (index as i32) * WINDOW_CASCADE_OFFSET;
        (
            DEFAULT_WINDOW_OFFSET_X + offset,
            DEFAULT_WINDOW_OFFSET_Y + offset,
        )
    }
}

impl Default for EnvironmentPositionManager {
    fn default() -> Self {
        Self::new()
    }
}
