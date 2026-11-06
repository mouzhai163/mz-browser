import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderTree, Search, Check, Loader2, Plus } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { TextareaInput } from '@/components/textarea-input';
import { ScrollArea } from '@/components/ui/scroll-area';
// @ts-ignore - Cross-plugin import
import { listGroups, createGroup, type GroupItem } from '../../../environment-manager/src/api';
import { CreateWindowCreateGroupDialog } from './create-window-create-group-dialog';

interface CreateWindowSelectGroupDialogProps {
  open: boolean;
  selectedGroupUuid: string | undefined; // 已选中的分组 UUID
  onOpenChange: (open: boolean) => void;
  onConfirm: (groupUuid: string | undefined) => void; // 返回选中的分组 UUID，undefined 表示移除分组
}

/**
 * 分组卡片组件
 */
const GroupCard: React.FC<{
  group: GroupItem;
  isSelected: boolean;
  onClick: () => void;
}> = ({ group, isSelected, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors duration-150 ${
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/80'
      }`}
    >
      <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center bg-muted text-muted-foreground group-hover:text-foreground transition-colors duration-150">
        <FolderTree className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{group.name}</span>
        </div>
        {group.description && (
          <div className="mt-0.5 text-xs text-muted-foreground truncate">{group.description}</div>
        )}
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
      <FolderTree className="h-8 w-8 text-blue-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{title}</h4>
    <p className="text-xs text-muted-foreground text-center max-w-[260px]">{description}</p>
  </div>
);

/**
 * 创建窗口选择分组对话框
 */
export function CreateWindowSelectGroupDialog({
  open,
  selectedGroupUuid: initialSelectedGroupUuid,
  onOpenChange,
  onConfirm,
}: CreateWindowSelectGroupDialogProps) {
  const { t } = useTranslation('create-window');
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupUuid, setSelectedGroupUuid] = useState<string>('');
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);

  // 加载分组列表
  useEffect(() => {
    if (open) {
      loadGroups();
      setSearchQuery('');
      // 初始化选中的分组
      setSelectedGroupUuid(initialSelectedGroupUuid || '');
    }
  }, [open, initialSelectedGroupUuid]);

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const list = await listGroups();
      setGroups(list);
    } catch (e) {
      // 忽略错误
    } finally {
      setLoadingGroups(false);
    }
  };

  // 过滤分组
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter((g) => {
      const name = g.name?.toLowerCase() || '';
      const description = g.description?.toLowerCase() || '';
      return name.includes(q) || description.includes(q);
    });
  }, [groups, searchQuery]);

  // 打开创建分组弹窗
  const handleOpenCreateGroup = () => {
    setCreateGroupDialogOpen(true);
  };

  // 分组创建完成后的回调
  const handleGroupCreated = () => {
    loadGroups(); // 重新加载分组列表
  };

  // 确认选择
  const handleConfirm = () => {
    onConfirm(selectedGroupUuid || undefined);
    onOpenChange(false);
  };

  return (
    <>
      <FormattedDialog
        open={open}
        onOpenChange={onOpenChange}
        minWidth="min-w-[520px]"
        header={{
          icon: FolderTree,
          iconColor: 'text-blue-500',
          title: t('dialog.group.selectTitle') || '设置分组',
          description: t('dialog.group.selectDescription') || '选择要使用的分组',
          gradient: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
          className: 'border-b border-border/50',
        }}
      >
        {loadingGroups ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : groups.length > 0 ? (
          <>
            <div className="relative flex items-center mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <TextareaInput
                placeholder={t('dialog.group.searchPlaceholder') || '搜索分组...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-2 text-sm min-h-9"
              />
            </div>

            {filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">
                  {t('dialog.group.noMatch') || '未找到匹配的分组'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[280px] -mx-1 px-1">
                <div className="space-y-2">
                  {filteredGroups.map((group) => (
                    <GroupCard
                      key={group.uuid}
                      group={group}
                      isSelected={selectedGroupUuid === group.uuid}
                      onClick={() => setSelectedGroupUuid(group.uuid)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        ) : (
          <EmptyState
            title={t('dialog.group.noGroups') || '暂无分组'}
            description={
              t('dialog.group.noGroupsDescription') || '创建分组以更好地组织和管理您的环境'
            }
          />
        )}

        <FormattedDialogFooter>
          {groups.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs mr-auto border-dashed hover:border-primary/50 hover:bg-primary/5"
              onClick={handleOpenCreateGroup}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('dialog.group.createNew') || '新建分组'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onOpenChange(false)}
          >
            {t('dialog.group.cancel') || '取消'}
          </Button>
          <Button
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            onClick={handleConfirm}
          >
            {t('dialog.group.confirm') || '确认'}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>

      {/* 创建分组对话框 */}
      <CreateWindowCreateGroupDialog
        open={createGroupDialogOpen}
        onOpenChange={setCreateGroupDialogOpen}
        onComplete={handleGroupCreated}
      />
    </>
  );
}
