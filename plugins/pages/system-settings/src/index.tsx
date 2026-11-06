import { useMemo } from 'react';
import { extensionRegistry } from '@slotkitjs/core';
import { useTranslation } from 'react-i18next';
import { settingsResources } from './i18n/resources';
import { getNavItems } from './config';
import { useSettingsTabs } from './hooks/use-settings-tabs';
import { SettingsSidebar } from './components/settings-sidebar';
import { SettingsHeader } from './components/settings-header';
import { SettingsContent } from './components/settings-content';
import { SettingsDialog } from './components/settings-dialog';

// 导出弹窗组件供外部使用
export { SettingsDialog } from './components/settings-dialog';

/**
 * 系统设置页面
 */
const SystemSettingsPage: React.FC = () => {
  const { t } = useTranslation('settings');

  // Tab 管理
  const { activeTab, handleTabChange } = useSettingsTabs();

  // Get localized navigation items
  const localizedNavItems = useMemo(() => getNavItems(t), [t]);
  const currentNav = localizedNavItems.find((item) => item.id === activeTab);

  return (
    <main className="h-full flex min-w-0">
      {/* 左侧导航 */}
      <SettingsSidebar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* 右侧内容 */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <SettingsHeader currentNav={currentNav} />
        <SettingsContent activeTab={activeTab} />
      </div>
    </main>
  );
};

// ==================== 路由注册 ====================

try {
  extensionRegistry.contribute('routes', {
    contributorId: 'system-settings',
    value: {
      path: '/settings',
      Component: SystemSettingsPage,
    },
    priority: 10,
  });
  console.log('[system-settings] Route contributed at module load: /settings');
} catch (error) {
  console.warn('[system-settings] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'system-settings',
    value: {
      namespace: 'settings',
      resources: settingsResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[system-settings] Failed to contribute i18n resources:', error);
}

const systemSettingsPlugin = {
  id: 'system-settings',
  name: 'System Settings',
  version: '1.0.0',
  component: SystemSettingsPage,
  slots: [],
};

export default systemSettingsPlugin;
