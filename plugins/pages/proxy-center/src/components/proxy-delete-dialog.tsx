import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2, X, Network } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import type { Proxy } from '../types';

interface ProxyDeleteDialogProps {
  open: boolean;
  proxy: Proxy | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * 删除代理对话框组件
 */
export function ProxyDeleteDialog({
  open,
  proxy,
  onOpenChange,
  onConfirm,
}: ProxyDeleteDialogProps) {
  const { t } = useTranslation('proxy');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!proxy) return;

    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  if (!proxy) return null;

  return (
    <FormattedDialog
      open={open}
      onOpenChange={(open) => {
        if (!deleting) {
          onOpenChange(open);
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: Trash2,
        iconColor: 'text-destructive',
        title: t('dialog.delete.title'),
        description: t('dialog.delete.description', { name: proxy.name }),
        gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
        className: 'border-b border-destructive/20',
      }}
      contentPadding="p-5"
    >
      {/* 代理信息卡片 */}
      <div className="bg-muted/50 rounded-md p-3 border border-border/50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-md flex items-center justify-center bg-muted text-muted-foreground shrink-0">
            <Network className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{proxy.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {proxy.type.toUpperCase()} · {proxy.host}:{proxy.port}
            </p>
            {proxy.environmentsCount > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {t('dialog.delete.linkedEnvironments', {
                  count: proxy.environmentsCount,
                  defaultValue: `已关联 ${proxy.environmentsCount} 个环境`,
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={deleting}>
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.delete.cancel')}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
          {deleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.delete.deleting', { defaultValue: '删除中...' })}
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t('dialog.delete.confirm')}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
