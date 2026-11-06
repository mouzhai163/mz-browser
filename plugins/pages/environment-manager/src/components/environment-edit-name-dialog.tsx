import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Edit } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import { useEnvironmentDialogStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';

interface EnvironmentEditNameDialogProps {
  onComplete?: () => void;
}

/**
 * 编辑环境名称对话框
 */
export function EnvironmentEditNameDialog({ onComplete }: EnvironmentEditNameDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const operations = useEnvironmentOperations(onComplete);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dialogStore.editNameEnvironment) {
      setName(dialogStore.editNameEnvironment.name);
    }
  }, [dialogStore.editNameEnvironment]);

  const handleSave = async () => {
    if (!dialogStore.editNameEnvironment || !name.trim()) return;

    setSaving(true);
    try {
      await operations.updateEnvironment(dialogStore.editNameEnvironment.uuid, {
        name: name.trim(),
      });
      dialogStore.closeEditNameDialog();
      toast.success(t('dialog.editName.success'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.editName.failed'));
    } finally {
      setSaving(false);
    }
  };

  if (!dialogStore.editNameEnvironment) return null;

  return (
    <FormattedDialog
      open={dialogStore.editNameDialogOpen && !!dialogStore.editNameEnvironment}
      onOpenChange={(open) => {
        dialogStore.setEditNameDialogOpen(open);
        if (!open) {
          dialogStore.closeEditNameDialog();
        }
      }}
      header={{
        icon: Edit,
        title: t('dialog.editName.title'),
        description: t('dialog.editName.description'),
      }}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.editName.nameLabel')} *
          </Label>
          <TextareaInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('dialog.editName.namePlaceholder')}
            className="text-sm min-h-9"
            disabled={saving}
          />
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => dialogStore.closeEditNameDialog()}
          disabled={saving}
        >
          {t('dialog.editName.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSave}
          disabled={saving || !name.trim()}
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.editName.saving')}
            </>
          ) : (
            t('dialog.editName.save')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
