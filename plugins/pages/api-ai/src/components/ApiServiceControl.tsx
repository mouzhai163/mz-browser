import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';

interface ApiServiceControlProps {
  running: boolean;
  onToggle: (enabled: boolean) => void;
}

export function ApiServiceControl({ running, onToggle }: ApiServiceControlProps) {
  const { t } = useTranslation('apiConsole');

  return (
    <div className="bg-background p-4 mb-4 relative backdrop-blur-xl border border-border rounded-sm">
      <div className="flex items-center justify-between ">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground mb-1">{t('service.control')}</h3>
          <p className="text-xs text-muted-foreground">{t('service.controlDesc')}</p>
        </div>
        <Switch checked={running} onCheckedChange={onToggle} className="ml-4" />
      </div>
    </div>
  );
}
