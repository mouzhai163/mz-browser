import { extensionRegistry } from '@slotkitjs/core';
import { useTranslation } from 'react-i18next';
import { groupResources } from './i18n/resources';
import { GroupHeader } from './components/group-header';
import { GroupTable } from './components/group-table';
import { GroupBatchActions } from './components/group-batch-actions';
import { GroupPagination } from './components/group-pagination';
import { GroupCreateDialog } from './components/group-create-dialog';
import { GroupEditDialog } from './components/group-edit-dialog';
import { GroupDeleteDialog } from './components/group-delete-dialog';
import { GroupBatchDeleteDialog } from './components/group-batch-delete-dialog';
import { useGroups } from './hooks/use-groups';
import { useGroupFilters } from './hooks/use-group-filters';
import { useGroupPagination } from './hooks/use-group-pagination';
import { useSearchPagination } from './hooks/use-search-pagination';
import { useGroupHandlers } from './hooks/use-group-handlers';

const GroupManagementPage: React.FC = () => {
  useTranslation('groups'); // 注册 i18n namespace

  // 搜索和分页
  const { searchQuery, currentPage, handleSearchChange, handlePageChange } = useSearchPagination();

  // 数据获取
  const { groups: allGroups, loading, error, refresh } = useGroups();

  // 过滤
  const filteredGroups = useGroupFilters(allGroups, searchQuery);

  // 分页
  const { paginatedGroups, totalPages } = useGroupPagination(filteredGroups, currentPage);

  // 事件处理（整合所有操作）
  const handlers = useGroupHandlers({
    groups: allGroups,
    paginatedGroups,
    onRefresh: refresh,
  });

  // 当分页变化时，清除选择
  const handlePageChangeWithClearSelection = (page: number) => {
    handlePageChange(page);
    handlers.selection.clearSelection();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-50px)] relative">
      <GroupHeader onSearchChange={handleSearchChange} onCreateNew={handlers.handleCreateGroup} />

      {error && <div className="px-6 py-2 text-xs text-destructive">分组列表加载失败：{error}</div>}

      <GroupTable
        groups={paginatedGroups}
        selectedIds={handlers.selection.selectedIds}
        onSelect={handlers.selection.select}
        onSelectAll={(selected) => handlers.selection.selectAll(paginatedGroups, selected)}
        onEdit={handlers.handleEditGroup}
        onDelete={handlers.handleDeleteGroup}
        loading={loading}
      />

      <GroupPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChangeWithClearSelection}
      />

      <GroupBatchActions
        selectedCount={handlers.selection.selectedIds.size}
        onClear={handlers.selection.clearSelection}
        onDelete={handlers.handleBatchDelete}
      />

      {/* 创建分组对话框 */}
      <GroupCreateDialog
        open={handlers.createDialogOpen}
        formData={handlers.newGroup}
        submitting={handlers.operations.submitting}
        onOpenChange={handlers.setCreateDialogOpen}
        onFormDataChange={handlers.setNewGroup}
        onSubmit={handlers.handleSubmitCreate}
      />

      {/* 编辑分组对话框 */}
      <GroupEditDialog
        open={handlers.editDialogOpen}
        group={handlers.editingGroup}
        formData={handlers.editGroup}
        submitting={handlers.operations.submitting}
        onOpenChange={handlers.setEditDialogOpen}
        onFormDataChange={handlers.setEditGroup}
        onSubmit={handlers.handleSubmitEdit}
      />

      {/* 删除分组确认对话框 */}
      <GroupDeleteDialog
        open={handlers.deleteDialogOpen}
        group={handlers.deletingGroup}
        onOpenChange={handlers.setDeleteDialogOpen}
        onConfirm={handlers.handleConfirmDelete}
      />

      {/* 批量删除确认对话框 */}
      <GroupBatchDeleteDialog
        open={handlers.batchDeleteDialogOpen}
        count={handlers.selection.selectedIds.size}
        onOpenChange={handlers.setBatchDeleteDialogOpen}
        onConfirm={handlers.handleConfirmBatchDelete}
      />
    </div>
  );
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'group-management',
    value: {
      path: '/groups',
      Component: GroupManagementPage,
    },
    priority: 10,
  });
  console.log('[group-management] Route contributed at module load: /groups');
} catch (error) {
  console.warn('[group-management] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'group-management',
    value: {
      namespace: 'groups',
      resources: groupResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[group-management] Failed to contribute i18n resources:', error);
}

const groupManagementPlugin = {
  id: 'group-management',
  name: 'Group Management',
  version: '1.0.0',
  component: GroupManagementPage,
  slots: [],
};

export default groupManagementPlugin;
