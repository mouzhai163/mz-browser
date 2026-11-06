import { useTranslation } from 'react-i18next';

interface RpaBatchActionsProps {
  selectedCount: number;
  onBatchRun: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
}

export function RpaBatchActions({
  selectedCount,
  onBatchRun,
  onBatchDelete,
  onClearSelection,
}: RpaBatchActionsProps) {
  const { t } = useTranslation('rpa');

  if (selectedCount === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground px-3 py-2 flex items-center gap-3 shadow-2xl border border-border z-[100] rounded-sm">
      <div className="flex items-center gap-2 pr-3 border-r border-border whitespace-nowrap">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">
          {t('batch.selected')}:
        </span>
        <span className="font-mono text-primary font-bold">
          {selectedCount.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="flex gap-1 flex-nowrap">
        <button
          onClick={onBatchRun}
          className="text-xs font-bold hover:text-primary hover:bg-accent flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-sm"
        >
          <i className="fa-solid fa-play text-[10px]"></i> {t('batch.run')}
        </button>
        <button
          onClick={onBatchDelete}
          className="text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-sm"
        >
          <i className="fa-solid fa-trash-can text-[10px]"></i> {t('batch.delete')}
        </button>
      </div>
      <button
        onClick={onClearSelection}
        className="ml-3 h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer rounded-sm"
      >
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
}
