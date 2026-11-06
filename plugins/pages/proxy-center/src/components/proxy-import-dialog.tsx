import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ProxyImportDialogProps {
  open: boolean;
  importJson: string;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onImportJsonChange: (json: string) => void;
  onSubmit: () => void;
}

/**
 * 导入代理对话框组件
 */
export function ProxyImportDialog({
  open,
  importJson,
  submitting,
  onOpenChange,
  onImportJsonChange,
  onSubmit,
}: ProxyImportDialogProps) {
  const { t } = useTranslation('proxy');

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          onImportJsonChange('');
        }
      }}
    >
      <DialogContent className="sm:max-w-[600px] gap-0 p-3">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-sm font-semibold mb-0">
            {t('dialog.import.title')}
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground mt-0.5 mb-0">
            {t('dialog.import.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Alert className="px-3 py-2">
            <Info className="h-3 w-3" />
            <AlertTitle className="text-[10px]">{t('dialog.import.formatHint')}</AlertTitle>
          </Alert>
          <div className="space-y-1">
            <Label htmlFor="import-json" className="text-[10px] mb-0.5">
              {t('dialog.import.jsonLabel')}
            </Label>
            <textarea
              id="import-json"
              value={importJson}
              onChange={(e) => onImportJsonChange(e.target.value)}
              className="w-full h-48 px-2.5 py-2 text-xs font-mono bg-background border border-border rounded resize-none"
              placeholder={t('dialog.import.placeholder')}
            />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-[10px] px-3 py-1.5 h-7"
            onClick={() => onOpenChange(false)}
          >
            {t('dialog.import.cancel')}
          </Button>
          <Button
            size="sm"
            className="text-[10px] px-3 py-1.5 h-7"
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting ? t('dialog.import.submitting') : t('dialog.import.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
