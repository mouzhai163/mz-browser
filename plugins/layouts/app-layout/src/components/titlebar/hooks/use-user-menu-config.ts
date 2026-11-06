import {
  Sun,
  Moon,
  Monitor,
  Languages,
  Settings,
  User,
  Fingerprint,
  Wifi,
  HardDrive,
} from 'lucide-react';
import type { TFunction } from 'i18next';

interface ThemeOption {
  id: 'light' | 'dark' | 'system';
  label: string;
  icon: typeof Sun;
}

interface LanguageOption {
  id: 'zh-CN' | 'en-US';
  label: string;
  icon: typeof Languages;
}

interface SettingsOption {
  id: string;
  label: string;
  icon: typeof User;
  path: string;
}

interface UserMenuConfig {
  themeOptions: ThemeOption[];
  languageOptions: LanguageOption[];
  settingsOptions: SettingsOption[];
}

/**
 * 用户菜单配置 Hook
 */
export function useUserMenuConfig(
  t: TFunction<'appLayout'>,
  tCommon: TFunction<'common'>
): UserMenuConfig {
  const themeOptions: ThemeOption[] = [
    { id: 'light', label: t('status.themeLight'), icon: Sun },
    { id: 'dark', label: t('status.themeDark'), icon: Moon },
    { id: 'system', label: t('status.themeSystem'), icon: Monitor },
  ];

  const languageOptions: LanguageOption[] = [
    { id: 'zh-CN', label: tCommon('language.zhCN'), icon: Languages },
    { id: 'en-US', label: tCommon('language.enUS'), icon: Languages },
  ];

  const settingsOptions: SettingsOption[] = [
    {
      id: 'account',
      label: t('status.settingsAccount'),
      icon: User,
      path: '/settings?menu=account',
    },
    {
      id: 'general',
      label: t('status.settingsGeneral'),
      icon: Settings,
      path: '/settings?menu=general',
    },
    {
      id: 'browser',
      label: t('status.settingsBrowser'),
      icon: Fingerprint,
      path: '/settings?menu=browser',
    },
    {
      id: 'network',
      label: t('status.settingsNetwork'),
      icon: Wifi,
      path: '/settings?menu=network',
    },
    {
      id: 'storage',
      label: t('status.settingsStorage'),
      icon: HardDrive,
      path: '/settings?menu=storage',
    },
  ];

  return {
    themeOptions,
    languageOptions,
    settingsOptions,
  };
}
