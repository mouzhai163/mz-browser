/**
 * 浏览器与自动化设置持久化存储（通过 Tauri command 读写）
 */
import { getStoreKey, setStoreKey } from '../../store-commands';
import {
  DEFAULT_BROWSER_SETTINGS,
  FINGERPRINT_MODES,
  MAX_CONCURRENT_TASKS_OPTIONS,
  RETRY_COUNT_OPTIONS,
  RPA_TIMEOUT_MAX,
  RPA_TIMEOUT_MIN,
  type BrowserSettings,
  type FingerprintMode,
} from './browser-settings.types';

const STORE_KEY = 'browser';

function isValidFingerprintMode(v: unknown): v is FingerprintMode {
  return typeof v === 'string' && FINGERPRINT_MODES.includes(v as FingerprintMode);
}

function clampRpaTimeout(v: number): number {
  return Math.max(RPA_TIMEOUT_MIN, Math.min(RPA_TIMEOUT_MAX, Math.round(v / 5) * 5));
}

function isValidRetryCount(v: number): boolean {
  return Number.isInteger(v) && RETRY_COUNT_OPTIONS.includes(v);
}

function isValidMaxConcurrentTasks(v: number): boolean {
  return Number.isInteger(v) && MAX_CONCURRENT_TASKS_OPTIONS.includes(v);
}

/**
 * 获取浏览器与自动化设置
 */
export async function getBrowserSettings(): Promise<BrowserSettings> {
  const raw = await getStoreKey<Partial<BrowserSettings>>(STORE_KEY);
  if (!raw) {
    return { ...DEFAULT_BROWSER_SETTINGS };
  }

  const rpaTimeout =
    typeof raw.rpaTimeout === 'number'
      ? clampRpaTimeout(raw.rpaTimeout)
      : DEFAULT_BROWSER_SETTINGS.rpaTimeout;

  const retryCount =
    typeof raw.retryCount === 'number' && isValidRetryCount(raw.retryCount)
      ? raw.retryCount
      : DEFAULT_BROWSER_SETTINGS.retryCount;

  const maxConcurrentTasks =
    typeof raw.maxConcurrentTasks === 'number' && isValidMaxConcurrentTasks(raw.maxConcurrentTasks)
      ? raw.maxConcurrentTasks
      : DEFAULT_BROWSER_SETTINGS.maxConcurrentTasks;

  return {
    defaultFingerprintMode: isValidFingerprintMode(raw.defaultFingerprintMode)
      ? raw.defaultFingerprintMode
      : DEFAULT_BROWSER_SETTINGS.defaultFingerprintMode,
    cleanTempOnClose:
      typeof raw.cleanTempOnClose === 'boolean'
        ? raw.cleanTempOnClose
        : DEFAULT_BROWSER_SETTINGS.cleanTempOnClose,
    autoRestoreSession:
      typeof raw.autoRestoreSession === 'boolean'
        ? raw.autoRestoreSession
        : DEFAULT_BROWSER_SETTINGS.autoRestoreSession,
    rpaTimeout,
    retryCount,
    maxConcurrentTasks,
  };
}

/**
 * 更新浏览器与自动化设置（支持部分更新）
 */
export async function setBrowserSettings(patch: Partial<BrowserSettings>): Promise<void> {
  const current = await getBrowserSettings();
  const next: BrowserSettings = {
    ...current,
    ...patch,
  };
  if (patch.rpaTimeout !== undefined) {
    next.rpaTimeout = clampRpaTimeout(patch.rpaTimeout);
  }
  await setStoreKey(STORE_KEY, next);
}
