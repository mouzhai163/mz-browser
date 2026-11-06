import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, RotateCcw, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { useEnvironmentDialogStore, useEnvironmentSelectionStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';

interface EnvironmentRestoreConfirmDialogProps {
  onComplete?: () => void;
}

/**
 * 恢复环境确认对话框
 */
export function EnvironmentRestoreConfirmDialog({
  onComplete,
}: EnvironmentRestoreConfirmDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const selectionStore = useEnvironmentSelectionStore();
  const operations = useEnvironmentOperations(onComplete);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    if (!dialogStore.restoreConfirmEnvironment) return;

    setRestoring(true);
    try {
      await operations.restoreEnvironment(dialogStore.restoreConfirmEnvironment.uuid);
      selectionStore.select(dialogStore.restoreConfirmEnvironment.uuid, false);
      dialogStore.closeRestoreConfirmDialog();
      toast.success('恢复成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '恢复失败');
    } finally {
      setRestoring(false);
    }
  };

  if (!dialogStore.restoreConfirmEnvironment) return null;

  return (
    <FormattedDialog
      open={dialogStore.restoreConfirmDialogOpen && !!dialogStore.restoreConfirmEnvironment}
      onOpenChange={(open) => {
        dialogStore.setRestoreConfirmDialogOpen(open);
        if (!open) {
          dialogStore.closeRestoreConfirmDialog();
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: RotateCcw,
        iconColor: 'text-primary',
        title: '恢复环境',
        description: dialogStore.restoreConfirmEnvironment
          ? `确定要恢复环境 "${dialogStore.restoreConfirmEnvironment.name}" 吗？`
          : undefined,
        gradient: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
        className: 'border-b border-primary/20',
      }}
      contentPadding="p-5"
    >
      {/* 环境信息卡片 */}
      {dialogStore.restoreConfirmEnvironment && (
        <div className="bg-muted/50 rounded-md p-3 border border-border/50">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {dialogStore.restoreConfirmEnvironment.name}
            </p>
            {dialogStore.restoreConfirmEnvironment.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {dialogStore.restoreConfirmEnvironment.description}
              </p>
            )}
          </div>
        </div>
      )}

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dialogStore.closeRestoreConfirmDialog()}
          disabled={restoring}
        >
          <X className="h-4 w-4 mr-1.5" />
          取消
        </Button>
        <Button variant="default" size="sm" onClick={handleRestore} disabled={restoring}>
          {restoring ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              恢复中...
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              确认恢复
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
