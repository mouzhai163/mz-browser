import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit, Loader2 } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import type { Group, GroupFormData } from '../types';

interface GroupEditDialogProps {
  open: boolean;
  group: Group | null;
  formData: GroupFormData;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onFormDataChange: (data: GroupFormData) => void;
  onSubmit: () => void;
}

/**
 * 编辑分组对话框组件
 */
export function GroupEditDialog({
  open,
  group,
  formData,
  submitting,
  onOpenChange,
  onFormDataChange,
  onSubmit,
}: GroupEditDialogProps) {
  const { t } = useTranslation('groups');

  // 打开弹窗时初始化表单数据
  useEffect(() => {
    if (open && group) {
      onFormDataChange({
        name: group.name,
        description: group.description || '',
      });
    }
  }, [open, group]);

  const handleClose = () => {
    onOpenChange(false);
    onFormDataChange({ name: '', description: '' });
  };

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
        icon: Edit,
        title: t('dialog.edit.title'),
        description: t('dialog.edit.description', { defaultValue: '修改分组的名称和描述信息' }),
      }}
    >
      <div className="space-y-4">
        {/* 分组名称 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">{t('dialog.edit.name')} *</Label>
          <TextareaInput
            value={formData.name}
            onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
            placeholder={t('dialog.create.namePlaceholder', { defaultValue: '例如：生产环境分组' })}
            className="text-sm"
            disabled={submitting}
          />
        </div>

        {/* 备注说明 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.edit.descriptionLabel')}
          </Label>
          <textarea
            value={formData.description}
            onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
            placeholder={t('dialog.create.descriptionPlaceholder', {
              defaultValue: '可选，用于描述此分组的用途',
            })}
            className="w-full h-20 px-3 py-2 text-sm bg-transparent border border-input rounded-md resize-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            disabled={submitting}
          />
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={handleClose}
          disabled={submitting}
        >
          {t('dialog.edit.cancel')}
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
              {t('dialog.edit.submitting')}
            </>
          ) : (
            t('dialog.edit.submit')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
