/**
 * 网络与同步设置
 * 仅用于持久化存储
 */

export interface NetworkSettings {
  /** 是否启用代理 */
  proxyEnabled: boolean;
  /** 代理地址 */
  proxyAddress: string;
  /** 代理端口 */
  proxyPort: string;
  /** 是否自动同步 */
  autoSync: boolean;
  /** 同步间隔（分钟） */
  syncInterval: number;
}

export const DEFAULT_NETWORK_SETTINGS: NetworkSettings = {
  proxyEnabled: false,
  proxyAddress: '',
  proxyPort: '',
  autoSync: true,
  syncInterval: 30,
};

export const SYNC_INTERVAL_OPTIONS = [5, 15, 30, 60] as const;
