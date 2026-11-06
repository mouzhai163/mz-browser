import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Tag, Loader2 } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
// @ts-ignore - Cross-plugin import
import { createTag } from '../../../environment-manager/src/api';

// 标签颜色选项
const TAG_COLORS = [
  { name: 'slate', value: '#64748b' },
  { name: 'gray', value: '#6b7280' },
  { name: 'zinc', value: '#71717a' },
  { name: 'neutral', value: '#737373' },
  { name: 'stone', value: '#78716c' },
  { name: 'red', value: '#ef4444' },
  { name: 'orange', value: '#f97316' },
  { name: 'amber', value: '#f59e0b' },
  { name: 'yellow', value: '#eab308' },
  { name: 'lime', value: '#84cc16' },
  { name: 'green', value: '#22c55e' },
  { name: 'emerald', value: '#10b981' },
  { name: 'teal', value: '#14b8a6' },
  { name: 'cyan', value: '#06b6d4' },
  { name: 'sky', value: '#0ea5e9' },
  { name: 'blue', value: '#3b82f6' },
  { name: 'indigo', value: '#6366f1' },
  { name: 'violet', value: '#8b5cf6' },
  { name: 'purple', value: '#a855f7' },
  { name: 'fuchsia', value: '#d946ef' },
  { name: 'pink', value: '#ec4899' },
  { name: 'rose', value: '#f43f5e' },
];

/**
 * 创建窗口创建标签对话框
 */
export function CreateWindowCreateTagDialog({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}) {
  const { t } = useTranslation('create-window');
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState<string>('slate');
  const [submitting, setSubmitting] = useState(false);

  // 重置表单
  const resetForm = () => {
    setTagName('');
    setTagColor('slate');
  };

  const handleSubmit = async () => {
    if (!tagName.trim()) {
      toast.warning(t('dialog.createTag.nameRequired') || '请输入标签名称');
      return;
    }
    setSubmitting(true);
    try {
      await createTag({
        name: tagName.trim(),
        color: tagColor,
      });
      toast.success(t('dialog.createTag.success') || '标签创建成功');
      onOpenChange(false);
      resetForm();
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.createTag.failed') || '创建标签失败');
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
        icon: Tag,
        iconColor: 'text-purple-500',
        title: t('dialog.createTag.title') || '创建标签',
        description: t('dialog.createTag.description') || '创建一个新的标签',
        gradient: 'bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10',
        className: 'border-b border-border/50',
      }}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.createTag.nameLabel') || '标签名称'}{' '}
            <span className="text-destructive">*</span>
          </Label>
          <TextareaInput
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            className="text-sm min-h-9"
            placeholder={t('dialog.createTag.namePlaceholder') || '请输入标签名称'}
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">
            {t('dialog.createTag.colorLabel') || '标签颜色'}
          </Label>
          <div className="flex flex-wrap gap-2">
            {TAG_COLORS.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => setTagColor(color.name)}
                className={`w-8 h-8 rounded-md border-2 transition-all ${
                  tagColor === color.name
                    ? 'border-foreground scale-110'
                    : 'border-border hover:border-foreground/50'
                }`}
                style={{ backgroundColor: color.value }}
                disabled={submitting}
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
          onClick={handleClose}
          disabled={submitting}
        >
          {t('dialog.createTag.cancel') || '取消'}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={submitting || !tagName.trim()}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.createTag.creating') || '创建中...'}
            </>
          ) : (
            t('dialog.createTag.create') || '创建'
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
