import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Trash2, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { useEnvironmentDialogStore, useEnvironmentSelectionStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';

interface EnvironmentDeleteConfirmDialogProps {
  onComplete?: () => void;
}

/**
 * 删除环境确认对话框
 */
export function EnvironmentDeleteConfirmDialog({
  onComplete,
}: EnvironmentDeleteConfirmDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const selectionStore = useEnvironmentSelectionStore();
  const operations = useEnvironmentOperations(onComplete);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!dialogStore.deleteConfirmEnvironment) return;

    setDeleting(true);
    try {
      await operations.deleteEnvironment(dialogStore.deleteConfirmEnvironment.uuid);
      selectionStore.select(dialogStore.deleteConfirmEnvironment.uuid, false);
      dialogStore.closeDeleteConfirmDialog();
      toast.success('删除成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  if (!dialogStore.deleteConfirmEnvironment) return null;

  return (
    <FormattedDialog
      open={dialogStore.deleteConfirmDialogOpen && !!dialogStore.deleteConfirmEnvironment}
      onOpenChange={(open) => {
        dialogStore.setDeleteConfirmDialogOpen(open);
        if (!open) {
          dialogStore.closeDeleteConfirmDialog();
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: Trash2,
        iconColor: 'text-destructive',
        title: t('dialog.deleteConfirm.title'),
        description: dialogStore.deleteConfirmEnvironment
          ? t('dialog.deleteConfirm.description', {
              name: dialogStore.deleteConfirmEnvironment.name,
            })
          : undefined,
        gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
        className: 'border-b border-destructive/20',
      }}
      contentPadding="p-5"
    >
      {/* 环境信息卡片 */}
      {dialogStore.deleteConfirmEnvironment && (
        <div className="bg-muted/50 rounded-md p-3 border border-border/50">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {dialogStore.deleteConfirmEnvironment.name}
            </p>
            {dialogStore.deleteConfirmEnvironment.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {dialogStore.deleteConfirmEnvironment.description}
              </p>
            )}
          </div>
        </div>
      )}

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dialogStore.closeDeleteConfirmDialog()}
          disabled={deleting}
        >
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.deleteConfirm.cancel')}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
          {deleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.deleteConfirm.deleting')}
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t('dialog.deleteConfirm.confirm')}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
