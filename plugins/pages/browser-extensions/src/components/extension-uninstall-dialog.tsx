import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Trash2, X, Loader2, Star } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import type { ExtensionItem } from '../types';
import { ExtensionIcon } from './extension-icon';

interface ExtensionUninstallDialogProps {
  open: boolean;
  extension: ExtensionItem | null;
  action?: 'uninstall' | 'remove';
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

/**
 * 扩展卸载对话框组件
 */
export function ExtensionUninstallDialog({
  open,
  extension,
  action = 'uninstall',
  onOpenChange,
  onConfirm,
}: ExtensionUninstallDialogProps) {
  const { t } = useTranslation('extensions');
  const [uninstalling, setUninstalling] = useState(false);
  const isRemove = action === 'remove';
  const title = isRemove ? t('dialog.remove.title') : t('dialog.uninstall.title');
  const description = isRemove
    ? t('dialog.remove.description', { name: extension?.name })
    : t('dialog.uninstall.description', { name: extension?.name });
  const processingText = isRemove
    ? t('dialog.remove.removing')
    : t('dialog.uninstall.uninstalling');
  const confirmText = isRemove ? t('dialog.remove.confirm') : t('dialog.uninstall.confirm');
  const failedText = isRemove ? t('dialog.remove.failed') : t('dialog.uninstall.failed');

  const handleUninstall = async () => {
    if (!extension) return;
    setUninstalling(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : failedText);
    } finally {
      setUninstalling(false);
    }
  };

  if (!extension) return null;

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      minWidth="min-w-[440px]"
      header={{
        icon: Trash2,
        iconColor: 'text-destructive',
        title,
        description,
        gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
        className: 'border-b border-destructive/20',
      }}
      contentPadding="p-5"
    >
      <div className="space-y-3">
        {/* 扩展信息卡片 */}
        <div className="bg-muted/50 rounded-md p-4 border border-border/50">
          <div className="flex items-start gap-3">
            <ExtensionIcon
              icon={extension.icon}
              source={extension.source}
              containerClassName="h-12 w-12 rounded-lg border border-border bg-background"
              imageClassName="rounded-lg"
              textClassName="text-xl"
              fallbackClassName="h-6 w-6"
            />

            {/* 信息 */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{extension.name}</h3>
              {extension.author && (
                <p className="text-xs text-muted-foreground mt-0.5">{extension.author}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-muted-foreground">v{extension.version}</span>
                {extension.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    <span className="text-xs text-muted-foreground">
                      {extension.rating.toFixed(1)}
                    </span>
                  </div>
                )}
                {extension.downloads && (
                  <span className="text-xs text-muted-foreground">
                    {extension.downloads.toLocaleString()} {t('dialog.detail.downloads')}
                  </span>
                )}
              </div>
              {extension.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {extension.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={uninstalling}
        >
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.uninstall.cancel')}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleUninstall} disabled={uninstalling}>
          {uninstalling ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {processingText}
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-1.5" />
              {confirmText}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
