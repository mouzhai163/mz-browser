import { useTranslation } from 'react-i18next';
import { UserRound, CircleCheck, CirclePause, TriangleAlert } from 'lucide-react';
import { StatCards } from '@/components/stat-cards';

interface AccountStatsProps {
  total: number;
  active: number;
  inactive: number;
  expired: number;
}

export function AccountStats({ total, active, inactive, expired }: AccountStatsProps) {
  const { t } = useTranslation('account');

  return (
    <StatCards
      items={[
        { key: 'total', label: t('stats.total'), value: total, icon: UserRound, tone: 'primary' },
        { key: 'active', label: t('stats.active'), value: active, icon: CircleCheck, tone: 'success' },
        { key: 'inactive', label: t('stats.inactive'), value: inactive, icon: CirclePause, tone: 'warning' },
        { key: 'expired', label: t('stats.expired'), value: expired, icon: TriangleAlert, tone: 'danger' },
      ]}
    />
  );
}
