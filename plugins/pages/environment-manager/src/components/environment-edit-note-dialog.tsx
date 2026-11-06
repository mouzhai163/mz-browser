import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, FileText } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import { useEnvironmentDialogStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';

interface EnvironmentEditNoteDialogProps {
  onComplete?: () => void;
}

/**
 * 编辑环境备注对话框
 */
export function EnvironmentEditNoteDialog({ onComplete }: EnvironmentEditNoteDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const operations = useEnvironmentOperations(onComplete);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dialogStore.editNoteEnvironment) {
      setNote(dialogStore.editNoteEnvironment.description || '');
    }
  }, [dialogStore.editNoteEnvironment]);

  const handleSave = async () => {
    if (!dialogStore.editNoteEnvironment) return;

    setSaving(true);
    try {
      await operations.updateEnvironment(dialogStore.editNoteEnvironment.uuid, {
        description: note.trim() || undefined,
      });
      dialogStore.closeEditNoteDialog();
      toast.success(t('dialog.editNote.success'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.editNote.failed'));
    } finally {
      setSaving(false);
    }
  };

  if (!dialogStore.editNoteEnvironment) return null;

  return (
    <FormattedDialog
      open={dialogStore.editNoteDialogOpen && !!dialogStore.editNoteEnvironment}
      onOpenChange={(open) => {
        dialogStore.setEditNoteDialogOpen(open);
        if (!open) {
          dialogStore.closeEditNoteDialog();
        }
      }}
      header={{
        icon: FileText,
        title: t('dialog.editNote.title'),
        description: t('dialog.editNote.description'),
      }}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.editNote.noteLabel')}
          </Label>
          <TextareaInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('dialog.editNote.notePlaceholder')}
            className="text-sm min-h-20"
            disabled={saving}
          />
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => dialogStore.closeEditNoteDialog()}
          disabled={saving}
        >
          {t('dialog.editNote.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.editNote.saving')}
            </>
          ) : (
            t('dialog.editNote.save')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
