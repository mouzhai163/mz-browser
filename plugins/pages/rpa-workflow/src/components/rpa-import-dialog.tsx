import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, FileJson, Upload, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import type { PortableRpaTaskSummary } from '../lib/rpa-transfer';

interface RpaImportDialogProps {
  open: boolean;
  summary: PortableRpaTaskSummary | null;
  onOpenChange: (open: boolean) => void;
  onPreview: () => void;
}

export function RpaImportDialog({ open, summary, onOpenChange, onPreview }: RpaImportDialogProps) {
  const { t } = useTranslation('rpa');
  const [previewing, setPreviewing] = useState(false);
  const [confirmedFor, setConfirmedFor] = useState<PortableRpaTaskSummary | null>(null);
  const needsConfirm = (summary?.localScriptCount ?? 0) > 0;
  const confirmed = !needsConfirm || confirmedFor === summary;

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      onPreview();
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!previewing) {
          onOpenChange(isOpen);
        }
      }}
      minWidth="min-w-[460px]"
      header={{
        icon: Upload,
        iconColor: 'text-primary',
        title: t('dialog.import.title'),
        description: t('dialog.import.description'),
        gradient: 'bg-gradient-to-r from-primary/10 via-blue-500/10 to-primary/10',
        className: 'border-b border-primary/20',
      }}
      contentPadding="p-5"
    >
      <div className="rounded-md border border-border/50 bg-muted/50 p-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-primary/20 bg-primary/10 p-2 text-primary">
            <FileJson className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('dialog.import.taskName')}</span>
              <span className="font-medium text-foreground">{summary?.name || '-'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('dialog.import.triggerType')}</span>
              <span className="font-medium text-foreground">{summary?.triggerType || '-'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('dialog.import.environmentCount')}</span>
              <span className="font-medium text-foreground">{summary?.environmentCount ?? 0}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('dialog.import.stepCount')}</span>
              <span className="font-medium text-foreground">{summary?.stepCount ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {needsConfirm ? (
        <div className="mt-3 space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <p>{t('dialog.import.localScriptWarning', { count: summary?.localScriptCount ?? 0 })}</p>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmedFor(event.target.checked ? summary : null)}
            />
            <span>{t('dialog.import.localScriptConfirm')}</span>
          </label>
        </div>
      ) : null}

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={previewing}>
          <X className="mr-1.5 h-4 w-4" />
          {t('dialog.import.cancel')}
        </Button>
        <Button size="sm" onClick={handlePreview} disabled={!summary || previewing || !confirmed}>
          <Eye className="mr-1.5 h-4 w-4" />
          {t('dialog.import.preview')}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
