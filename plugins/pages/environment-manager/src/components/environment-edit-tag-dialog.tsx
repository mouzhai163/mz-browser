import { useState, useEffect } from 'react';
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

interface EnvironmentEditTagDialogProps {
  onComplete?: () => void;
}

/**
 * 编辑标签对话框组件
 */
export function EnvironmentEditTagDialog({ onComplete }: EnvironmentEditTagDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const operations = useEnvironmentOperations(onComplete);
  const [submitting, setSubmitting] = useState(false);

  // 初始化编辑数据
  useEffect(() => {
    if (dialogStore.editTagDialogOpen && dialogStore.editingTag) {
      dialogStore.setEditTagName(dialogStore.editingTag.name);
      dialogStore.setEditTagColor(dialogStore.editingTag.color);
    }
  }, [dialogStore.editTagDialogOpen, dialogStore.editingTag]);

  const handleSubmit = async () => {
    if (!dialogStore.editingTag) return;
    if (!dialogStore.editTagName.trim()) {
      toast.warning(t('dialog.editTag.nameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await operations.updateTag(
        dialogStore.editingTag.uuid,
        dialogStore.editTagName.trim(),
        dialogStore.editTagColor
      );
      dialogStore.closeEditTagDialog();
      toast.success(t('dialog.editTag.success'));
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.editTag.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!dialogStore.editingTag) return null;

  return (
    <FormattedDialog
      open={dialogStore.editTagDialogOpen && !!dialogStore.editingTag}
      onOpenChange={(open) => {
        dialogStore.setEditTagDialogOpen(open);
        if (!open) {
          dialogStore.closeEditTagDialog();
        }
      }}
      header={{
        icon: Tag,
        title: t('dialog.editTag.title'),
        description: t('dialog.editTag.description'),
      }}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.editTag.nameLabel')} *
          </Label>
          <TextareaInput
            value={dialogStore.editTagName}
            onChange={(e) => dialogStore.setEditTagName(e.target.value)}
            className="text-sm min-h-9"
            placeholder={t('dialog.editTag.namePlaceholder')}
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.editTag.colorLabel')}
          </Label>
          <div className="flex gap-1.5 flex-wrap">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => dialogStore.setEditTagColor(color)}
                disabled={submitting}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  dialogStore.editTagColor === color
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
          onClick={() => dialogStore.closeEditTagDialog()}
          disabled={submitting}
        >
          {t('dialog.editTag.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={submitting || !dialogStore.editTagName.trim()}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.editTag.updating')}
            </>
          ) : (
            t('dialog.editTag.update')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
