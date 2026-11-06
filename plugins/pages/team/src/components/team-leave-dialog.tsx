import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, LogOut, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';

interface TeamLeaveDialogProps {
  open: boolean;
  teamName: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

/**
 * 退出团队确认对话框组件
 */
export const TeamLeaveDialog: React.FC<TeamLeaveDialogProps> = ({
  open,
  teamName,
  onOpenChange,
  onConfirm,
}) => {
  const { t } = useTranslation('team');
  const [leaving, setLeaving] = useState(false);

  const handleConfirm = async () => {
    setLeaving(true);
    try {
      await onConfirm();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <FormattedDialog
      open={open && !!teamName}
      onOpenChange={onOpenChange}
      minWidth="min-w-[440px]"
      header={{
        icon: LogOut,
        iconColor: 'text-destructive',
        title: t('dialog.leave.title'),
        description: teamName ? t('dialog.leave.description', { teamName }) : undefined,
        gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
        className: 'border-b border-destructive/20',
      }}
      contentPadding="p-5"
    >
      {teamName && (
        <div className="bg-muted/50 rounded-md p-3 border border-border/50">
          <p className="text-sm font-medium text-foreground">{teamName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('dialog.leave.warningDescription')}
          </p>
        </div>
      )}

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={leaving}>
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.leave.cancel')}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={leaving}>
          {leaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.leave.leaving')}
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4 mr-1.5" />
              {t('dialog.leave.confirm')}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
};
