import { Outlet } from 'react-router';
import { AppSidebar } from './components/app-sidebar';
import AppTitlebar from './components/titlebar';
import { AppBackground } from './components/app-background';
import { DownloadEventSubscriber } from './components/download-event-subscriber';
import { KernelUpdateNotifier } from './components/kernel-update-notifier';
import { RpaSchedulerMount } from './components/rpa-scheduler-mount';
import { MihomoRuntimeSubscriber } from '../../../services/store/src';
import './styles.css';
import { extensionRegistry } from '@slotkitjs/core';
import { appLayoutResources } from './i18n/resources';

const AppLayoutPlugin: React.FC = () => {
  return (
    <div className="relative flex flex-col h-screen w-full min-w-0 overflow-hidden">
      <DownloadEventSubscriber />
      <KernelUpdateNotifier />
      <RpaSchedulerMount />
      <MihomoRuntimeSubscriber />
      {/* 背景层 */}
      <AppBackground />

      {/* 内容层 */}
      <div className="relative z-0 flex flex-col h-full w-full min-w-0 overflow-hidden">
        <AppTitlebar />

        <div className="flex flex-1 min-h-0 overflow-hidden min-w-0">
          <AppSidebar />

          <main className="flex-1 flex flex-col overflow-hidden min-w-0 border-l border-sidebar-border/80">
            <div className="flex-1 overflow-hidden min-w-0">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

// i18n resources
try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'app-layout',
    value: {
      namespace: 'appLayout',
      resources: appLayoutResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[app-layout] Failed to contribute i18n resources:', error);
}

const layoutPlugin = {
  id: 'app-layout',
  name: 'App Layout',
  version: '1.0.0',
  component: AppLayoutPlugin,
  slots: [], // 布局插件不再通过 slot 渲染，而是作为路由的一部分
};

export default layoutPlugin;
