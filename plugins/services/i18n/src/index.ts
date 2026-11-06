import { extensionRegistry } from '@slotkitjs/core';

const common = {
  'zh-CN': {
    language: {
      title: '语言',
      zhCN: '中文',
      enUS: 'English',
    },
  },
  'en-US': {
    language: {
      title: 'Language',
      zhCN: '中文',
      enUS: 'English',
    },
  },
};

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'i18n',
    value: {
      namespace: 'common',
      resources: common,
    },
    priority: 1,
  });

  console.log('[i18n] resources contributed');
} catch (error) {
  console.warn('[i18n] failed to contribute resources:', error);
}

const i18nPlugin = {
  id: 'i18n',
  name: 'I18n Service',
  version: '1.0.0',
  component: null,
  slots: [],
};

export default i18nPlugin;
