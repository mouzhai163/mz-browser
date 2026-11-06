import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Search, Check, Loader2, Plus } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { TextareaInput } from '@/components/textarea-input';
import { ScrollArea } from '@/components/ui/scroll-area';
// @ts-ignore - Cross-plugin import
import { listTags, createTag, type TagItem } from '../../../environment-manager/src/api';
// @ts-ignore - Cross-plugin import
import { getTagDotColorClasses } from '../../../environment-manager/src/utils';
import { CreateWindowCreateTagDialog } from './create-window-create-tag-dialog';

interface CreateWindowSelectTagsDialogProps {
  open: boolean;
  selectedTagUuids: string[]; // 已选中的标签 UUID 列表
  onOpenChange: (open: boolean) => void;
  onConfirm: (tagUuids: string[]) => void; // 返回选中的标签 UUID 列表
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
      <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center">
        <span
          className={`w-4 h-4 rounded-full border ${getTagDotColorClasses(tag.color || 'slate')}`}
        />
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
 * 创建窗口选择标签对话框
 */
export function CreateWindowSelectTagsDialog({
  open,
  selectedTagUuids: initialSelectedTagUuids,
  onOpenChange,
  onConfirm,
}: CreateWindowSelectTagsDialogProps) {
  const { t } = useTranslation('create-window');
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagUuids, setSelectedTagUuids] = useState<string[]>([]);
  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false);

  // 加载标签列表
  useEffect(() => {
    if (open) {
      loadTags();
      setSearchQuery('');
      // 初始化选中的标签
      setSelectedTagUuids(initialSelectedTagUuids || []);
    }
  }, [open, initialSelectedTagUuids]);

  const loadTags = async () => {
    setLoadingTags(true);
    try {
      const list = await listTags();
      setTags(list);
    } catch (e) {
      // 忽略错误
    } finally {
      setLoadingTags(false);
    }
  };

  // 过滤标签
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase();
    return tags.filter((t) => {
      const name = t.name?.toLowerCase() || '';
      return name.includes(q);
    });
  }, [tags, searchQuery]);

  // 打开创建标签弹窗
  const handleOpenCreateTag = () => {
    setCreateTagDialogOpen(true);
  };

  // 标签创建完成后的回调
  const handleTagCreated = () => {
    loadTags(); // 重新加载标签列表
  };

  // 切换标签选择
  const toggleTagSelection = (tagUuid: string) => {
    setSelectedTagUuids((prev) => {
      if (prev.includes(tagUuid)) {
        return prev.filter((uuid) => uuid !== tagUuid);
      } else {
        return [...prev, tagUuid];
      }
    });
  };

  // 确认选择
  const handleConfirm = () => {
    onConfirm(selectedTagUuids);
    onOpenChange(false);
  };

  return (
    <>
      <FormattedDialog
        open={open}
        onOpenChange={onOpenChange}
        minWidth="min-w-[520px]"
        header={{
          icon: Tag,
          iconColor: 'text-purple-500',
          title: t('dialog.tags.selectTitle') || '设置标签',
          description: t('dialog.tags.selectDescription') || '选择要使用的标签（可多选）',
          gradient: 'bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10',
          className: 'border-b border-border/50',
        }}
      >
        {loadingTags ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          </div>
        ) : tags.length > 0 ? (
          <>
            <div className="relative flex items-center mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <TextareaInput
                placeholder={t('dialog.tags.searchPlaceholder') || '搜索标签...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-2 text-sm min-h-9"
              />
            </div>

            {filteredTags.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">
                  {t('dialog.tags.noMatch') || '未找到匹配的标签'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[280px] -mx-1 px-1">
                <div className="space-y-2">
                  {filteredTags.map((tag) => (
                    <TagCard
                      key={tag.uuid}
                      tag={tag}
                      isSelected={selectedTagUuids.includes(tag.uuid)}
                      onClick={() => toggleTagSelection(tag.uuid)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        ) : (
          <EmptyState
            title={t('dialog.tags.noTags') || '暂无标签'}
            description={t('dialog.tags.noTagsDescription') || '创建标签以更好地分类和管理您的环境'}
          />
        )}

        <FormattedDialogFooter>
          {tags.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs mr-auto border-dashed hover:border-primary/50 hover:bg-primary/5"
              onClick={handleOpenCreateTag}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('dialog.tags.createNew') || '新建标签'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onOpenChange(false)}
          >
            {t('dialog.tags.cancel') || '取消'}
          </Button>
          <Button
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            onClick={handleConfirm}
          >
            {t('dialog.tags.confirm') || '确认'}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>

      {/* 创建标签对话框 */}
      <CreateWindowCreateTagDialog
        open={createTagDialogOpen}
        onOpenChange={setCreateTagDialogOpen}
        onComplete={handleTagCreated}
      />
    </>
  );
}
