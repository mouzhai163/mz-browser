import { ChevronDown, Palette, Languages, Settings as SettingsIcon } from 'lucide-react';
import {
  useSettingsDialogStore,
  setGeneralSettings,
  type ThemeMode,
  type SettingsDialogTab,
} from '../../../../../services/store/src';
import { useTheme } from '@/components/theme-provider';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { useUserMenuConfig } from './hooks/use-user-menu-config';

/**
 * 设置菜单：打开设置、切换语言和主题。软件没有用户、团队和工作空间。
 */
export function UserMenu() {
  const { theme, setTheme } = useTheme();
  const { i18n, t: tCommon } = useTranslation('common');
  const { t } = useTranslation('appLayout');
  const { open: openSettingsDialog } = useSettingsDialogStore();
  const { themeOptions, languageOptions, settingsOptions } = useUserMenuConfig(t, tCommon);

  const handleSettingsOpen = (tabId: string) => {
    openSettingsDialog(tabId as SettingsDialogTab);
  };

  const handleLanguageChange = (lng: 'zh-CN' | 'en-US') => {
    void i18n.changeLanguage(lng);
    localStorage.setItem('mz-ui-locale', lng);
    void setGeneralSettings({ language: lng });
  };

  const handleThemeChange = (next: ThemeMode) => {
    setTheme(next);
    void setGeneralSettings({ theme: next });
  };

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            data-testid="settings-menu"
            className="flex items-center gap-2 px-4 h-8 text-[10px] text-foreground bg-muted hover:bg-primary/10 hover:text-foreground transition-all cursor-pointer outline-none rounded-sm mx-2"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="font-mono tracking-tight text-[12px]">{t('status.settings')}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 overflow-y-hidden">
          {/* 系统设置选项 */}
          {settingsOptions.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuItem
                key={option.id}
                onClick={() => handleSettingsOpen(option.id)}
                className="cursor-pointer"
              >
                <Icon className="w-4 h-4" />
                <span>{option.label}</span>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          {/* 语言 */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Languages className="w-4 h-4" />
              <span>{tCommon('language.title')}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {languageOptions.map((option) => {
                const isActive = i18n.language === option.id;
                return (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => handleLanguageChange(option.id)}
                    className="cursor-pointer"
                  >
                    <option.icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                    <span className={isActive ? 'text-primary font-medium' : ''}>
                      {option.label}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          {/* 主题 */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Palette className="w-4 h-4" />
              <span>{t('status.theme')}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = theme === option.id;
                return (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => handleThemeChange(option.id)}
                    className="cursor-pointer"
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                    <span className={isActive ? 'text-primary font-medium' : ''}>
                      {option.label}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
  );
}
