import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { useTeamDialogStore } from '../stores';

interface TeamDeleteDialogProps {
  open: boolean;
  memberName: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * 删除成员确认对话框组件
 */
export const TeamDeleteDialog: React.FC<TeamDeleteDialogProps> = ({
  open,
  memberName,
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
      open={open && !!memberName}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          dialogStore.closeDeleteDialog();
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: Trash2,
        iconColor: 'text-destructive',
        title: t('dialog.delete.title'),
        description: memberName ? t('dialog.delete.description', { name: memberName }) : undefined,
        gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
        className: 'border-b border-destructive/20',
      }}
      contentPadding="p-5"
    >
      {memberName && (
        <div className="bg-muted/50 rounded-md p-3 border border-border/50">
          <p className="text-sm font-medium text-foreground">{memberName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('dialog.delete.warningDescription')}
          </p>
        </div>
      )}

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={deleting}>
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.delete.cancel')}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={deleting}>
          {deleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.delete.deleting')}
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
};
