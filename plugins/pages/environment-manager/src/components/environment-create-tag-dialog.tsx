import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Tag, Loader2 } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import { useEnvironmentDialogStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';
import { TAG_COLORS, getTagButtonBgClass } from '../utils';
import type { TagColor } from '../utils';

interface EnvironmentCreateTagDialogProps {
  onComplete?: () => void;
}

/**
 * 创建标签对话框组件
 */
export function EnvironmentCreateTagDialog({ onComplete }: EnvironmentCreateTagDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const operations = useEnvironmentOperations(onComplete);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!dialogStore.newTagName.trim()) {
      toast.warning(t('dialog.createTag.nameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await operations.createTag(dialogStore.newTagName.trim(), dialogStore.newTagColor);
      dialogStore.closeCreateTagDialog();
      toast.success(t('dialog.createTag.success'));
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.createTag.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormattedDialog
      open={dialogStore.createTagDialogOpen}
      onOpenChange={(open) => {
        dialogStore.setCreateTagDialogOpen(open);
        if (!open) {
          dialogStore.closeCreateTagDialog();
        }
      }}
      header={{
        icon: Tag,
        title: t('dialog.createTag.title'),
        description: t('dialog.createTag.description'),
      }}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.createTag.nameLabel')} *
          </Label>
          <TextareaInput
            value={dialogStore.newTagName}
            onChange={(e) => dialogStore.setNewTagName(e.target.value)}
            className="text-sm min-h-9"
            placeholder={t('dialog.createTag.namePlaceholder')}
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.createTag.colorLabel')}
          </Label>
          <div className="flex gap-1.5 flex-wrap">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => dialogStore.setNewTagColor(color)}
                disabled={submitting}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  dialogStore.newTagColor === color
                    ? 'scale-110 ring-1 ring-primary ring-offset-1 ring-offset-background'
                    : 'border-border hover:border-foreground/50'
                } ${getTagButtonBgClass(color as TagColor)}`}
                title={color}
              />
            ))}
          </div>
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => dialogStore.closeCreateTagDialog()}
          disabled={submitting}
        >
          {t('dialog.createTag.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={submitting || !dialogStore.newTagName.trim()}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.createTag.creating')}
            </>
          ) : (
            t('dialog.createTag.submit')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
