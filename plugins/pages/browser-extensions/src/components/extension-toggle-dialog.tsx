import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Ban, Play, X, Loader2, Star } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import type { ExtensionItem } from '../types';
import { ExtensionIcon } from './extension-icon';

interface ExtensionToggleDialogProps {
  open: boolean;
  extension: ExtensionItem | null;
  action: 'disable' | 'enable';
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

/**
 * 扩展禁用/启用对话框组件
 */
export function ExtensionToggleDialog({
  open,
  extension,
  action,
  onOpenChange,
  onConfirm,
}: ExtensionToggleDialogProps) {
  const { t } = useTranslation('extensions');
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!extension) return;
    setProcessing(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t(`dialog.toggle.${action}Failed`));
    } finally {
      setProcessing(false);
    }
  };

  if (!extension) return null;

  const isDisable = action === 'disable';

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      minWidth="min-w-[440px]"
      header={{
        icon: isDisable ? Ban : Play,
        iconColor: isDisable ? 'text-gray-500' : 'text-emerald-500',
        title: t(`dialog.toggle.${action}Title`),
        description: t(`dialog.toggle.${action}Description`, { name: extension.name }),
        gradient: isDisable
          ? 'bg-gradient-to-r from-gray-500/10 via-gray-400/10 to-gray-500/10'
          : 'bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-emerald-500/10',
        className: isDisable ? 'border-b border-gray-500/20' : 'border-b border-emerald-500/20',
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

        {/* 提示信息 */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 border border-border/50">
          {t(`dialog.toggle.${action}Hint`)}
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={processing}
        >
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.toggle.cancel')}
        </Button>
        <Button
          variant={isDisable ? 'secondary' : 'default'}
          size="sm"
          onClick={handleConfirm}
          disabled={processing}
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t(`dialog.toggle.${action}Processing`)}
            </>
          ) : (
            <>
              {isDisable ? <Ban className="h-4 w-4 mr-1.5" /> : <Play className="h-4 w-4 mr-1.5" />}
              {t(`dialog.toggle.${action}Confirm`)}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
