import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Loader2, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';

interface GroupDeleteDialogProps {
  open: boolean;
  group: { id: string; uuid: string; name: string; description?: string } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * 删除分组对话框组件
 */
export function GroupDeleteDialog({
  open,
  group,
  onOpenChange,
  onConfirm,
}: GroupDeleteDialogProps) {
  const { t } = useTranslation('groups');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!group) return;

    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  if (!group) return null;

  return (
    <FormattedDialog
      open={open}
      onOpenChange={(open) => {
        if (!deleting) {
          onOpenChange(open);
        }
      }}
      minWidth="min-w-[440px]"
      header={{
        icon: Trash2,
        iconColor: 'text-destructive',
        title: t('dialog.delete.title'),
        description: t('dialog.delete.description', { name: group.name }),
        gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
        className: 'border-b border-destructive/20',
      }}
      contentPadding="p-5"
    >
      {/* 分组信息卡片 */}
      <div className="bg-muted/50 rounded-md p-3 border border-border/50">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{group.name}</p>
          {group.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
          )}
        </div>
      </div>

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={deleting}>
          <X className="h-4 w-4 mr-1.5" />
          {t('dialog.delete.cancel')}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
          {deleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              {t('dialog.delete.deleting', { defaultValue: '删除中...' })}
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t('dialog.delete.confirm')}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
