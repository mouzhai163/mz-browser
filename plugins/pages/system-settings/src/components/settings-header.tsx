import { useTranslation } from 'react-i18next';
import type { NavItem } from '../types';

interface SettingsHeaderProps {
  currentNav: NavItem | undefined;
}

/**
 * 系统设置页面头部组件
 */
export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ currentNav }) => {
  const { t } = useTranslation('settings');

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background shrink-0">
      <div className="flex items-center gap-2">
        {currentNav && <currentNav.icon className="w-4 h-4 text-muted-foreground" />}
        <h2 className="text-sm font-semibold text-foreground">{currentNav?.label}</h2>
      </div>
      <button className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded hover:bg-primary/90 transition-colors">
        {t('saveSettings')}
      </button>
    </header>
  );
};
