// 确保扩展点在所有插件导入之前注册
import '../../extension-points';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router';
import { pluginRegistry } from '@slotkitjs/core';
import { useSettingsDialogStore } from '../../../../plugins/services/store/src';
import { SettingsBootstrap } from '../../../../plugins/services/store/src';
import { ThemeProvider } from '@/components/theme-provider';
import { I18nProvider } from '@/components/i18n-provider';
import { AntdProvider } from '@/components/antd-provider';
import { commonResources } from '@/i18n/resources/common';
import { Toaster } from '@/components/ui/sonner';
import { AppRoutes } from '../AppRoutes';
import { SyncerRenderer } from '../SyncerRenderer';
import { useDisableDevTools } from '@/hooks/use-disable-dev-tools';

const SettingsDialog = React.lazy(() =>
  import('../../../../plugins/pages/system-settings/src/components/settings-dialog').then(
    (module) => ({ default: module.SettingsDialog })
  )
);

interface AppLayoutProps {
  /**
   * 布局模式：'main' 渲染主应用布局，'syncer' 渲染同步器窗口
   */
  mode?: 'main' | 'syncer';
  pluginsReady?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ mode = 'main', pluginsReady = false }) => {
  const [windowManagerComponent, setWindowManagerComponent] = useState<React.ComponentType | null>(
    null
  );
  const isSettingsDialogOpen = useSettingsDialogStore((state) => state.isOpen);
  const [routesReady, setRoutesReady] = useState(false);
  useDisableDevTools();

  const handleRoutesReady = useCallback(() => {
    setRoutesReady(true);
  }, []);

  // 监听插件注册，确保 window-manager 插件加载后被渲染
  useEffect(() => {
    const checkWindowManager = () => {
      const windowManagerPlugin = pluginRegistry.getPlugin('window-manager');
      if (windowManagerPlugin?.component) {
        setWindowManagerComponent(() => windowManagerPlugin.component);
        console.log('[AppLayout] WindowManager plugin loaded');
      }
    };

    // 立即检查一次
    checkWindowManager();

    // 订阅插件注册事件
    const unsubscribe = pluginRegistry.subscribe((event) => {
      if (event.type === 'register' && event.plugin?.id === 'window-manager') {
        checkWindowManager();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 如果是 syncer 模式，渲染同步器窗口
  if (mode === 'syncer') {
    return (
      <ThemeProvider defaultTheme="system" storageKey="mz-ui-theme">
        <SyncerRenderer />
      </ThemeProvider>
    );
  }

  // 默认渲染主应用布局
  return (
    <SettingsBootstrap>
      <ThemeProvider defaultTheme="system" storageKey="mz-ui-theme">
        <I18nProvider resources={{ common: commonResources }}>
          <AntdProvider>
            <BrowserRouter>
              {pluginsReady && routesReady && windowManagerComponent
                ? React.createElement(windowManagerComponent)
                : null}
              <AppRoutes onReady={handleRoutesReady} />
              {isSettingsDialogOpen ? (
                <Suspense fallback={null}>
                  <SettingsDialog />
                </Suspense>
              ) : null}
              <Toaster />
            </BrowserRouter>
          </AntdProvider>
        </I18nProvider>
      </ThemeProvider>
    </SettingsBootstrap>
  );
};
