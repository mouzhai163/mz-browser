import { Minus, X, Square, Sun, Moon } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/theme-provider';

export default function AuthorizationTitlebar() {
  const { t, i18n } = useTranslation('authLayout');
  const { theme, setTheme } = useTheme();

  // 获取实际显示的主题（处理 system 模式）
  const getActualTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  const handleToggleTheme = () => {
    const actualTheme = getActualTheme();
    setTheme(actualTheme === 'dark' ? 'light' : 'dark');
  };

  const handleToggleLanguage = () => {
    const newLang = i18n.language === 'zh-CN' ? 'en-US' : 'zh-CN';
    void i18n.changeLanguage(newLang);
    localStorage.setItem('simprint-ui-locale', newLang);
  };

  const handleMinimize = () => {
    getCurrentWindow().minimize();
  };

  const handleToggleMaximize = () => {
    getCurrentWindow().toggleMaximize();
  };

  const handleClose = () => {
    getCurrentWindow().close();
  };

  const isDark = getActualTheme() === 'dark';
  const isChinese = i18n.language === 'zh-CN' || i18n.language.startsWith('zh');

  return (
    <div
      data-tauri-drag-region
      className="h-12 bg-background border-b border-border/80 flex items-center justify-between select-none shrink-0"
    >
      <div className="flex items-center h-full">
        {/* LOGO 和应用信息 */}
        <div className="flex items-center gap-3 px-5 border-r border-border/80 h-full">
          <img src="/assets/logo.png" alt="Simprint Logo" className="w-7 h-7 object-contain" />
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold text-foreground tracking-tight leading-tight">
              Simprint
            </p>
            <p className="text-[9px] text-muted-foreground/80 uppercase tracking-wider leading-tight">
              释放未来
            </p>
          </div>
        </div>

        {/* 认证页面标识 */}
        <div className="flex items-center gap-2.5 px-5 text-xs text-muted-foreground">
          <span className="text-foreground font-medium">{t('brand.titlebar')}</span>
        </div>
      </div>

      {/* 右侧窗口控制区域 */}
      <div className="flex items-center h-full">
        {/* 语言切换按钮 */}
        <button
          className="w-14 h-full flex items-center justify-center text-muted-foreground/80"
          onClick={handleToggleLanguage}
          title={isChinese ? 'Switch to English' : '切换到中文'}
        >
          <span className="text-xs font-bold uppercase">{isChinese ? 'cn' : 'en'}</span>
        </button>

        {/* 主题切换按钮 */}
        <button
          className="w-14 h-full flex items-center justify-center text-muted-foreground/80"
          onClick={handleToggleTheme}
          title={isDark ? '切换到浅色模式' : '切换到深色模式'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* 窗口控制按钮 */}
        <div className="flex items-center h-full border-l border-border/80">
          {/* 最小化按钮 */}
          <button
            className="w-12 h-full flex items-center justify-center text-muted-foreground/80 hover:bg-accent/80 hover:text-foreground transition-all duration-200 ease-in-out"
            onClick={handleMinimize}
            title="最小化"
          >
            <Minus className="w-4 h-4" />
          </button>

          {/* 最大化/还原按钮 */}
          <button
            className="w-12 h-full flex items-center justify-center text-muted-foreground/80 hover:bg-accent/80 hover:text-foreground transition-all duration-200 ease-in-out"
            onClick={handleToggleMaximize}
            title="最大化"
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          {/* 关闭按钮 */}
          <button
            className="w-12 h-full flex items-center justify-center text-muted-foreground/80 hover:bg-destructive/90 hover:text-destructive-foreground transition-all duration-200 ease-in-out"
            onClick={handleClose}
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
