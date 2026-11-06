import { create } from 'zustand';

/**
 * 数据刷新状态
 * 使用时间戳作为刷新触发器
 */
interface RefreshState {
  /** 团队数据刷新时间戳 */
  teams: number;
  /** 消息数据刷新时间戳 */
  messages: number;
  /** 工作空间数据刷新时间戳 */
  workspaces: number;
}

interface RefreshActions {
  /** 触发团队数据刷新 */
  refreshTeams: () => void;
  /** 触发消息数据刷新 */
  refreshMessages: () => void;
  /** 触发工作空间数据刷新 */
  refreshWorkspaces: () => void;
  /** 刷新所有数据 */
  refreshAll: () => void;
}

// 防抖时间间隔（毫秒）
const DEBOUNCE_INTERVAL = 500;

/**
 * 数据刷新 Store
 * 用于协调多个组件间的数据刷新
 *
 * 使用场景：
 * - 接受团队邀请后，触发 refreshTeams() 让 user-menu 和 team-header 重新加载团队列表
 * - 新消息到达时，触发 refreshMessages() 让消息相关组件更新
 */
export const useRefreshStore = create<RefreshState & RefreshActions>((set, get) => ({
  // 初始状态
  teams: 0,
  messages: 0,
  workspaces: 0,

  // Actions（带防抖）
  refreshTeams: () => {
    const now = Date.now();
    const lastRefresh = get().teams;
    // 防抖：如果距离上次刷新时间小于间隔，则忽略
    if (now - lastRefresh < DEBOUNCE_INTERVAL) {
      return;
    }
    set({ teams: now });
  },

  refreshMessages: () => {
    const now = Date.now();
    const lastRefresh = get().messages;
    if (now - lastRefresh < DEBOUNCE_INTERVAL) {
      return;
    }
    set({ messages: now });
  },

  refreshWorkspaces: () => {
    const now = Date.now();
    const lastRefresh = get().workspaces;
    if (now - lastRefresh < DEBOUNCE_INTERVAL) {
      return;
    }
    set({ workspaces: now });
  },

  refreshAll: () => {
    const now = Date.now();
    const state = get();
    const updates: Partial<RefreshState> = {};

    if (now - state.teams >= DEBOUNCE_INTERVAL) {
      updates.teams = now;
    }
    if (now - state.messages >= DEBOUNCE_INTERVAL) {
      updates.messages = now;
    }
    if (now - state.workspaces >= DEBOUNCE_INTERVAL) {
      updates.workspaces = now;
    }

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },
}));
