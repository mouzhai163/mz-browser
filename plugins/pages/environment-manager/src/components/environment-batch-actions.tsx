import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Play, Square, FolderTree, Tag, Trash2, X, RotateCcw, MonitorUp } from 'lucide-react';
import { useEnvironmentDialogStore, useEnvironmentSelectionStore, useEnvironmentFiltersStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';
import type { Environment } from '../types';
import { createEnvironmentShortcuts } from '../api/shortcut';

interface EnvironmentBatchActionsProps {
  environments: Environment[];
  startIndex: number;
  onComplete?: () => void;
}

export function EnvironmentBatchActions({
  environments,
  startIndex,
  onComplete,
}: EnvironmentBatchActionsProps) {
  const { t } = useTranslation('environment');
  const selectionStore = useEnvironmentSelectionStore();
  const dialogStore = useEnvironmentDialogStore();
  const filtersStore = useEnvironmentFiltersStore();
  const operations = useEnvironmentOperations(onComplete);

  const selectedCount = selectionStore.selectedIds.size;
  if (selectedCount === 0) return null;

  const selectedIds = Array.from(selectionStore.selectedIds);
  const selectedStartItems = environments.reduce<Array<{ envUuid: string; displayId: string }>>(
    (items, environment, index) => {
      if (selectionStore.selectedIds.has(environment.uuid)) {
        items.push({
          envUuid: environment.uuid,
          displayId: String(startIndex + index + 1),
        });
      }
      return items;
    },
    []
  );
  const isTrashMode = filtersStore.viewType === 'trash';

  const handleBatchStart = async () => {
    if (selectedCount === 0) return;
    try {
      await operations.batchStart(selectedStartItems);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量启动失败');
    }
  };

  // 为选中的环境在桌面批量创建快捷方式
  const handleBatchCreateShortcuts = async () => {
    const items = environments
      .filter((environment) => selectionStore.selectedIds.has(environment.uuid))
      .map((environment) => ({ envUuid: environment.uuid, envName: environment.name }));
    if (items.length === 0) return;
    try {
      const results = await createEnvironmentShortcuts(items);
      const failed = results.filter((result) => !result.ok);
      if (failed.length === 0) {
        toast.success(t('shortcut.createdMany', { count: results.length }));
      } else {
        toast.error(
          t('shortcut.partial', {
            ok: results.length - failed.length,
            failed: failed.length,
            reason: failed[0]?.message ?? '',
          })
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('shortcut.failed'));
    }
  };

  const handleBatchStop = async () => {
    if (selectedCount === 0) return;
    try {
      await operations.batchStop(selectedIds);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量停止失败');
    }
  };

  const handleMoveToGroup = () => {
    if (selectedCount === 0) {
      toast.warning('请先选择要移动的环境');
      return;
    }
    dialogStore.openMoveToGroupDialog();
  };

  const handleAssignTag = () => {
    if (selectedCount === 0) {
      toast.warning('请先选择要分配标签的环境');
      return;
    }
    dialogStore.openAssignTagDialog();
  };

  const handleDelete = async () => {
    if (selectedCount === 0) return;
    dialogStore.openBatchDeleteConfirmDialog(selectedCount);
  };

  const handleBatchRestore = async () => {
    if (selectedCount === 0) return;
    try {
      await operations.batchRestore(selectedIds);
      selectionStore.clearSelection();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量恢复失败');
    }
  };

  const handleBatchPermanentDelete = async () => {
    if (selectedCount === 0) return;
    dialogStore.openBatchPermanentDeleteConfirmDialog(selectedCount);
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-xl text-foreground px-3 py-2 flex items-center gap-1.5 shadow-lg border border-border/50 z-100 rounded-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
      {isTrashMode ? (
        // 回收站模式：显示批量恢复和批量永久删除按钮
        <>
          <button
            onClick={handleBatchRestore}
            className="text-xs font-semibold hover:text-primary hover:bg-primary/10 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-md"
          >
            <RotateCcw size={14} /> 批量恢复
          </button>
          <button
            onClick={handleBatchPermanentDelete}
            className="text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/15 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-md"
          >
            <Trash2 size={14} /> 批量永久删除
          </button>
        </>
      ) : (
        // 正常模式：显示常规批量操作按钮
        <>
          <button
            onClick={handleBatchStart}
            className="text-xs font-semibold hover:text-primary hover:bg-primary/10 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-md"
          >
            <Play size={14} /> {t('batchActions.batchStart')}
          </button>
          <button
            onClick={handleBatchStop}
            className="text-xs font-semibold hover:text-primary hover:bg-primary/10 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-md"
          >
            <Square size={14} /> {t('batchActions.batchStop')}
          </button>
          <button
            onClick={handleBatchCreateShortcuts}
            className="text-xs font-semibold hover:text-primary hover:bg-primary/10 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-md"
          >
            <MonitorUp size={14} /> {t('batchActions.createShortcuts')}
          </button>
          <button
            onClick={handleMoveToGroup}
            className="text-xs font-semibold hover:text-primary hover:bg-primary/10 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-md"
          >
            <FolderTree size={14} /> {t('batchActions.moveToGroup')}
          </button>
          <button
            onClick={handleAssignTag}
            className="text-xs font-semibold hover:text-primary hover:bg-primary/10 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-md"
          >
            <Tag size={14} /> {t('batchActions.assignTag')}
          </button>
          <button
            onClick={handleDelete}
            className="text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/15 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-md"
          >
            <Trash2 size={14} /> {t('batchActions.delete')}
          </button>
        </>
      )}
      <div className="w-px h-5 bg-border/50 mx-1"></div>
      <button
        onClick={selectionStore.clearSelection}
        className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all cursor-pointer rounded-md"
      >
        <X size={16} />
      </button>
    </div>
  );
}
