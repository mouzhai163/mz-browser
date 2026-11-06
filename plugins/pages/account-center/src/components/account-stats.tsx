import { useTranslation } from 'react-i18next';

interface AccountStatsProps {
  total: number;
  active: number;
  inactive: number;
  expired: number;
}

export function AccountStats({ total, active, inactive, expired }: AccountStatsProps) {
  const { t } = useTranslation('account');

  return (
    <section className="h-10 bg-background border-b border-border flex items-center px-6 gap-6">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground uppercase">{t('stats.total')}:</span>
        <span className="font-mono font-bold">{total}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground uppercase">{t('stats.active')}:</span>
        <span className="font-mono text-green-600 dark:text-green-400 font-bold">{active}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground uppercase">{t('stats.inactive')}:</span>
        <span className="font-mono text-muted-foreground font-bold">{inactive}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground uppercase">{t('stats.expired')}:</span>
        <span className="font-mono text-destructive font-bold">{expired}</span>
      </div>
    </section>
  );
}
