import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Tag, Check, Loader2, Plus } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TagItem } from '../types';
import { useEnvironmentDialogStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';

interface EnvironmentAssignTagDialogProps {
  selectedIds: string[];
  tags: TagItem[];
  onComplete?: () => void;
  onClearSelection?: () => void;
}

/**
 * 标签卡片组件
 */
const TagCard: React.FC<{
  tag: TagItem;
  isSelected: boolean;
  onClick: () => void;
}> = ({ tag, isSelected, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors duration-150 ${
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/80'
      }`}
    >
      <div
        className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-white transition-colors duration-150"
        style={{ backgroundColor: tag.color }}
      >
        <Tag className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{tag.name}</span>
        </div>
      </div>
      <div
        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${
          isSelected
            ? 'bg-primary border-primary'
            : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'
        }`}
      >
        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
    </div>
  );
};

/**
 * 分配标签对话框组件
 * 内部处理所有逻辑，只接收必要数据
 */
export function EnvironmentAssignTagDialog({
  selectedIds,
  tags,
  onComplete,
  onClearSelection,
}: EnvironmentAssignTagDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const operations = useEnvironmentOperations(onComplete);
  const [submitting, setSubmitting] = useState(false);

  // 重置选择
  useEffect(() => {
    if (dialogStore.assignTagDialogOpen) {
      dialogStore.setSelectedTagIds([]);
    }
  }, [dialogStore.assignTagDialogOpen]);

  const handleSubmit = async () => {
    if (dialogStore.selectedTagIds.length === 0) {
      toast.warning('请选择标签');
      return;
    }

    setSubmitting(true);
    try {
      // 为每个选中的环境分配所有选中的标签
      for (const tagId of dialogStore.selectedTagIds) {
        const selectedTag = tags.find((t) => t.uuid === tagId);
        if (!selectedTag) continue;

        await operations.batchAssignTag(
          selectedIds,
          selectedTag.uuid,
          selectedTag.name,
          selectedTag.color
        );
      }

      dialogStore.closeAssignTagDialog();
      toast.success('分配标签成功');
      onClearSelection?.();
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '分配标签失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormattedDialog
      open={dialogStore.assignTagDialogOpen}
      onOpenChange={(open) => {
        dialogStore.setAssignTagDialogOpen(open);
        if (!open) {
          dialogStore.closeAssignTagDialog();
        }
      }}
      header={{
        icon: Tag,
        title: '分配标签',
        description: `为 ${selectedIds.length} 个环境分配标签`,
      }}
    >
      {tags.length > 0 ? (
        <ScrollArea className="h-[280px] -mx-1 px-1">
          <div className="space-y-2">
            {tags.map((tag) => (
              <TagCard
                key={tag.uuid}
                tag={tag}
                isSelected={dialogStore.selectedTagIds.includes(tag.uuid)}
                onClick={() => dialogStore.toggleTagId(tag.uuid)}
              />
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
            <Tag className="h-8 w-8 text-purple-500/60" />
          </div>
          <h4 className="text-sm font-medium text-foreground mb-1">暂无标签</h4>
          <p className="text-xs text-muted-foreground text-center max-w-[260px]">
            请先创建标签，然后再为环境分配标签
          </p>
        </div>
      )}

      <FormattedDialogFooter>
        {tags.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs mr-auto border-dashed hover:border-primary/50 hover:bg-primary/5"
            onClick={() => dialogStore.openCreateTagDialog()}
            disabled={submitting}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            创建新标签
          </Button>
        )}
        {tags.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs mr-auto border-dashed hover:border-primary/50 hover:bg-primary/5"
            onClick={() => dialogStore.openCreateTagDialog()}
            disabled={submitting}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            创建新标签
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => dialogStore.closeAssignTagDialog()}
          disabled={submitting}
        >
          取消
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={submitting || dialogStore.selectedTagIds.length === 0}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              提交中...
            </>
          ) : (
            '确认分配'
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
