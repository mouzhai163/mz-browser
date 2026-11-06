/**
 * 存储与更新设置
 * 仅用于持久化存储
 */

export interface StorageSettings {
  /** Beta 测试通道 */
  betaChannel: boolean;
  /** 自定义存储路径（为空则使用后端默认） */
  profilesPath?: string;
  cachePath?: string;
  logsPath?: string;
  downloadsPath?: string;
  /** 目录大小的弱缓存，用于优先展示上次统计结果 */
  directorySizeCache?: DirectorySizeCache;
}

export interface DirectorySizeCache {
  paths: string[];
  sizes: number[];
  updatedAt: number;
}

export const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
  betaChannel: true,
};

export const STORAGE_PATH_KEYS = ['profilesPath', 'cachePath', 'logsPath', 'downloadsPath'] as const;
export type StoragePathKey = (typeof STORAGE_PATH_KEYS)[number];
