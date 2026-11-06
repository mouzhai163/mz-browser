import { extensionRegistry } from '@slotkitjs/core';
import { EnvironmentList } from './components/environment-list';
import { environmentResources } from './i18n/resources';
import './index.css';

// 页面组件
const EnvironmentManagerPage: React.FC = () => {
  return <EnvironmentList />;
};

// 在模块加载时贡献路由（而不是在组件渲染时）
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'environment-manager',
    value: {
      path: '/',
      Component: EnvironmentManagerPage,
    },
    priority: 10,
  });
  console.log('[environment-manager] Route contributed at module load: /');
} catch (error) {
  console.warn(
    '[environment-manager] Failed to contribute route at module load (extension point may not be registered yet):',
    error
  );
}

// i18n resources
try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'environment-manager',
    value: {
      namespace: 'environment',
      resources: environmentResources,
    },
    priority: 10,
  });
  console.log('[environment-manager] i18n resources contributed:', {
    namespace: 'environment',
    languages: Object.keys(environmentResources),
  });
} catch (error) {
  console.warn('[environment-manager] Failed to contribute i18n resources:', error);
}

const environmentManagerPlugin = {
  id: 'environment-manager',
  name: 'Environment Manager',
  version: '1.0.0',
  component: EnvironmentManagerPage,
  slots: [],
};

export default environmentManagerPlugin;
