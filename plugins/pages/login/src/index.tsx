import { extensionRegistry } from '@slotkitjs/core';
import { LoginForm } from './components/login-form';
import { authResources } from './i18n/resources';

// 页面组件
const LoginPage: React.FC = () => {
  return <LoginForm />;
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'login',
    value: {
      path: '/auth/login',
      Component: LoginPage,
    },
    priority: 10,
  });
  console.log('[login] Route contributed at module load: /auth/login');
} catch (error) {
  console.warn(
    '[login] Failed to contribute route at module load (extension point may not be registered yet):',
    error
  );
}

// i18n resources
try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'auth',
    value: {
      namespace: 'auth',
      resources: authResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[login] Failed to contribute i18n resources:', error);
}

const loginPlugin = {
  id: 'login',
  name: 'Login',
  version: '1.0.0',
  component: LoginPage,
  slots: [],
};

export default loginPlugin;
