import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Resource } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import {
  getInitialLocale,
  initI18n,
  isSupportedLocale,
  type Locale,
  setLocale,
  i18n,
} from '@/i18n';
import { applyI18nResourceContributions, startI18nRegistryWatcher } from '@/i18n/registry';

type I18nProviderProps = {
  children: React.ReactNode;
  defaultLocale?: Locale;
  resources?: Resource;
};

type LocaleContextState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextState | null>(null);

export function I18nProvider({ children, defaultLocale = 'zh-CN', resources }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale(defaultLocale));

  // 初始化 i18n（仅一次）
  useMemo(() => initI18n(locale, resources), []); // eslint-disable-line react-hooks/exhaustive-deps

  // 资源注册器：应用所有插件贡献的资源，并订阅后续插件注册
  useEffect(() => {
    applyI18nResourceContributions();
    const unsubscribe = startI18nRegistryWatcher();
    return () => unsubscribe();
  }, []);

  // locale 改变时同步到 i18next + localStorage
  useEffect(() => {
    setLocale(locale);
  }, [locale]);

  // 支持 URL 参数：?lang=zh-CN|en-US（默认持久化）
  useEffect(() => {
    const applyFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const lang = params.get('lang');
      if (isSupportedLocale(lang)) {
        setLocaleState(lang);
      }
    };

    applyFromUrl();
    window.addEventListener('popstate', applyFromUrl);
    return () => window.removeEventListener('popstate', applyFromUrl);
  }, []);

  // 支持外部通过 i18next.changeLanguage 改变时同步回 context
  useEffect(() => {
    const handler = (lng: string) => {
      if (isSupportedLocale(lng)) setLocaleState(lng);
    };
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale: (next: Locale) => setLocaleState(next),
    }),
    [locale]
  );

  return (
    <LocaleContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within I18nProvider');
  return ctx;
}
