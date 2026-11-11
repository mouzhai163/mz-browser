import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, Loader2, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Environment } from '../types';
import { exportEnvironmentsToCSV } from '../utils/export';
import { exportEnvironmentBundle } from '../utils/environment-transfer';

interface EnvironmentExportDialogProps {
  open: boolean;
  environments: Environment[];
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = 'backup' | 'csv';

/**
 * 环境导出：完整备份（可以再导入）或表格（只能查看）
 */
export function EnvironmentExportDialog({
  open,
  environments,
  onOpenChange,
}: EnvironmentExportDialogProps) {
  const { t } = useTranslation('environment');
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('backup');
  const [includeSecrets, setIncludeSecrets] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (format === 'csv') {
        if (await exportEnvironmentsToCSV(environments)) onOpenChange(false);
        return;
      }
      if (await exportEnvironmentBundle(environments.map((environment) => environment.uuid), includeSecrets)) {
        toast.success(t('dialog.export.success', { count: environments.length }));
        onOpenChange(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const option = (value: ExportFormat, title: string, description: string) => (
    <button
      type="button"
      onClick={() => setFormat(value)}
      className={cn(
        'w-full rounded-md border p-3 text-left transition-colors',
        format === value ? 'border-primary bg-primary/5' : 'border-border/50 bg-muted/50 hover:border-primary/50'
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </button>
  );

  return (
    <FormattedDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!exporting) {
          onOpenChange(isOpen);
        }
      }}
      minWidth="min-w-[460px]"
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
      <div className="space-y-2">
        {option('backup', t('dialog.export.backup'), t('dialog.export.backupDesc'))}
        {format === 'backup' ? (
          <label className="flex cursor-pointer items-start gap-2 px-1 py-1 text-xs">
            <Checkbox
              className="mt-0.5"
              checked={includeSecrets}
              onCheckedChange={(checked) => setIncludeSecrets(checked === true)}
            />
            <span>
              <span className="text-foreground">{t('dialog.export.includeSecrets')}</span>
              {includeSecrets ? (
                <span className="mt-0.5 block text-destructive">{t('dialog.export.includeSecretsWarning')}</span>
              ) : null}
            </span>
          </label>
        ) : null}
        {option('csv', t('dialog.export.fileFormat'), t('dialog.export.fileFormatDesc'))}
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
