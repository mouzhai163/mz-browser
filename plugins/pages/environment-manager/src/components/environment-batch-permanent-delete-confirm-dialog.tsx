import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2, X, AlertTriangle } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { useEnvironmentDialogStore, useEnvironmentSelectionStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';

interface EnvironmentBatchPermanentDeleteConfirmDialogProps {
  onComplete?: () => void;
}

/**
 * 批量永久删除环境确认对话框
 */
export function EnvironmentBatchPermanentDeleteConfirmDialog({
  onComplete,
}: EnvironmentBatchPermanentDeleteConfirmDialogProps) {
  const dialogStore = useEnvironmentDialogStore();
  const selectionStore = useEnvironmentSelectionStore();
  const operations = useEnvironmentOperations(onComplete);
  const [deleting, setDeleting] = useState(false);

  const handleBatchPermanentDelete = async () => {
    const selectedIds = Array.from(selectionStore.selectedIds);
    if (selectedIds.length === 0) return;

    setDeleting(true);
    try {
      await operations.batchPermanentDelete(selectedIds);
      selectionStore.clearSelection();
      dialogStore.closeBatchPermanentDeleteConfirmDialog();
      toast.success(`已永久删除 ${selectedIds.length} 个环境`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量永久删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <FormattedDialog
      open={dialogStore.batchPermanentDeleteConfirmDialogOpen}
      onOpenChange={(open) => {
        dialogStore.setBatchPermanentDeleteConfirmDialogOpen(open);
        if (!open) {
          dialogStore.closeBatchPermanentDeleteConfirmDialog();
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: Trash2,
        iconColor: 'text-destructive',
        title: '批量永久删除环境',
        description: `确定要永久删除选中的 ${dialogStore.batchPermanentDeleteCount} 个环境吗？`,
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
              永久删除后，这些环境的所有数据将被彻底清除，无法恢复。
            </p>
          </div>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="bg-muted/50 rounded-md p-3 border border-border/50">
        <p className="text-xs text-muted-foreground">
          即将永久删除 <span className="font-semibold text-foreground">{dialogStore.batchPermanentDeleteCount}</span> 个环境
        </p>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dialogStore.closeBatchPermanentDeleteConfirmDialog()}
          disabled={deleting}
        >
          <X className="h-4 w-4 mr-1.5" />
          取消
        </Button>
        <Button variant="destructive" size="sm" onClick={handleBatchPermanentDelete} disabled={deleting}>
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
