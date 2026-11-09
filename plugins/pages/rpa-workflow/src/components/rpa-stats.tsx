import { useTranslation } from 'react-i18next';
import { Workflow, Zap, CircleCheck, TriangleAlert, Clock } from 'lucide-react';
import { StatCards } from '@/components/stat-cards';

interface RpaStatsProps {
  total: number;
  running: number;
  completed: number;
  failed: number;
  scheduled: number;
}

export function RpaStats({ total, running, completed, failed, scheduled }: RpaStatsProps) {
  const { t } = useTranslation('rpa');

  return (
    <StatCards
      items={[
        { key: 'total', label: t('stats.total'), value: total, icon: Workflow, tone: 'primary' },
        { key: 'running', label: t('stats.running'), value: running, icon: Zap, tone: 'warning' },
        { key: 'completed', label: t('stats.completed'), value: completed, icon: CircleCheck, tone: 'success' },
        { key: 'failed', label: t('stats.failed'), value: failed, icon: TriangleAlert, tone: 'danger' },
        { key: 'scheduled', label: t('stats.scheduled'), value: scheduled, icon: Clock, tone: 'primary' },
      ]}
    />
  );
}
