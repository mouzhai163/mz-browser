import { Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ApiServiceHeader() {
  const { t } = useTranslation('apiConsole');

  return (
    <header className="h-[52px] border-b border-border flex items-center px-6 bg-background/10 backdrop-blur-2xl shrink-0">
      <div className="flex items-center gap-2">
        <Terminal className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{t('title')}</span>
      </div>
    </header>
  );
}
