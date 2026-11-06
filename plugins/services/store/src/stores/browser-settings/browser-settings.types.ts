/**
 * 浏览器与自动化设置
 * 仅用于持久化存储
 */

export type FingerprintMode = 'random' | 'custom' | 'real';

export interface BrowserSettings {
  /** 新建环境默认指纹模式 */
  defaultFingerprintMode: FingerprintMode;
  /** 关闭时清理临时数据 */
  cleanTempOnClose: boolean;
  /** 自动恢复上次会话 */
  autoRestoreSession: boolean;
  /** RPA 任务超时时间（秒） */
  rpaTimeout: number;
  /** 失败重试次数 */
  retryCount: number;
  /** 最大并发任务数 */
  maxConcurrentTasks: number;
}

export const DEFAULT_BROWSER_SETTINGS: BrowserSettings = {
  defaultFingerprintMode: 'random',
  cleanTempOnClose: true,
  autoRestoreSession: false,
  rpaTimeout: 30,
  retryCount: 3,
  maxConcurrentTasks: 5,
};

export const FINGERPRINT_MODES: FingerprintMode[] = ['random', 'custom', 'real'];
export const RPA_TIMEOUT_MIN = 10;
export const RPA_TIMEOUT_MAX = 120;
export const RPA_TIMEOUT_STEP = 5;
export const RETRY_COUNT_OPTIONS = [0, 1, 2, 3, 5];
export const MAX_CONCURRENT_TASKS_OPTIONS = [1, 3, 5, 10, 20];
