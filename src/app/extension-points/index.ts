import { extensionRegistry } from '@slotkitjs/core';

/**
 * 注册路由扩展点
 * 确保在插件加载前就存在
 */
export function registerRouteExtensionPoint() {
  if (!extensionRegistry.hasExtensionPoint('routes')) {
    extensionRegistry.registerExtensionPoint({
      id: 'routes',
      name: 'Routes',
      description: '应用路由扩展点',
      multiple: true,
      schema: {
        type: 'object',
        required: ['path', 'Component'],
        properties: {
          path: { type: 'string' },
          Component: { type: 'function' },
        },
      },
    });
    console.log('[ExtensionPoints] Routes extension point registered');
  }
}

/**
 * 注册 i18n 资源扩展点
 * 确保在插件加载前就存在
 */
export function registerI18nResourcesExtensionPoint() {
  if (!extensionRegistry.hasExtensionPoint('i18n:resources')) {
    extensionRegistry.registerExtensionPoint({
      id: 'i18n:resources',
      name: 'I18n Resources',
      description: '国际化资源扩展点',
      multiple: true,
      schema: {
        type: 'object',
        required: ['namespace', 'resources'],
        properties: {
          namespace: { type: 'string' },
          resources: { type: 'object' },
        },
      },
    });
    console.log('[ExtensionPoints] I18n resources extension point registered');
  }
}

// 在模块加载时立即注册扩展点（确保在插件加载前就存在）
registerRouteExtensionPoint();
registerI18nResourcesExtensionPoint();
