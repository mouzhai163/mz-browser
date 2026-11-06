import { useTranslation } from 'react-i18next';
import { RotateCw } from 'lucide-react';

interface AuditStatsProps {
  total?: number;
  todayCount?: number;
  weekCount?: number;
  onRefresh?: () => void;
}

export function AuditStats({
  total = 0,
  todayCount = 0,
  weekCount = 0,
  onRefresh,
}: AuditStatsProps) {
  const { t } = useTranslation('audit');

  return (
    <section className="h-10 bg-background border-b border-border flex items-center px-6 gap-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.total')}:</span>
        <span className="font-mono text-foreground">{total}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.today')}:</span>
        <span className="font-mono text-blue-500 font-bold">{todayCount}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.week')}:</span>
        <span className="font-mono text-amber-500 font-bold">{weekCount}</span>
      </div>
      <div className="ml-auto">
        <button
          onClick={onRefresh}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={t('stats.refresh')}
          aria-label={t('stats.refresh')}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}
