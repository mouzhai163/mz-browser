import { useTranslation } from 'react-i18next';
import { FolderTree, Loader2 } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import type { GroupFormData } from '../types';

interface GroupCreateDialogProps {
  open: boolean;
  formData: GroupFormData;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFormDataChange: (data: GroupFormData) => void;
  onSubmit: () => void;
}

/**
 * 创建分组对话框组件
 */
export function GroupCreateDialog({
  open,
  formData,
  submitting,
  onOpenChange,
  onFormDataChange,
  onSubmit,
}: GroupCreateDialogProps) {
  const { t } = useTranslation('groups');

  return (
    <FormattedDialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          onFormDataChange({ name: '', description: '' });
        }
      }}
      header={{
        icon: FolderTree,
        title: t('dialog.create.title'),
        description: t('dialog.create.description'),
      }}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">{t('dialog.create.name')} *</Label>
          <TextareaInput
            value={formData.name}
            onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
            className="text-sm min-h-9"
            placeholder={t('dialog.create.namePlaceholder')}
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.create.descriptionLabel')}
          </Label>
          <TextareaInput
            value={formData.description}
            onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
            className="text-sm min-h-20"
            placeholder={t('dialog.create.descriptionPlaceholder')}
            disabled={submitting}
          />
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            onOpenChange(false);
            onFormDataChange({ name: '', description: '' });
          }}
          disabled={submitting}
        >
          {t('dialog.create.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={onSubmit}
          disabled={submitting || !formData.name.trim()}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.create.submitting')}
            </>
          ) : (
            t('dialog.create.submit')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
