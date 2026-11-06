import { create } from 'zustand';

/**
 * 加载状态接口
 */
interface LoadingState {
  /** 是否正在加载 */
  isLoading: boolean;
}

/**
 * 加载 Actions
 */
interface LoadingActions {
  /** 设置加载状态 */
  setLoading: (isLoading: boolean) => void;
}

/**
 * Loading Store
 * 专门管理应用加载状态
 */
export const useLoadingStore = create<LoadingState & LoadingActions>((set) => ({
  // 初始状态
  isLoading: false,

  // Actions
  setLoading: (isLoading: boolean) =>
    set({
      isLoading,
    }),
}));
