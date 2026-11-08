import { useLoadingStore } from '../stores/loading';

/**
 * 使用加载 Store Hook
 * 返回加载相关的状态和 actions
 */
export const useLoading = () => {
  return useLoadingStore();
};
