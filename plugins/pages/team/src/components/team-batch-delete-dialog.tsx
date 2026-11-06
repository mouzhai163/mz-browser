import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { useTeamDialogStore } from '../stores';

interface TeamBatchDeleteDialogProps {
  open: boolean;
  count: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * 批量删除成员确认对话框组件
 */
export const TeamBatchDeleteDialog: React.FC<TeamBatchDeleteDialogProps> = ({
  open,
  count,
  onOpenChange,
  onConfirm,
}) => {
  const { t } = useTranslation('team');
  const dialogStore = useTeamDialogStore();
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <FormattedDialog
      open={open && count > 0}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          dialogStore.closeBatchDeleteDialog();
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: Trash2,
        iconColor: 'text-destructive',
        title: t('dialog.batchDelete.title'),
        description: t('dialog.batchDelete.description', { count }),
        gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
        className: 'border-b border-destructive/20',
      }}
      contentPadding="p-5"
    >
      <div className="bg-muted/50 rounded-md p-3 border border-border/50">
        <p className="text-sm font-medium text-foreground">
          {t('dialog.batchDelete.warningDescription')}
        </p>
      </div>

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={deleting}>
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.batchDelete.cancel')}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={deleting}>
          {deleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.batchDelete.deleting')}
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t('dialog.batchDelete.confirm')}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
};
