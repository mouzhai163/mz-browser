/**
 * Store 插件入口
 * 导出所有 store 和 Hooks
 */

/**
 * 导出各个独立的 Store
 */
export { useAuthStore, useLoadingStore, useRefreshStore, useSettingsDialogStore } from './stores';

/**
 * 导出组合 Hooks
 */
export {
  useAuth,
  useLoading,
  useAppState,
  useStoreActions,
  useStore,
} from './components/store-provider';

/**
 * 导出类型
 */
export type { User } from './types/store.types';
export type { AppState } from './components/store-provider';
export type { SettingsDialogTab, SettingsDialogStore } from './stores/settings-dialog';
export {
  getAccountSecuritySettings,
  setAccountSecuritySettings,
  DEFAULT_ACCOUNT_SECURITY_SETTINGS,
  LOCK_TIME_OPTIONS,
} from './stores/account-security-settings';
export type { AccountSecuritySettings } from './stores/account-security-settings';
export {
  getGeneralSettings,
  setGeneralSettings,
  DEFAULT_GENERAL_SETTINGS,
  THEME_OPTIONS,
  LOCALE_OPTIONS,
} from './stores/general-settings';
export type { GeneralSettings, ThemeMode, Locale } from './stores/general-settings';
export {
  getBrowserSettings,
  setBrowserSettings,
  DEFAULT_BROWSER_SETTINGS,
  RETRY_COUNT_OPTIONS,
  MAX_CONCURRENT_TASKS_OPTIONS,
} from './stores/browser-settings';
export type { BrowserSettings, FingerprintMode } from './stores/browser-settings';
export {
  getNetworkSettings,
  setNetworkSettings,
  DEFAULT_NETWORK_SETTINGS,
  SYNC_INTERVAL_OPTIONS,
} from './stores/network-settings';
export type { NetworkSettings } from './stores/network-settings';
export {
  getStorageSettings,
  setStorageSettings,
  DEFAULT_STORAGE_SETTINGS,
} from './stores/storage-settings';
export type { DirectorySizeCache, StorageSettings, StoragePathKey } from './stores/storage-settings';
export {
  getEnvironmentLocalProxyBindings,
  setEnvironmentLocalProxyBinding,
  removeEnvironmentLocalProxyBinding,
} from './stores/environment-local-proxy-binding';
export type {
  EnvironmentLocalProxyBinding,
  EnvironmentLocalProxyBindingMap,
} from './stores/environment-local-proxy-binding';
export { useMihomoRuntimeStore } from './stores/mihomo-runtime';

/**
 * App Store Provider 组件
 * 注意：zustand 不需要 Provider，但为了向后兼容保留此组件
 * 实际上它只是渲染 children，不做任何包装
 */
export { SettingsBootstrap } from './components/settings-bootstrap';
export { MihomoRuntimeSubscriber } from './components/mihomo-runtime/mihomo-runtime-subscriber';

export const AppStoreProvider = ({ children }: { children: React.ReactNode }) => {
  // zustand 不需要 Provider，直接返回 children
  return <>{children}</>;
};

/**
 * Store 插件
 * 注意：这是一个特殊的插件，它不遵循标准的插件格式
 * 因为它需要在应用启动时就被使用
 */
const storePlugin = {
  id: 'store',
  name: 'Store Service',
  version: '1.0.0',
  component: null,
  slots: [],
};

export default storePlugin;
