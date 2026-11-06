import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Trash2, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { useEnvironmentDialogStore, useEnvironmentSelectionStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';

interface EnvironmentBatchDeleteConfirmDialogProps {
  onComplete?: () => void;
}

/**
 * 批量删除环境确认对话框
 */
export function EnvironmentBatchDeleteConfirmDialog({
  onComplete,
}: EnvironmentBatchDeleteConfirmDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const selectionStore = useEnvironmentSelectionStore();
  const operations = useEnvironmentOperations(onComplete);
  const [deleting, setDeleting] = useState(false);

  const handleBatchDelete = async () => {
    const selectedIds = Array.from(selectionStore.selectedIds);
    if (selectedIds.length === 0) return;

    setDeleting(true);
    try {
      await operations.batchDelete(selectedIds);
      selectionStore.clearSelection();
      dialogStore.closeBatchDeleteConfirmDialog();
      toast.success(`已删除 ${selectedIds.length} 个环境`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <FormattedDialog
      open={dialogStore.batchDeleteConfirmDialogOpen}
      onOpenChange={(open) => {
        dialogStore.setBatchDeleteConfirmDialogOpen(open);
        if (!open) {
          dialogStore.closeBatchDeleteConfirmDialog();
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: Trash2,
        iconColor: 'text-destructive',
        title: '批量删除环境',
        description: `确定要删除选中的 ${dialogStore.batchDeleteCount} 个环境吗？`,
        gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
        className: 'border-b border-destructive/20',
      }}
      contentPadding="p-5"
    >
      {/* 提示信息 */}
      <div className="bg-muted/50 rounded-md p-3 border border-border/50">
        <p className="text-xs text-muted-foreground">
          删除后的环境将移至回收站，可在回收站中恢复或永久删除。
        </p>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dialogStore.closeBatchDeleteConfirmDialog()}
          disabled={deleting}
        >
          <X className="h-4 w-4 mr-1.5" />
          取消
        </Button>
        <Button variant="destructive" size="sm" onClick={handleBatchDelete} disabled={deleting}>
          {deleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              删除中...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-1.5" />
              确认删除
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
