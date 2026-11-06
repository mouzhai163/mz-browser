import { create } from 'zustand';
import type {
  WorkspaceItem,
  WorkspaceListResponse,
} from '../../../../../layouts/app-layout/src/api/workspaces.types';

/**
 * 工作空间状态
 */
export interface WorkspaceState {
  /** 工作空间列表 */
  workspaces: WorkspaceItem[];
  /** 当前工作空间 UUID */
  currentWorkspaceUuid: string | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 管理 Drawer 是否打开 */
  isDrawerOpen: boolean;
}

/**
 * 工作空间 Actions
 */
export interface WorkspaceActions {
  /** 设置工作空间列表 */
  setWorkspaces: (workspaces: WorkspaceItem[]) => void;
  /** 设置当前工作空间 */
  setCurrentWorkspace: (workspaceUuid: string | null) => void;
  /** 更新工作空间列表（从 API 响应） */
  updateFromResponse: (response: WorkspaceListResponse) => void;
  /** 设置加载状态 */
  setLoading: (isLoading: boolean) => void;
  /** 打开管理 Drawer */
  openDrawer: () => void;
  /** 关闭管理 Drawer */
  closeDrawer: () => void;
  /** 切换 Drawer 状态 */
  toggleDrawer: () => void;
}

/**
 * 工作空间 Store
 */
export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>((set) => ({
  // 初始状态
  workspaces: [],
  currentWorkspaceUuid: null,
  isLoading: false,
  isDrawerOpen: false,

  // Actions
  setWorkspaces: (workspaces) => set({ workspaces }),

  setCurrentWorkspace: (workspaceUuid) =>
    set((state) => ({
      currentWorkspaceUuid: workspaceUuid,
      workspaces: state.workspaces.map((ws) => ({
        ...ws,
        is_current: ws.uuid === workspaceUuid,
      })),
    })),

  updateFromResponse: (response) =>
    set({
      workspaces: response.workspaces || [],
      currentWorkspaceUuid: response.current_workspace_uuid || null,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  openDrawer: () => set({ isDrawerOpen: true }),

  closeDrawer: () => set({ isDrawerOpen: false }),

  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
}));
