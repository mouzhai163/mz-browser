import { useTranslation } from 'react-i18next';
import { Activity, Globe, CircleCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCards } from '@/components/stat-cards';

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
    <div className="space-y-3">
      <StatCards
        items={[
          { key: 'total', label: t('stats.total'), value: total, icon: Globe, tone: 'primary' },
          { key: 'healthy', label: t('stats.healthy'), value: healthy, icon: CircleCheck, tone: 'success' },
          { key: 'unreachable', label: t('stats.unreachable'), value: unreachable, icon: TriangleAlert, tone: 'danger' },
        ]}
      />
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onTestSelected} disabled={selectedCount === 0}>
          <Activity className="h-4 w-4" />
          {selectedCount > 0
            ? t('stats.testSelected', { count: selectedCount, defaultValue: `测试选中的 ${selectedCount} 个代理` })
            : t('stats.selectToTest', { defaultValue: '请先选择要测试的代理' })}
        </Button>
      </div>
    </div>
  );
}
