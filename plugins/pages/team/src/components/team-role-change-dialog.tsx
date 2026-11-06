import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Shield, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { useTeamDialogStore } from '../stores';
import type { TeamMember } from '../types';

interface TeamRoleChangeDialogProps {
  open: boolean;
  member: TeamMember | null;
  newRole: TeamMember['role'];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * 角色变更确认对话框组件
 */
export const TeamRoleChangeDialog: React.FC<TeamRoleChangeDialogProps> = ({
  open,
  member,
  newRole,
  submitting,
  onOpenChange,
  onConfirm,
}) => {
  const { t } = useTranslation('team');
  const dialogStore = useTeamDialogStore();

  return (
    <FormattedDialog
      open={open && !!member}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          dialogStore.closeRoleChangeDialog();
        }
      }}
      header={{
        icon: Shield,
        title: t('dialog.roleChange.title'),
        description:
          member &&
          t('dialog.roleChange.description', { name: member.name, role: t(`role.${newRole}`) }),
        gradient: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
      }}
      contentPadding="p-5"
    >
      {member && (
        <div className="bg-muted/50 rounded-md p-3 border border-border/50">
          <p className="text-sm font-medium text-foreground">{t('dialog.roleChange.infoTitle')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {newRole === 'admin' && t('dialog.roleChange.adminDescription')}
            {newRole === 'editor' && t('dialog.roleChange.editorDescription')}
            {newRole === 'viewer' && t('dialog.roleChange.viewerDescription')}
          </p>
        </div>
      )}

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.roleChange.cancel')}
        </Button>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={onConfirm}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.roleChange.submitting')}
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-1.5" />
              {t('dialog.roleChange.confirm')}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
};
