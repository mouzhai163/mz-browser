/**
 * 通用设置（外观、启动、通知）
 * 仅用于持久化存储
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type Locale = 'zh-CN' | 'en-US';

export interface GeneralSettings {
  /** 主题模式 */
  theme: ThemeMode;
  /** 界面语言 */
  language: Locale;
  /** 默认折叠侧边栏 */
  defaultCollapseSidebar: boolean;
  /** 开机自动启动 */
  autoStart: boolean;
  /** 启动时最小化 */
  startMinimized: boolean;
  /** 记住窗口位置 */
  rememberWindowPosition: boolean;
  /** 桌面通知 */
  desktopNotification: boolean;
  /** 声音提醒 */
  soundEnabled: boolean;
  /** 任务完成通知 */
  taskCompleteNotify: boolean;
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  theme: 'system',
  language: 'zh-CN',
  defaultCollapseSidebar: false,
  autoStart: false,
  startMinimized: false,
  rememberWindowPosition: true,
  desktopNotification: true,
  soundEnabled: true,
  taskCompleteNotify: true,
};

export const THEME_OPTIONS: ThemeMode[] = ['light', 'dark', 'system'];
export const LOCALE_OPTIONS: Locale[] = ['zh-CN', 'en-US'];
