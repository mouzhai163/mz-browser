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

interface EnvironmentAssignSingleGroupDialogProps {
  groups: GroupItem[];
  onComplete?: () => void;
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
 * 单个环境配置分组对话框组件
 * 内部处理所有逻辑，只接收必要数据
 */
export function EnvironmentAssignSingleGroupDialog({
  groups,
  onComplete,
}: EnvironmentAssignSingleGroupDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const operations = useEnvironmentOperations(onComplete);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 初始化选中的分组
  useEffect(() => {
    if (dialogStore.assignSingleGroupDialogOpen && dialogStore.assigningEnvironmentForGroup) {
      const currentGroupId = dialogStore.assigningEnvironmentForGroup.group?.uuid;
      if (currentGroupId) {
        dialogStore.setSingleSelectedGroupId(currentGroupId);
      } else {
        dialogStore.setSingleSelectedGroupId('');
      }
      setSearchQuery('');
    }
  }, [dialogStore.assignSingleGroupDialogOpen, dialogStore.assigningEnvironmentForGroup]);

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
    if (!dialogStore.assigningEnvironmentForGroup) return;
    const selectedGroup = dialogStore.singleSelectedGroupId
      ? groups.find((g) => g.uuid === dialogStore.singleSelectedGroupId)
      : null;

    setSubmitting(true);
    try {
      await operations.batchMoveToGroup(
        [dialogStore.assigningEnvironmentForGroup.uuid],
        selectedGroup?.uuid || '',
        selectedGroup?.name,
        selectedGroup ? getGroupColor(selectedGroup.name) : ''
      );
      dialogStore.closeAssignSingleGroupDialog();
      toast.success(t('dialog.assignSingleGroup.success'));
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.assignSingleGroup.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const environmentName =
    dialogStore.assigningEnvironmentForGroup?.name || t('dialog.assignSingleGroup.defaultEnvName');

  return (
    <FormattedDialog
      open={dialogStore.assignSingleGroupDialogOpen && !!dialogStore.assigningEnvironmentForGroup}
      onOpenChange={(open) => {
        dialogStore.setAssignSingleGroupDialogOpen(open);
        if (!open) {
          dialogStore.closeAssignSingleGroupDialog();
        }
      }}
      header={{
        icon: FolderTree,
        title: t('dialog.assignSingleGroup.title'),
        description: t('dialog.assignSingleGroup.description', { envName: environmentName }),
      }}
    >
      {groups.length > 0 ? (
        <>
          <div className="relative flex items-center mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <TextareaInput
              placeholder={t('dialog.assignSingleGroup.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-2 text-sm min-h-9"
            />
          </div>

          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                {t('dialog.assignSingleGroup.noMatch')}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[280px] -mx-1 px-1">
              <div className="space-y-2">
                {filteredGroups.map((group) => (
                  <GroupCard
                    key={group.uuid}
                    group={group}
                    isSelected={dialogStore.singleSelectedGroupId === group.uuid}
                    onClick={() => dialogStore.setSingleSelectedGroupId(group.uuid)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </>
      ) : (
        <EmptyState
          title={t('dialog.assignSingleGroup.noGroups')}
          description={t('dialog.assignSingleGroup.noGroupsDescription')}
        />
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
            {t('dialog.assignSingleGroup.createNew')}
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
            {t('dialog.assignSingleGroup.createNew')}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => dialogStore.closeAssignSingleGroupDialog()}
          disabled={submitting}
        >
          {t('dialog.assignSingleGroup.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={submitting || !dialogStore.singleSelectedGroupId}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.assignSingleGroup.submitting')}
            </>
          ) : (
            t('dialog.assignSingleGroup.submit')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
