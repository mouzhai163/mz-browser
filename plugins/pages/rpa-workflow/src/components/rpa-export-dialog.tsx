import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileJson, Loader2, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';

interface RpaExportDialogProps {
  open: boolean;
  task: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
}

export function RpaExportDialog({ open, task, onOpenChange, onConfirm }: RpaExportDialogProps) {
  const { t } = useTranslation('rpa');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const success = await onConfirm();
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!exporting) {
          onOpenChange(isOpen);
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: Download,
        iconColor: 'text-primary',
        title: t('dialog.export.title'),
        description: t('dialog.export.description', {
          name: task?.name || '-',
        }),
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
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {t('dialog.export.fileFormat')}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('dialog.export.fileFormatDesc')}
            </p>
          </div>
        </div>
      </div>

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={exporting}>
          <X className="mr-1.5 h-4 w-4" />
          {t('dialog.export.cancel')}
        </Button>
        <Button size="sm" onClick={handleExport} disabled={exporting || !task}>
          {exporting ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              {t('dialog.export.exporting')}
            </>
          ) : (
            <>
              <Download className="mr-1.5 h-4 w-4" />
              {t('dialog.export.confirm')}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
