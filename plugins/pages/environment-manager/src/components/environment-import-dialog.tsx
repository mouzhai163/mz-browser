import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { importEnvironments } from '../api';
import type { EnvironmentBundle } from '../utils/environment-transfer';

interface EnvironmentImportDialogProps {
  bundle: EnvironmentBundle | null;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const PREVIEW_COUNT = 5;

/** 确认导入一个环境备份文件 */
export function EnvironmentImportDialog({ bundle, onOpenChange, onComplete }: EnvironmentImportDialogProps) {
  const { t } = useTranslation('environment');
  const [importing, setImporting] = useState(false);
  const environments = bundle?.environments ?? [];

  const handleImport = async () => {
    if (!bundle) return;
    setImporting(true);
    try {
      const imported = await importEnvironments({ bundle });
      const renewed = imported.filter((item) => !item.kept_identity).length;
      toast.success(t('dialog.import.success', { count: imported.length }));
      if (renewed > 0) toast.warning(t('dialog.import.newIdentities', { count: renewed }));
      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('dialog.import.failed'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <FormattedDialog
      open={!!bundle}
      onOpenChange={(open) => {
        if (!importing) onOpenChange(open);
      }}
      minWidth="min-w-[460px]"
      header={{
        icon: Upload,
        iconColor: 'text-primary',
        title: t('dialog.import.title'),
        description: t('dialog.import.description', { count: environments.length }),
        gradient: 'bg-gradient-to-r from-primary/10 via-blue-500/10 to-primary/10',
        className: 'border-b border-primary/20',
      }}
      contentPadding="p-5"
    >
      <div className="space-y-3 text-xs">
        <ul className="space-y-1 rounded-md border border-border/50 bg-muted/50 p-3">
          {environments.slice(0, PREVIEW_COUNT).map((environment) => (
            <li key={environment.source_uuid} className="truncate text-foreground">
              {environment.name}
            </li>
          ))}
          {environments.length > PREVIEW_COUNT ? (
            <li className="text-muted-foreground">
              {t('dialog.import.more', { count: environments.length - PREVIEW_COUNT })}
            </li>
          ) : null}
        </ul>
        <p className="text-muted-foreground">
          {bundle?.includes_secrets ? t('dialog.import.withSecrets') : t('dialog.import.withoutSecrets')}
        </p>
        <p className="text-muted-foreground">{t('dialog.import.identityNote')}</p>
      </div>

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={importing}>
          <X className="mr-1.5 h-4 w-4" />
          {t('dialog.import.cancel')}
        </Button>
        <Button size="sm" onClick={handleImport} disabled={importing || environments.length === 0}>
          {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
          {importing ? t('dialog.import.submitting') : t('dialog.import.submit')}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
