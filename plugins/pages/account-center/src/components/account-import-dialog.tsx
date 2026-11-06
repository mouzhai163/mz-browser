import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface AccountImportDialogProps {
  open: boolean;
  importJson: string;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onImportJsonChange: (json: string) => void;
  onSubmit: () => void;
}

export function AccountImportDialog({
  open,
  importJson,
  submitting,
  onOpenChange,
  onImportJsonChange,
  onSubmit,
}: AccountImportDialogProps) {
  const { t } = useTranslation('account');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('dialog.import.title')}</DialogTitle>
          <DialogDescription>{t('dialog.import.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Textarea
            placeholder={t('dialog.import.placeholder')}
            value={importJson}
            onChange={(e) => onImportJsonChange(e.target.value)}
            className="min-h-[200px] font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">{t('dialog.import.formatHint')}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('dialog.import.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !importJson.trim()}>
            {submitting ? t('dialog.import.submitting') : t('dialog.import.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
