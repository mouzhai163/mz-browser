import { useAuthStore } from '../stores/auth';
import { useLoadingStore } from '../stores/loading';
import type { User } from '../types/store.types';

/**
 * 应用状态类型（组合各个 store 的状态）
 */
export type AppState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

/**
 * 使用认证 Store Hook
 * 返回认证相关的状态和 actions
 */
export const useAuth = () => {
  return useAuthStore();
};

/**
 * 使用加载 Store Hook
 * 返回加载相关的状态和 actions
 */
export const useLoading = () => {
  return useLoadingStore();
};

/**
 * 使用 App State Hook
 * 组合多个 store 的状态，返回完整的应用状态
 * 注意：这个 Hook 会订阅所有相关的 store，只在需要完整状态时使用
 */
export const useAppState = (): AppState => {
  const { user, isAuthenticated } = useAuthStore();
  const { isLoading } = useLoadingStore();

  return {
    user,
    isAuthenticated,
    isLoading,
  };
};

/**
 * 使用 Store Actions Hook
 * 组合多个 store 的 actions
 */
export const useStoreActions = () => {
  const { setUser, clearUser } = useAuthStore();
  const { setLoading } = useLoadingStore();

  return {
    setUser,
    clearUser,
    setLoading,
  };
};

/**
 * 使用 Store Hook（向后兼容）
 * 返回所有 store 的状态和 actions
 */
export const useStore = () => {
  const auth = useAuthStore();
  const loading = useLoadingStore();

  return {
    ...auth,
    ...loading,
  };
};
