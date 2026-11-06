/**
 * 存储与更新设置持久化存储（通过 Tauri command 读写）
 */
import { getStoreKey, setStoreKey } from '../../store-commands';
import {
  DEFAULT_STORAGE_SETTINGS,
  type DirectorySizeCache,
  type StorageSettings,
} from './storage-settings.types';

const STORE_KEY = 'storage';

function parseDirectorySizeCache(raw: unknown): DirectorySizeCache | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const candidate = raw as Partial<DirectorySizeCache>;
  const paths = Array.isArray(candidate.paths)
    ? candidate.paths.filter((value): value is string => typeof value === 'string')
    : undefined;
  const sizes = Array.isArray(candidate.sizes)
    ? candidate.sizes.filter((value): value is number => typeof value === 'number')
    : undefined;
  const updatedAt = typeof candidate.updatedAt === 'number' ? candidate.updatedAt : undefined;

  if (!paths || !sizes || updatedAt === undefined || paths.length !== sizes.length) {
    return undefined;
  }

  return { paths, sizes, updatedAt };
}

/**
 * 获取存储与更新设置
 */
export async function getStorageSettings(): Promise<StorageSettings> {
  const raw = await getStoreKey<Partial<StorageSettings>>(STORE_KEY);
  if (!raw) {
    return { ...DEFAULT_STORAGE_SETTINGS };
  }

  return {
    betaChannel:
      typeof raw.betaChannel === 'boolean'
        ? raw.betaChannel
        : DEFAULT_STORAGE_SETTINGS.betaChannel,
    profilesPath: typeof raw.profilesPath === 'string' ? raw.profilesPath : undefined,
    cachePath: typeof raw.cachePath === 'string' ? raw.cachePath : undefined,
    logsPath: typeof raw.logsPath === 'string' ? raw.logsPath : undefined,
    downloadsPath: typeof raw.downloadsPath === 'string' ? raw.downloadsPath : undefined,
    directorySizeCache: parseDirectorySizeCache(raw.directorySizeCache),
  };
}

/**
 * 更新存储与更新设置（支持部分更新）
 */
export async function setStorageSettings(patch: Partial<StorageSettings>): Promise<void> {
  const current = await getStorageSettings();
  const next: StorageSettings = { ...current, ...patch };
  await setStoreKey(STORE_KEY, next);
}
