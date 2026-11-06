import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Trash2, X, AlertTriangle } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { useEnvironmentDialogStore, useEnvironmentSelectionStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';

interface EnvironmentPermanentDeleteConfirmDialogProps {
  onComplete?: () => void;
}

/**
 * 永久删除环境确认对话框
 */
export function EnvironmentPermanentDeleteConfirmDialog({
  onComplete,
}: EnvironmentPermanentDeleteConfirmDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const selectionStore = useEnvironmentSelectionStore();
  const operations = useEnvironmentOperations(onComplete);
  const [deleting, setDeleting] = useState(false);

  const handlePermanentDelete = async () => {
    if (!dialogStore.permanentDeleteConfirmEnvironment) return;

    setDeleting(true);
    try {
      await operations.permanentDeleteEnvironment(dialogStore.permanentDeleteConfirmEnvironment.uuid);
      selectionStore.select(dialogStore.permanentDeleteConfirmEnvironment.uuid, false);
      dialogStore.closePermanentDeleteConfirmDialog();
      toast.success('永久删除成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '永久删除失败');
    } finally {
      setDeleting(false);
    }
  };

  if (!dialogStore.permanentDeleteConfirmEnvironment) return null;

  return (
    <FormattedDialog
      open={dialogStore.permanentDeleteConfirmDialogOpen && !!dialogStore.permanentDeleteConfirmEnvironment}
      onOpenChange={(open) => {
        dialogStore.setPermanentDeleteConfirmDialogOpen(open);
        if (!open) {
          dialogStore.closePermanentDeleteConfirmDialog();
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: Trash2,
        iconColor: 'text-destructive',
        title: '永久删除环境',
        description: dialogStore.permanentDeleteConfirmEnvironment
          ? `确定要永久删除环境 "${dialogStore.permanentDeleteConfirmEnvironment.name}" 吗？`
          : undefined,
        gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
        className: 'border-b border-destructive/20',
      }}
      contentPadding="p-5"
    >
      {/* 警告提示 */}
      <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-destructive">警告：此操作不可恢复</p>
            <p className="text-xs text-destructive/80 mt-1">
              永久删除后，该环境的所有数据将被彻底清除，无法恢复。
            </p>
          </div>
        </div>
      </div>

      {/* 环境信息卡片 */}
      {dialogStore.permanentDeleteConfirmEnvironment && (
        <div className="bg-muted/50 rounded-md p-3 border border-border/50">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {dialogStore.permanentDeleteConfirmEnvironment.name}
            </p>
            {dialogStore.permanentDeleteConfirmEnvironment.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {dialogStore.permanentDeleteConfirmEnvironment.description}
              </p>
            )}
          </div>
        </div>
      )}

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dialogStore.closePermanentDeleteConfirmDialog()}
          disabled={deleting}
        >
          <X className="h-4 w-4 mr-1.5" />
          取消
        </Button>
        <Button variant="destructive" size="sm" onClick={handlePermanentDelete} disabled={deleting}>
          {deleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              删除中...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-1.5" />
              确认永久删除
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
