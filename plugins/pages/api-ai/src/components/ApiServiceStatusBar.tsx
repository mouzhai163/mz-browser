import { useTranslation } from 'react-i18next';
import type { LocalApiConfig } from '../types';

interface ApiServiceStatusBarProps {
  config: LocalApiConfig;
  running: boolean;
}

export function ApiServiceStatusBar({ config, running }: ApiServiceStatusBarProps) {
  const { t } = useTranslation('apiConsole');

  return (
    <section className="h-10 bg-background border-b border-border flex items-center px-6 gap-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('status.status')}:</span>
        <span
          className={`px-1.5 py-0.5 text-[10px] font-bold uppercase border ${
            running
              ? 'bg-success/10 text-success border-success/30'
              : 'bg-secondary text-secondary-foreground border-border'
          }`}
        >
          {running ? t('status.running') : t('status.stopped')}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('status.port')}:</span>
        <span className="font-mono text-foreground">{config.port}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('status.requestsToday')}:</span>
        <span className="font-mono text-foreground">{config.requestsToday.toLocaleString()}</span>
      </div>
    </section>
  );
}
