/**
 * 设置引导：在渲染 ThemeProvider / I18nProvider 之前加载通用设置，
 * 将 theme、language 写入 localStorage，确保应用启动时使用已保存的配置。
 */
import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'simprint-ui-theme';
const LOCALE_STORAGE_KEY = 'simprint-ui-locale';

function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export function SettingsBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isTauriEnv()) {
      setReady(true);
      return;
    }

    let cancelled = false;

    async function loadAndApply() {
      try {
        const { getGeneralSettings } = await import('../stores/general-settings');
        const s = await getGeneralSettings();

        if (cancelled) return;

        if (s.theme) {
          localStorage.setItem(THEME_STORAGE_KEY, s.theme);
        }
        if (s.language) {
          localStorage.setItem(LOCALE_STORAGE_KEY, s.language);
        }
      } catch (e) {
        console.warn('[SettingsBootstrap] 加载通用设置失败，使用默认值:', e);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void loadAndApply();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
