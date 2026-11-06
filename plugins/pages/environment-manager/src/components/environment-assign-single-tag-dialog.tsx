import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Tag, Search, Check, Loader2, Plus } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { TextareaInput } from '@/components/textarea-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TagItem } from '../types';
import { useEnvironmentDialogStore } from '../stores';
import { assignTags, removeTag } from '../api';
import { getTagDotColorClasses } from '../utils';

interface EnvironmentAssignSingleTagDialogProps {
  tags: TagItem[];
  onComplete?: () => void;
}

/**
 * 标签卡片组件
 */
const TagCard: React.FC<{
  tag: TagItem;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ tag, isSelected, onClick, disabled }) => {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors duration-150 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/80'}`}
    >
      <div
        className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-colors duration-150 ${
          isSelected ? 'bg-primary/20' : 'bg-muted'
        }`}
      >
        <div className={`w-3 h-3 rounded-full ${getTagDotColorClasses(tag.color || 'slate')}`} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm truncate">{tag.name}</span>
      </div>
      <div
        className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-150 ${
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
 * 空状态组件
 */
const EmptyState: React.FC<{
  title: string;
  description: string;
}> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      <Tag className="h-8 w-8 text-blue-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{title}</h4>
    <p className="text-xs text-muted-foreground text-center max-w-[260px]">{description}</p>
  </div>
);

/**
 * 单个环境编辑标签对话框组件
 * 支持多选标签
 */
export function EnvironmentAssignSingleTagDialog({
  tags,
  onComplete,
}: EnvironmentAssignSingleTagDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // 当对话框打开时，初始化已绑定的标签
  useEffect(() => {
    if (dialogStore.assignSingleTagDialogOpen && dialogStore.assigningEnvironment) {
      const boundTagIds = new Set((dialogStore.assigningEnvironment.tags || []).map((t) => t.uuid));
      setSelectedTagIds(boundTagIds);
      setSearchQuery('');
    }
  }, [dialogStore.assignSingleTagDialogOpen, dialogStore.assigningEnvironment]);

  // 过滤标签
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase();
    return tags.filter((tag) => {
      const name = tag.name?.toLowerCase() || '';
      return name.includes(q);
    });
  }, [tags, searchQuery]);

  // 切换标签选中状态
  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  // 保存标签
  const handleSubmit = async () => {
    if (!dialogStore.assigningEnvironment) return;

    const envUuid = dialogStore.assigningEnvironment.uuid;
    const currentTagIds = new Set((dialogStore.assigningEnvironment.tags || []).map((t) => t.uuid));

    // 计算需要添加和移除的标签
    const tagsToAdd = [...selectedTagIds].filter((id) => !currentTagIds.has(id));
    const tagsToRemove = [...currentTagIds].filter((id) => !selectedTagIds.has(id));

    if (tagsToAdd.length === 0 && tagsToRemove.length === 0) {
      dialogStore.closeAssignSingleTagDialog();
      return;
    }

    setSubmitting(true);
    try {
      // 添加新标签
      if (tagsToAdd.length > 0) {
        await assignTags({
          uuid: envUuid,
          tag_uuids: tagsToAdd,
        });
      }

      // 移除标签
      for (const tagId of tagsToRemove) {
        await removeTag({
          uuid: envUuid,
          tag_uuid: tagId,
        });
      }

      dialogStore.closeAssignSingleTagDialog();
      toast.success(t('dialog.assignSingleTag.success'));
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.assignSingleTag.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const environmentName =
    dialogStore.assigningEnvironment?.name || t('dialog.assignSingleTag.defaultEnvName');

  return (
    <FormattedDialog
      open={dialogStore.assignSingleTagDialogOpen && !!dialogStore.assigningEnvironment}
      onOpenChange={(open) => {
        dialogStore.setAssignSingleTagDialogOpen(open);
        if (!open) {
          dialogStore.closeAssignSingleTagDialog();
        }
      }}
      header={{
        icon: Tag,
        title: t('dialog.assignSingleTag.title'),
        description: t('dialog.assignSingleTag.description', { envName: environmentName }),
      }}
    >
      {tags.length > 0 ? (
        <>
          <div className="relative flex items-center mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <TextareaInput
              placeholder={t('dialog.assignSingleTag.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-2 text-sm min-h-9"
            />
          </div>

          {/* 已选中数量提示 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              {t('dialog.assignSingleTag.selectedCount', { count: selectedTagIds.size })}
            </span>
            {selectedTagIds.size > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setSelectedTagIds(new Set())}
              >
                {t('dialog.assignSingleTag.clearAll')}
              </button>
            )}
          </div>

          {filteredTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">{t('dialog.assignSingleTag.noMatch')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[280px] -mx-1 px-1">
              <div className="space-y-1">
                {filteredTags.map((tag) => (
                  <TagCard
                    key={tag.uuid}
                    tag={tag}
                    isSelected={selectedTagIds.has(tag.uuid)}
                    onClick={() => toggleTag(tag.uuid)}
                    disabled={submitting}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </>
      ) : (
        <EmptyState
          title={t('dialog.assignSingleTag.noTags')}
          description={t('dialog.assignSingleTag.noTagsDescription')}
        />
      )}

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs mr-auto border-dashed hover:border-primary/50 hover:bg-primary/5"
          onClick={() => dialogStore.openCreateTagDialog()}
          disabled={submitting}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t('dialog.assignSingleTag.createNew')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => dialogStore.closeAssignSingleTagDialog()}
          disabled={submitting}
        >
          {t('dialog.assignSingleTag.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.assignSingleTag.submitting')}
            </>
          ) : (
            t('dialog.assignSingleTag.submit')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
