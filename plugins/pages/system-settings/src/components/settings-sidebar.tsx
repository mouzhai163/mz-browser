import { useTranslation } from 'react-i18next';
import { getNavItems } from '../config';
import { SettingsNavigation } from './settings-navigation';
import type { SettingsTab } from '../types';

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

/**
 * 系统设置侧边栏组件
 */
export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation('settings');
  const navItems = getNavItems(t);

  return (
    <aside className="w-56 border-r border-border shrink-0 flex flex-col h-full relative overflow-hidden">
      {/* 从下往上的渐变层：底部透明，顶部不透明 */}
      <div
        className="absolute inset-0 pointer-events-none bg-background"
        style={{
          maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
        }}
      />
      <div className="relative z-10 flex flex-col h-full">
        <div className="p-4 border-b border-border shrink-0">
          <h1 className="text-lg font-semibold text-foreground">{t('pageTitle')}</h1>
        </div>
        <SettingsNavigation navItems={navItems} activeTab={activeTab} onTabChange={onTabChange} />
      </div>
    </aside>
  );
};
