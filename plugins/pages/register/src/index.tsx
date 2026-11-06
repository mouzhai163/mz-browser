import { extensionRegistry } from '@slotkitjs/core';
import { RegisterForm } from './components/register-form';

// 页面组件
const RegisterPage: React.FC = () => {
  return <RegisterForm />;
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'register',
    value: {
      path: '/auth/register',
      Component: RegisterPage,
    },
    priority: 10,
  });
  console.log('[register] Route contributed at module load: /auth/register');
} catch (error) {
  console.warn(
    '[register] Failed to contribute route at module load (extension point may not be registered yet):',
    error
  );
}

const registerPlugin = {
  id: 'register',
  name: 'Register',
  version: '1.0.0',
  component: RegisterPage,
  slots: [],
};

export default registerPlugin;
