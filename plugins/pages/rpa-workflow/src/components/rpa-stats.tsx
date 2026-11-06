import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RpaStatsProps {
  total: number;
  running: number;
  completed: number;
  failed: number;
  scheduled: number;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onRefresh: () => void;
}

export function RpaStats({
  total,
  running,
  completed,
  failed,
  scheduled,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
}: RpaStatsProps) {
  const { t } = useTranslation('rpa');

  return (
    <section className="h-10 bg-background border-b border-border flex items-center px-6 gap-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.total')}:</span>
        <span className="font-mono text-foreground">{total}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.running')}:</span>
        <span className="font-mono text-amber-500 font-bold">{running}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.completed')}:</span>
        <span className="font-mono text-emerald-500 font-bold">{completed}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.failed')}:</span>
        <span className="font-mono text-destructive font-bold">{failed}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.scheduled')}:</span>
        <span className="font-mono text-blue-500 font-bold">{scheduled}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Tabs value={statusFilter} onValueChange={onStatusFilterChange}>
          <TabsList className="h-7 bg-secondary">
            <TabsTrigger value="all" className="text-[10px] px-2.5 h-6">
              {t('tabs.all')}
            </TabsTrigger>
            <TabsTrigger value="running" className="text-[10px] px-2.5 h-6">
              {t('tabs.running')}
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="text-[10px] px-2.5 h-6">
              {t('tabs.scheduled')}
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-[10px] px-2.5 h-6">
              {t('tabs.completed')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onRefresh}
          title={t('stats.refresh')}
          aria-label={t('stats.refresh')}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </section>
  );
}
