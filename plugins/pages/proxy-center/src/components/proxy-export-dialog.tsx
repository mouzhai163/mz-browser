import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { Proxy } from '../types';
import { exportProxiesToCSV } from '../utils/import-export';

interface ProxyExportDialogProps {
  open: boolean;
  proxies: Proxy[];
  onOpenChange: (open: boolean) => void;
}

/**
 * 代理导出确认对话框
 */
export function ProxyExportDialog({ open, proxies, onOpenChange }: ProxyExportDialogProps) {
  const { t } = useTranslation('proxy');
  const [exporting, setExporting] = useState(false);
  const [exportPlainPassword, setExportPlainPassword] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const success = await exportProxiesToCSV(proxies, exportPlainPassword);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!exporting) {
          onOpenChange(isOpen);
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: Download,
        iconColor: 'text-primary',
        title: t('dialog.export.title'),
        description: t('dialog.export.description', { count: proxies.length }),
        gradient: 'bg-gradient-to-r from-primary/10 via-blue-500/10 to-primary/10',
        className: 'border-b border-primary/20',
      }}
      contentPadding="p-5"
    >
      {/* 导出信息卡片 */}
      <div className="bg-muted/50 rounded-md p-3 border border-border/50">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{t('dialog.export.fileFormat')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('dialog.export.fileFormatDesc')}
          </p>
        </div>
      </div>

      <FormattedDialogFooter>
        {/* 左侧：明文密码导出开关 */}
        <div className="flex items-center space-x-2 mr-auto">
          <Switch
            id="export-plain-password"
            checked={exportPlainPassword}
            onCheckedChange={setExportPlainPassword}
            disabled={exporting}
          />
          <Label
            htmlFor="export-plain-password"
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            导出明文密码
          </Label>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
          >
            <X className="h-4 w-4 mr-1.5" />
            {t('dialog.export.cancel')}
          </Button>
          <Button size="sm" onClick={handleExport} disabled={exporting || proxies.length === 0}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                {t('dialog.export.exporting')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1.5" />
                {t('dialog.export.confirm')}
              </>
            )}
          </Button>
        </div>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
