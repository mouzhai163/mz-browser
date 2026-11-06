import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FolderTree, Loader2 } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
// @ts-ignore - Cross-plugin import
import { createGroup } from '../../../environment-manager/src/api';

interface CreateWindowCreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

/**
 * 创建窗口创建分组对话框
 */
export function CreateWindowCreateGroupDialog({
  open,
  onOpenChange,
  onComplete,
}: CreateWindowCreateGroupDialogProps) {
  const { t } = useTranslation('create-window');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 重置表单
  const resetForm = () => {
    setGroupName('');
    setGroupDescription('');
  };

  const handleSubmit = async () => {
    if (!groupName.trim()) {
      toast.warning(t('dialog.createGroup.nameRequired') || '请输入分组名称');
      return;
    }
    setSubmitting(true);
    try {
      await createGroup({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
      });
      toast.success(t('dialog.createGroup.success') || '分组创建成功');
      onOpenChange(false);
      resetForm();
      onComplete?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('dialog.createGroup.failed') || '创建分组失败'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      minWidth="min-w-[520px]"
      header={{
        icon: FolderTree,
        iconColor: 'text-blue-500',
        title: t('dialog.createGroup.title') || '创建分组',
        description: t('dialog.createGroup.description') || '创建一个新的分组',
        gradient: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
        className: 'border-b border-border/50',
      }}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.createGroup.nameLabel') || '分组名称'}{' '}
            <span className="text-destructive">*</span>
          </Label>
          <TextareaInput
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="text-sm min-h-9"
            placeholder={t('dialog.createGroup.namePlaceholder') || '请输入分组名称'}
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.createGroup.descriptionLabel') || '分组描述'}
          </Label>
          <TextareaInput
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.target.value)}
            className="text-sm min-h-20"
            placeholder={t('dialog.createGroup.descriptionPlaceholder') || '请输入分组描述（可选）'}
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
          {t('dialog.createGroup.cancel') || '取消'}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={submitting || !groupName.trim()}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.createGroup.creating') || '创建中...'}
            </>
          ) : (
            t('dialog.createGroup.create') || '创建'
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
