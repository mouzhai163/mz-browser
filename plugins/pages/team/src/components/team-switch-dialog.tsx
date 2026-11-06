import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTeamDialogStore } from '../stores';
import type { Team } from '../types';

interface TeamSwitchDialogProps {
  open: boolean;
  currentTeam: Team;
  availableTeams: Team[];
  selectedTeamId: string;
  onOpenChange: (open: boolean) => void;
  onTeamChange: (teamId: string) => void;
  onSubmit: () => void;
}

/**
 * 切换团队对话框组件
 */
export const TeamSwitchDialog: React.FC<TeamSwitchDialogProps> = ({
  open,
  currentTeam,
  availableTeams,
  selectedTeamId,
  onOpenChange,
  onTeamChange,
  onSubmit,
}) => {
  const { t } = useTranslation('team');
  const dialogStore = useTeamDialogStore();
  const [switching, setSwitching] = useState(false);

  const handleSubmit = async () => {
    if (!selectedTeamId) return;
    setSwitching(true);
    try {
      await onSubmit();
    } finally {
      setSwitching(false);
    }
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          dialogStore.closeSwitchTeamDialog();
        }
      }}
      header={{
        icon: RefreshCw,
        title: t('dialog.switchTeam.title'),
        description: t('dialog.switchTeam.description'),
      }}
    >
      <div className="space-y-4">
        <Alert className="border-primary/50 bg-primary/10">
          <AlertTitle className="text-xs text-primary">
            {t('dialog.switchTeam.currentTeam')}
          </AlertTitle>
          <AlertDescription className="text-xs text-primary/90 font-medium mt-1">
            {currentTeam.name}
          </AlertDescription>
        </Alert>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.switchTeam.selectTeam')}
          </Label>
          <Select
            value={selectedTeamId || undefined}
            onValueChange={onTeamChange}
            disabled={switching}
          >
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue placeholder={t('dialog.switchTeam.selectTeamPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {availableTeams
                .filter((team) => team.id !== currentTeam.id)
                .map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onOpenChange(false)}
          disabled={switching}
        >
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.switchTeam.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={!selectedTeamId || switching}
        >
          {switching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.switchTeam.switching')}
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {t('dialog.switchTeam.submit')}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
};
