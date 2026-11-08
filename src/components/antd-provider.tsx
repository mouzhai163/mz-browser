import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/theme-provider';

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Ant Design 的全局主题：颜色、圆角与 index.css 里的 shadcn 变量保持同一套，
 * 这样新旧组件混用时看起来是一个体系。
 */
export function AntdProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  const locale = i18n.language?.toLowerCase().startsWith('zh') ? zhCN : enUS;

  return (
    <ConfigProvider
      locale={locale}
      theme={{
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: dark ? '#1668dc' : '#1677ff',
          borderRadius: 6,
          fontFamily: "'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', Inter, system-ui, sans-serif",
          fontSize: 14,
        },
        components: {
          Table: { headerBg: dark ? '#1a1a1a' : '#fafafa' },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
