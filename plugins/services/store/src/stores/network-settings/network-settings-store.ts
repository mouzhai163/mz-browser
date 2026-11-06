/**
 * 网络与同步设置持久化存储（通过 Tauri command 读写）
 */
import { getStoreKey, setStoreKey } from '../../store-commands';
import {
  DEFAULT_NETWORK_SETTINGS,
  SYNC_INTERVAL_OPTIONS,
  type NetworkSettings,
} from './network-settings.types';

const STORE_KEY = 'network';

function isValidSyncInterval(v: number): boolean {
  return Number.isInteger(v) && SYNC_INTERVAL_OPTIONS.includes(v as (typeof SYNC_INTERVAL_OPTIONS)[number]);
}

/**
 * 获取网络与同步设置
 */
export async function getNetworkSettings(): Promise<NetworkSettings> {
  const raw = await getStoreKey<Partial<NetworkSettings>>(STORE_KEY);
  if (!raw) {
    return { ...DEFAULT_NETWORK_SETTINGS };
  }

  return {
    proxyEnabled:
      typeof raw.proxyEnabled === 'boolean'
        ? raw.proxyEnabled
        : DEFAULT_NETWORK_SETTINGS.proxyEnabled,
    proxyAddress:
      typeof raw.proxyAddress === 'string' ? raw.proxyAddress : DEFAULT_NETWORK_SETTINGS.proxyAddress,
    proxyPort: typeof raw.proxyPort === 'string' ? raw.proxyPort : DEFAULT_NETWORK_SETTINGS.proxyPort,
    autoSync:
      typeof raw.autoSync === 'boolean' ? raw.autoSync : DEFAULT_NETWORK_SETTINGS.autoSync,
    syncInterval:
      typeof raw.syncInterval === 'number' && isValidSyncInterval(raw.syncInterval)
        ? raw.syncInterval
        : DEFAULT_NETWORK_SETTINGS.syncInterval,
  };
}

/**
 * 更新网络与同步设置（支持部分更新）
 */
export async function setNetworkSettings(patch: Partial<NetworkSettings>): Promise<void> {
  const current = await getNetworkSettings();
  const next: NetworkSettings = { ...current, ...patch };
  await setStoreKey(STORE_KEY, next);
}
