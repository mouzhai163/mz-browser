import { Settings, Fingerprint, Wifi, HardDrive, Sun, Moon, Monitor } from 'lucide-react';
import type { NavItem, ThemeOption, LanguageOption } from '../types';

/**
 * Get localized navigation items
 * Note: This should be called within a component that has useTranslation hook
 */
export const getNavItems = (t: (key: string) => string): NavItem[] => [
  { id: 'general', label: t('navGeneral'), icon: Settings },
  { id: 'browser', label: t('navBrowser'), icon: Fingerprint },
  { id: 'network', label: t('navNetwork'), icon: Wifi },
  { id: 'storage', label: t('navStorage'), icon: HardDrive },
];

/**
 * Navigation items (for backward compatibility, will use default labels)
 * @deprecated Use getNavItems with translation function instead
 */
export const navItems: NavItem[] = [
  { id: 'general', label: '通用设置', icon: Settings },
  { id: 'browser', label: '浏览器与自动化', icon: Fingerprint },
  { id: 'network', label: '网络与同步', icon: Wifi },
  { id: 'storage', label: '存储与更新', icon: HardDrive },
];

/**
 * 主题选项配置
 */
export const themeOptions: ThemeOption[] = [
  { id: 'light', label: '浅色', icon: Sun },
  { id: 'dark', label: '深色', icon: Moon },
  { id: 'system', label: '跟随系统', icon: Monitor },
];

/**
 * 语言选项配置
 */
export const languageOptions: LanguageOption[] = [
  { id: 'zh-CN', label: '简体中文', native: '简体中文' },
  { id: 'zh-TW', label: '繁體中文', native: '繁體中文' },
  { id: 'en-US', label: 'English', native: 'English (US)' },
  { id: 'ja-JP', label: '日本語', native: '日本語' },
];

/**
 * 指纹模式配置
 */
export const fingerprintModes = [
  { id: 'random', label: '随机生成', desc: '每次随机生成指纹' },
  { id: 'custom', label: '自定义', desc: '使用预设配置模板' },
  { id: 'real', label: '真实指纹', desc: '基于本机真实信息' },
] as const;

export type FingerprintMode = (typeof fingerprintModes)[number]['id'];
