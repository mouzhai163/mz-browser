import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEnvironmentDialogStore } from '../stores';
import { importEnvironments } from '../api';

interface EnvironmentImportDialogProps {
  onComplete?: () => void;
}

/**
 * 导入环境对话框组件
 */
export function EnvironmentImportDialog({ onComplete }: EnvironmentImportDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!dialogStore.importJson.trim()) {
      toast.warning(t('dialog.import.emptyJson'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await importEnvironments({
        import_data: dialogStore.importJson,
      });
      dialogStore.closeImportDialog();
      toast.success(
        t('dialog.import.success', { count: result.length }) || `成功导入 ${result.length} 个环境`
      );
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.import.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={dialogStore.importDialogOpen} onOpenChange={dialogStore.setImportDialogOpen}>
      <DialogContent className="min-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('dialog.import.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 mb-4">
          <label className="text-xs mb-1 block">{t('dialog.import.jsonLabel')}</label>
          <textarea
            value={dialogStore.importJson}
            onChange={(e) => dialogStore.setImportJson(e.target.value)}
            className="w-full h-64 px-3 py-2 text-xs font-mono bg-background border border-border rounded"
            placeholder={t('dialog.import.jsonPlaceholder')}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => dialogStore.closeImportDialog()}>
            {t('dialog.import.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('dialog.import.submitting') : t('dialog.import.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
