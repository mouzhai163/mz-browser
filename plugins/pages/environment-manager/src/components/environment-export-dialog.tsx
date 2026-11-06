import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import type { Environment } from '../types';
import { exportEnvironmentsToCSV } from '../utils/export';

interface EnvironmentExportDialogProps {
  open: boolean;
  environments: Environment[];
  onOpenChange: (open: boolean) => void;
}

/**
 * 环境导出确认对话框
 */
export function EnvironmentExportDialog({
  open,
  environments,
  onOpenChange,
}: EnvironmentExportDialogProps) {
  const { t } = useTranslation('environment');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const success = await exportEnvironmentsToCSV(environments);
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
        description: t('dialog.export.description', { count: environments.length }),
        gradient: 'bg-gradient-to-r from-primary/10 via-blue-500/10 to-primary/10',
        className: 'border-b border-primary/20',
      }}
      contentPadding="p-5"
    >
      {/* 导出信息卡片 */}
      <div className="bg-muted/50 rounded-md p-3 border border-border/50">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{t('dialog.export.fileFormat')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('dialog.export.fileFormatDesc')}
          </p>
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={exporting}
        >
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.export.cancel')}
        </Button>
        <Button size="sm" onClick={handleExport} disabled={exporting || environments.length === 0}>
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.export.exporting')}
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-1.5" />
              {t('dialog.export.confirm')}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
