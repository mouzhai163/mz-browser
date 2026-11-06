import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

export type Locale = 'zh-CN' | 'en-US';

export const LOCALE_STORAGE_KEY = 'simprint-ui-locale';

export const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en-US'];

export function isSupportedLocale(v: string | null | undefined): v is Locale {
  return v === 'zh-CN' || v === 'en-US';
}

export function getInitialLocale(defaultLocale: Locale = 'zh-CN'): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isSupportedLocale(stored)) return stored;
  return defaultLocale;
}

export function setLocale(locale: Locale) {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  void i18n.changeLanguage(locale);
}

export function initI18n(initialLocale: Locale, resources?: Resource) {
  if (i18n.isInitialized) return i18n;

  void i18n.use(initReactI18next).init({
    lng: initialLocale,
    fallbackLng: 'zh-CN',
    supportedLngs: SUPPORTED_LOCALES,
    resources,
    ns: ['common'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
    returnEmptyString: false,
    // 开发期方便定位缺失 key
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (lngs, ns, key) => {
      if (import.meta.env.DEV) {
        console.warn('[i18n] missing key:', { lngs, ns, key });
      }
    },
  });

  return i18n;
}

export { i18n };
