import { extensionRegistry, pluginRegistry } from '@slotkitjs/core';
import type { Resource, ResourceLanguage } from 'i18next';
import { i18n } from './index';

export interface I18nResourceContributionValue {
  namespace: string;
  resources: Resource;
}

export type I18nResourceContribution = {
  contributorId: string;
  value: I18nResourceContributionValue;
  priority?: number;
};

export function applyI18nResourceContributions() {
  const contributions =
    extensionRegistry.getContributions<I18nResourceContributionValue>('i18n:resources') ?? [];

  contributions.forEach((c) => {
    const { namespace, resources } = c.value;
    Object.entries(resources).forEach(([lng, res]) => {
      // deep=true, overwrite=true：允许插件覆盖自身默认文案（便于演进）
      i18n.addResourceBundle(lng, namespace, res as ResourceLanguage, true, true);
    });
  });
}

export function startI18nRegistryWatcher() {
  // 首次加载：已注册的插件可能已贡献资源
  applyI18nResourceContributions();

  // 监听插件注册：有些插件是懒加载的
  const unsubscribe = pluginRegistry.subscribe((event) => {
    if (event.type === 'register') {
      applyI18nResourceContributions();
    }
  });

  return unsubscribe;
}
