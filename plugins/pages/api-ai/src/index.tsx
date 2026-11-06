import { extensionRegistry } from '@slotkitjs/core';
import { ApiConsolePage } from './components/ApiConsolePage';
import { apiConsoleResources } from './i18n/resources';

try {
  extensionRegistry.contribute('routes', {
    contributorId: 'api-console',
    value: {
      path: '/api',
      Component: ApiConsolePage,
    },
    priority: 10,
  });
  console.log('[api-ai] Route contributed at module load: /api');
} catch (error) {
  console.warn('[api-ai] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'api-console',
    value: {
      namespace: 'apiConsole',
      resources: apiConsoleResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[api-ai] Failed to contribute i18n resources:', error);
}

const apiConsolePlugin = {
  id: 'api-console',
  name: 'API & AI',
  version: '1.0.0',
  component: ApiConsolePage,
  slots: [],
};

export default apiConsolePlugin;
