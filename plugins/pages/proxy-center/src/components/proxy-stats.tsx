import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ProxyStatsProps {
  total?: number;
  healthy?: number;
  unreachable?: number;
  selectedCount?: number;
  onTestSelected?: () => void;
}

export function ProxyStats({
  total = 0,
  healthy = 0,
  unreachable = 0,
  selectedCount = 0,
  onTestSelected,
}: ProxyStatsProps) {
  const { t } = useTranslation('proxy');

  return (
    <section className="h-10 bg-background border-b border-border flex items-center px-6 gap-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.total')}:</span>
        <span className="font-mono text-foreground">{total}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.healthy')}:</span>
        <span className="font-mono text-success font-bold">{healthy}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.unreachable')}:</span>
        <span className="font-mono text-destructive font-bold">{unreachable}</span>
      </div>
      <div className="ml-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onTestSelected}
              disabled={selectedCount === 0}
            >
              <Activity className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {selectedCount > 0
              ? t('stats.testSelected', { count: selectedCount, defaultValue: `测试选中的 ${selectedCount} 个代理` })
              : t('stats.selectToTest', { defaultValue: '请先选择要测试的代理' })}
          </TooltipContent>
        </Tooltip>
      </div>
    </section>
  );
}
