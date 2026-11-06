import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Eraser, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { useEnvironmentDialogStore } from '../stores';

interface EnvironmentClearCacheConfirmDialogProps {
  onComplete?: () => void;
}

/**
 * 清除缓存确认对话框
 */
export function EnvironmentClearCacheConfirmDialog({
  onComplete,
}: EnvironmentClearCacheConfirmDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (!dialogStore.clearCacheEnvironment) return;

    setClearing(true);
    try {
      // TODO: 实现清除缓存的 API 调用
      // 目前只显示提示
      await new Promise((resolve) => setTimeout(resolve, 500)); // 模拟异步操作
      dialogStore.closeClearCacheDialog();
      toast.success(t('dialog.clearCache.success'));
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.clearCache.failed'));
    } finally {
      setClearing(false);
    }
  };

  if (!dialogStore.clearCacheEnvironment) return null;

  return (
    <FormattedDialog
      open={dialogStore.clearCacheDialogOpen && !!dialogStore.clearCacheEnvironment}
      onOpenChange={(open) => {
        dialogStore.setClearCacheDialogOpen(open);
        if (!open) {
          dialogStore.closeClearCacheDialog();
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: Eraser,
        iconColor: 'text-orange-500',
        title: t('dialog.clearCache.title'),
        description: dialogStore.clearCacheEnvironment
          ? t('dialog.clearCache.description', {
              name: dialogStore.clearCacheEnvironment.name,
            })
          : undefined,
        gradient: 'bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10',
        className: 'border-b border-orange-500/20',
      }}
      contentPadding="p-5"
    >
      {/* 环境信息卡片 */}
      {dialogStore.clearCacheEnvironment && (
        <div className="bg-muted/50 rounded-md p-3 border border-border/50">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {dialogStore.clearCacheEnvironment.name}
            </p>
            {dialogStore.clearCacheEnvironment.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {dialogStore.clearCacheEnvironment.description}
              </p>
            )}
          </div>
        </div>
      )}

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dialogStore.closeClearCacheDialog()}
          disabled={clearing}
        >
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.clearCache.cancel')}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleClear}
          disabled={clearing}
          className="bg-orange-500 text-white hover:bg-orange-600"
        >
          {clearing ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.clearCache.clearing')}
            </>
          ) : (
            <>
              <Eraser className="h-4 w-4 mr-1.5" />
              {t('dialog.clearCache.confirm')}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
