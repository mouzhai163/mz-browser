import { useTranslation } from 'react-i18next';
import { Activity, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProxyBatchActionsProps {
  selectedCount: number;
  onClear?: () => void;
  onTestSelected?: () => void;
  onDelete?: () => void;
}

export function ProxyBatchActions({
  selectedCount,
  onClear,
  onTestSelected,
  onDelete,
}: ProxyBatchActionsProps) {
  const { t } = useTranslation('proxy');
  if (selectedCount === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground px-3 py-2 flex items-center gap-3 shadow-2xl border border-border z-[100] rounded-sm">
      <div className="flex items-center gap-2 pr-3 border-r border-border whitespace-nowrap">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">
          {t('batchActions.selected')}:
        </span>
        <span className="font-mono text-primary font-bold">
          {selectedCount.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="flex gap-1 flex-nowrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={onTestSelected}
          className="text-xs font-bold h-8 px-3"
        >
          <Activity className="h-3.5 w-3.5 mr-1.5" />
          {t('batchActions.testSelected', { defaultValue: '测试选中' })}
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-3"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {t('batchActions.delete')}
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        className="ml-3 h-7 w-7"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
