import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { EnvironmentHeader } from './environment-header';
import { useDefaultBrowserStore } from '../stores/default-browser-store';
import { EnvironmentTable } from './environment-table';
import { EnvironmentBatchActions } from './environment-batch-actions';
import { EnvironmentPagination } from './environment-pagination';
import { EnvironmentMoveToGroupDialog } from './environment-move-to-group-dialog';
import { EnvironmentAssignTagDialog } from './environment-assign-tag-dialog';
import { EnvironmentManageTagsDialog } from './environment-manage-tags-dialog';
import { EnvironmentAssignSingleTagDialog } from './environment-assign-single-tag-dialog';
import { EnvironmentAssignSingleGroupDialog } from './environment-assign-single-group-dialog';
import { EnvironmentCreateTagDialog } from './environment-create-tag-dialog';
import { EnvironmentEditTagDialog } from './environment-edit-tag-dialog';
import { EnvironmentCreateGroupDialog } from './environment-create-group-dialog';
import { EnvironmentSelectAccountDialog } from './environment-select-account-dialog';
import { EnvironmentCreateAccountDialog } from './environment-create-account-dialog';
import { EnvironmentSelectProxyDialog } from './environment-select-proxy-dialog';
import { EnvironmentCreateProxyDialog } from './environment-create-proxy-dialog';
import { EnvironmentDeleteConfirmDialog } from './environment-delete-confirm-dialog';
import { EnvironmentBatchDeleteConfirmDialog } from './environment-batch-delete-confirm-dialog';
import { EnvironmentBatchPermanentDeleteConfirmDialog } from './environment-batch-permanent-delete-confirm-dialog';
import { EnvironmentRestoreConfirmDialog } from './environment-restore-confirm-dialog';
import { EnvironmentPermanentDeleteConfirmDialog } from './environment-permanent-delete-confirm-dialog';
import { EnvironmentEditNameDialog } from './environment-edit-name-dialog';
import { EnvironmentEditNoteDialog } from './environment-edit-note-dialog';
import { EnvironmentEditUrlDialog } from './environment-edit-url-dialog';
import { EnvironmentEditCookiesDialog } from './environment-edit-cookies-dialog';
import { EnvironmentClearCacheConfirmDialog } from './environment-clear-cache-confirm-dialog';
import { useEnvironments } from '../hooks/use-environments';
import {
  useEnvironmentDialogStore,
  useEnvironmentFiltersStore,
  useEnvironmentSelectionStore,
  useRunningEnvsStore,
} from '../stores';

export function EnvironmentList() {
  const { t } = useTranslation('environment');
  // URL 参数处理
  const [searchParams, setSearchParams] = useSearchParams();

  // 过滤和分页 Store
  const filtersStore = useEnvironmentFiltersStore();
  const setFilterGroupId = useEnvironmentFiltersStore((state) => state.setFilterGroupId);

  // 缓存tagUuids数组，避免每次渲染都创建新数组导致无限循环
  const tagUuids = useMemo(
    () => (filtersStore.filterTagId ? [filtersStore.filterTagId] : undefined),
    [filtersStore.filterTagId]
  );

  // 数据获取（使用服务端分页和过滤）
  const {
    environments: filteredEnvironments,
    groups: availableGroups,
    tags: availableTags,
    total,
    loading,
    error,
    refresh,
  } = useEnvironments({
    page: filtersStore.currentPage,
    pageSize: filtersStore.pageSize,
    groupUuid: filtersStore.filterGroupId || undefined,
    keyword: filtersStore.searchQuery || undefined,
    tagUuids,
    viewType: filtersStore.viewType,
  });

  // 处理 URL 参数中的 group 筛选
  useEffect(() => {
    const groupId = searchParams.get('group');
    if (groupId) {
      // 设置分组筛选，并在消费后立即清理 URL 参数，避免 effect 因状态更新重复触发
      setFilterGroupId(groupId);

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('group');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams, setFilterGroupId]);

  // 计算总页数（基于服务端返回的 total）
  const totalPages = Math.max(1, Math.ceil(total / filtersStore.pageSize));

  // 选择管理 Store
  const selectionStore = useEnvironmentSelectionStore();

  // 对话框状态 Store
  const dialogStore = useEnvironmentDialogStore();

  // 运行状态 Store
  const runningEnvsStore = useRunningEnvsStore();

  // 初始化环境连接状态监听器
  useEffect(() => {
    const unlistenPromise = runningEnvsStore.initListener();
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // 默认浏览器：读取当前设置，并在系统交来的外部链接打不开时提示
  useEffect(() => {
    const { refresh, initListener } = useDefaultBrowserStore.getState();
    void refresh().catch((error) => console.warn('[DefaultBrowser] refresh failed:', error));
    const unlistenPromise = initListener();
    // 从 Windows 设置回来后立刻刷新"是否已是系统默认"
    const handleFocus = () => {
      void refresh().catch(() => undefined);
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);
  const defaultBrowser = useDefaultBrowserStore((s) => s.state);

  const handlePageChange = (page: number) => {
    filtersStore.setCurrentPage(page);
    // 清除选择，因为切换页面后选择可能不相关
    selectionStore.clearSelection();
  };

  const handlePageSizeChange = (size: number) => {
    filtersStore.setPageSize(size);
    // 清除选择，因为切换页数后选择可能不相关
    selectionStore.clearSelection();
  };

  const startIndex = (filtersStore.currentPage - 1) * filtersStore.pageSize;

  return (
    <div className="flex flex-col h-[calc(100vh-50px)]">
      <EnvironmentHeader
        environments={filteredEnvironments}
        onComplete={refresh}
        onManageTags={dialogStore.openManageTagsDialog}
      />

      {defaultBrowser.supported && defaultBrowser.environmentUuid && !defaultBrowser.isSystemDefault && (
        <div className="mx-6 mb-2 flex items-center gap-3 rounded border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
          <span className="flex-1">{t('defaultBrowser.systemStepBanner')}</span>
          <button
            type="button"
            className="shrink-0 rounded bg-primary px-2 py-1 text-primary-foreground"
            onClick={() => void useDefaultBrowserStore.getState().openSystemSettings()}
          >
            {t('defaultBrowser.openSettings')}
          </button>
        </div>
      )}

      {error && <div className="px-6 py-2 text-xs text-destructive">环境列表加载失败：{error}</div>}

      <EnvironmentTable
        environments={filteredEnvironments}
        availableTags={availableTags}
        availableGroups={availableGroups}
        loading={loading}
        onComplete={refresh}
        startIndex={startIndex}
      />

      <EnvironmentPagination
        currentPage={filtersStore.currentPage}
        totalPages={totalPages}
        pageSize={filtersStore.pageSize}
        totalItems={total}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <EnvironmentBatchActions
        environments={filteredEnvironments}
        startIndex={startIndex}
        onComplete={refresh}
      />

      <EnvironmentMoveToGroupDialog
        selectedIds={Array.from(selectionStore.selectedIds)}
        groups={availableGroups}
        onComplete={refresh}
        onClearSelection={selectionStore.clearSelection}
      />

      <EnvironmentAssignTagDialog
        selectedIds={Array.from(selectionStore.selectedIds)}
        tags={availableTags}
        onComplete={refresh}
        onClearSelection={selectionStore.clearSelection}
      />

      <EnvironmentManageTagsDialog tags={availableTags} onComplete={refresh} />

      <EnvironmentAssignSingleTagDialog tags={availableTags} onComplete={refresh} />

      <EnvironmentAssignSingleGroupDialog groups={availableGroups} onComplete={refresh} />

      <EnvironmentCreateTagDialog onComplete={refresh} />

      <EnvironmentEditTagDialog onComplete={refresh} />

      <EnvironmentCreateGroupDialog onComplete={refresh} />

      <EnvironmentSelectAccountDialog onComplete={refresh} />

      <EnvironmentCreateAccountDialog onComplete={refresh} />

      <EnvironmentSelectProxyDialog onComplete={refresh} />

      <EnvironmentCreateProxyDialog onComplete={refresh} />

      <EnvironmentDeleteConfirmDialog onComplete={refresh} />

      <EnvironmentBatchDeleteConfirmDialog onComplete={refresh} />

      <EnvironmentBatchPermanentDeleteConfirmDialog onComplete={refresh} />

      <EnvironmentRestoreConfirmDialog onComplete={refresh} />

      <EnvironmentPermanentDeleteConfirmDialog onComplete={refresh} />

      <EnvironmentEditNameDialog onComplete={refresh} />

      <EnvironmentEditNoteDialog onComplete={refresh} />

      <EnvironmentEditUrlDialog onComplete={refresh} />

      <EnvironmentEditCookiesDialog onComplete={refresh} />

      <EnvironmentClearCacheConfirmDialog onComplete={refresh} />
    </div>
  );
}
