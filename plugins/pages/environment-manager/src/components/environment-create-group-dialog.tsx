import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FolderTree, Loader2 } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import { useEnvironmentDialogStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';

interface EnvironmentCreateGroupDialogProps {
  onComplete?: () => void;
}

/**
 * 创建分组对话框组件
 */
export function EnvironmentCreateGroupDialog({ onComplete }: EnvironmentCreateGroupDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const operations = useEnvironmentOperations(onComplete);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!dialogStore.newGroupName.trim()) {
      toast.warning(t('dialog.createGroup.nameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await operations.createGroup(
        dialogStore.newGroupName.trim(),
        dialogStore.newGroupDescription.trim() || undefined
      );
      dialogStore.closeCreateGroupDialog();
      toast.success(t('dialog.createGroup.success'));
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.createGroup.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormattedDialog
      open={dialogStore.createGroupDialogOpen}
      onOpenChange={(open) => {
        dialogStore.setCreateGroupDialogOpen(open);
        if (!open) {
          dialogStore.closeCreateGroupDialog();
        }
      }}
      header={{
        icon: FolderTree,
        title: t('dialog.createGroup.title'),
        description: t('dialog.createGroup.description'),
      }}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.createGroup.nameLabel')} *
          </Label>
          <TextareaInput
            value={dialogStore.newGroupName}
            onChange={(e) => dialogStore.setNewGroupName(e.target.value)}
            className="text-sm min-h-9"
            placeholder={t('dialog.createGroup.namePlaceholder')}
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.createGroup.descriptionLabel')}
          </Label>
          <TextareaInput
            value={dialogStore.newGroupDescription}
            onChange={(e) => dialogStore.setNewGroupDescription(e.target.value)}
            className="text-sm min-h-20"
            placeholder={t('dialog.createGroup.descriptionPlaceholder')}
            disabled={submitting}
          />
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => dialogStore.closeCreateGroupDialog()}
          disabled={submitting}
        >
          {t('dialog.createGroup.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={submitting || !dialogStore.newGroupName.trim()}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.createGroup.creating')}
            </>
          ) : (
            t('dialog.createGroup.create')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
