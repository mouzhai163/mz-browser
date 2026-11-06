import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FolderTree, Search, Check, Loader2, Plus } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { TextareaInput } from '@/components/textarea-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GroupItem } from '../types';
import { useEnvironmentDialogStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';
import { getGroupColor } from '../utils/group-color';

interface EnvironmentMoveToGroupDialogProps {
  selectedIds: string[];
  groups: GroupItem[];
  onComplete?: () => void;
  onClearSelection?: () => void;
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
 * 移动到分组对话框组件
 * 内部处理所有逻辑，只接收必要数据
 */
export function EnvironmentMoveToGroupDialog({
  selectedIds,
  groups,
  onComplete,
  onClearSelection,
}: EnvironmentMoveToGroupDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const operations = useEnvironmentOperations(onComplete);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 重置搜索
  useEffect(() => {
    if (dialogStore.moveToGroupDialogOpen) {
      setSearchQuery('');
      dialogStore.setSelectedGroupId('');
    }
  }, [dialogStore.moveToGroupDialogOpen]);

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

  const handleSubmit = async () => {
    if (!dialogStore.selectedGroupId) {
      toast.warning(t('dialog.moveToGroup.selectRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const selectedGroup = groups.find((g) => g.uuid === dialogStore.selectedGroupId);
      await operations.batchMoveToGroup(
        selectedIds,
        selectedGroup?.uuid || '',
        selectedGroup?.name,
        selectedGroup ? getGroupColor(selectedGroup.name) : ''
      );
      dialogStore.closeMoveToGroupDialog();
      toast.success(t('dialog.moveToGroup.success'));
      onClearSelection?.();
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.moveToGroup.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormattedDialog
      open={dialogStore.moveToGroupDialogOpen}
      onOpenChange={(open) => {
        dialogStore.setMoveToGroupDialogOpen(open);
        if (!open) {
          dialogStore.closeMoveToGroupDialog();
        }
      }}
      header={{
        icon: FolderTree,
        title: t('dialog.moveToGroup.title'),
        description: t('dialog.moveToGroup.description', { count: selectedIds.length }),
      }}
    >
      {groups.length > 0 ? (
        <>
          <div className="relative flex items-center mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <TextareaInput
              placeholder={t('dialog.moveToGroup.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-2 text-sm min-h-9"
            />
          </div>

          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">{t('dialog.moveToGroup.noMatch')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[280px] -mx-1 px-1">
              <div className="space-y-2">
                {filteredGroups.map((group) => (
                  <GroupCard
                    key={group.uuid}
                    group={group}
                    isSelected={dialogStore.selectedGroupId === group.uuid}
                    onClick={() => dialogStore.setSelectedGroupId(group.uuid)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
            <FolderTree className="h-8 w-8 text-blue-500/60" />
          </div>
          <h4 className="text-sm font-medium text-foreground mb-1">
            {t('dialog.moveToGroup.noGroups')}
          </h4>
          <p className="text-xs text-muted-foreground text-center max-w-[260px]">
            {t('dialog.moveToGroup.noGroupsDescription')}
          </p>
        </div>
      )}

      <FormattedDialogFooter>
        {groups.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs mr-auto border-dashed hover:border-primary/50 hover:bg-primary/5"
            onClick={() => dialogStore.openCreateGroupDialog()}
            disabled={submitting}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t('dialog.moveToGroup.createNew')}
          </Button>
        )}
        {groups.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs mr-auto border-dashed hover:border-primary/50 hover:bg-primary/5"
            onClick={() => dialogStore.openCreateGroupDialog()}
            disabled={submitting}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t('dialog.moveToGroup.createNew')}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => dialogStore.closeMoveToGroupDialog()}
          disabled={submitting}
        >
          {t('dialog.moveToGroup.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={submitting || !dialogStore.selectedGroupId}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.moveToGroup.submitting')}
            </>
          ) : (
            t('dialog.moveToGroup.submit')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
