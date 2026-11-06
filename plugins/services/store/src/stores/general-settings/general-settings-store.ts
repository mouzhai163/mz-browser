/**
 * 通用设置持久化存储（通过 Tauri command 读写）
 */
import { getStoreKey, setStoreKey } from '../../store-commands';
import {
  DEFAULT_GENERAL_SETTINGS,
  LOCALE_OPTIONS,
  THEME_OPTIONS,
  type GeneralSettings,
} from './general-settings.types';

const STORE_KEY = 'general';

function isValidTheme(v: unknown): v is GeneralSettings['theme'] {
  return typeof v === 'string' && THEME_OPTIONS.includes(v as GeneralSettings['theme']);
}

function isValidLocale(v: unknown): v is GeneralSettings['language'] {
  return typeof v === 'string' && LOCALE_OPTIONS.includes(v as GeneralSettings['language']);
}

/**
 * 获取通用设置
 */
export async function getGeneralSettings(): Promise<GeneralSettings> {
  const raw = await getStoreKey<Partial<GeneralSettings>>(STORE_KEY);
  if (!raw) {
    return { ...DEFAULT_GENERAL_SETTINGS };
  }

  return {
    theme: isValidTheme(raw.theme) ? raw.theme : DEFAULT_GENERAL_SETTINGS.theme,
    language: isValidLocale(raw.language) ? raw.language : DEFAULT_GENERAL_SETTINGS.language,
    defaultCollapseSidebar:
      typeof raw.defaultCollapseSidebar === 'boolean'
        ? raw.defaultCollapseSidebar
        : DEFAULT_GENERAL_SETTINGS.defaultCollapseSidebar,
    autoStart:
      typeof raw.autoStart === 'boolean' ? raw.autoStart : DEFAULT_GENERAL_SETTINGS.autoStart,
    startMinimized:
      typeof raw.startMinimized === 'boolean'
        ? raw.startMinimized
        : DEFAULT_GENERAL_SETTINGS.startMinimized,
    rememberWindowPosition:
      typeof raw.rememberWindowPosition === 'boolean'
        ? raw.rememberWindowPosition
        : DEFAULT_GENERAL_SETTINGS.rememberWindowPosition,
    desktopNotification:
      typeof raw.desktopNotification === 'boolean'
        ? raw.desktopNotification
        : DEFAULT_GENERAL_SETTINGS.desktopNotification,
    soundEnabled:
      typeof raw.soundEnabled === 'boolean'
        ? raw.soundEnabled
        : DEFAULT_GENERAL_SETTINGS.soundEnabled,
    taskCompleteNotify:
      typeof raw.taskCompleteNotify === 'boolean'
        ? raw.taskCompleteNotify
        : DEFAULT_GENERAL_SETTINGS.taskCompleteNotify,
  };
}

/**
 * 更新通用设置（支持部分更新）
 */
export async function setGeneralSettings(patch: Partial<GeneralSettings>): Promise<void> {
  const current = await getGeneralSettings();
  const next: GeneralSettings = { ...current, ...patch };
  await setStoreKey(STORE_KEY, next);
}
