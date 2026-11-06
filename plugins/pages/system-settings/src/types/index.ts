import type { ElementType } from 'react';

/**
 * 设置页面导航标签类型
 */
export type SettingsTab = 'account' | 'general' | 'browser' | 'network' | 'storage';

/**
 * 导航项配置
 */
export interface NavItem {
  id: SettingsTab;
  label: string;
  icon: ElementType;
}

/**
 * 主题模式
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * 主题选项配置
 */
export interface ThemeOption {
  id: ThemeMode;
  label: string;
  icon: ElementType;
}

/**
 * 语言选项配置
 */
export interface LanguageOption {
  id: string;
  label: string;
  native: string;
}
