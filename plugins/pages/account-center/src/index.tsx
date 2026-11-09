import { useState, useEffect, useCallback } from 'react';
import { extensionRegistry } from '@slotkitjs/core';
import { useTranslation } from 'react-i18next';
import { accountResources } from './i18n/resources';
import { AccountHeader } from './components/account-header';
import { AccountStats } from './components/account-stats';
import { AccountTable } from './components/account-table';
import { AccountBatchActions } from './components/account-batch-actions';
import { AccountPagination } from './components/account-pagination';
import { AccountCreateDialog } from './components/account-create-dialog';
import { AccountEditDialog } from './components/account-edit-dialog';
import { AccountDeleteDialog } from './components/account-delete-dialog';
import { AccountBatchDeleteDialog } from './components/account-batch-delete-dialog';
import { AccountImportDrawer } from './components/account-import-drawer';
import { AccountExportConfirmDialog } from './components/account-export-confirm-dialog';
import { useAccounts } from './hooks/use-accounts';
import { useAccountStats } from './hooks/use-account-stats';
import { useSearchPagination } from './hooks/use-search-pagination';
import { useAccountHandlers } from './hooks/use-account-handlers';
import { selectAndReadAccountFile, type ImportAccountItem } from './utils/import-export';
import { PAGE_SIZE } from './constants';

const AccountCenterPage: React.FC = () => {
  useTranslation('account'); // 注册 i18n namespace

  // 搜索和分页
  const { searchQuery, currentPage, handleSearchChange, handlePageChange } = useSearchPagination();

  // 数据获取
  const { accounts: allAccounts, total, totalPages, loading, error, refresh } = useAccounts({
    page: currentPage,
    pageSize: PAGE_SIZE,
    searchQuery,
  });

  useEffect(() => {
    if (currentPage > totalPages) {
      handlePageChange(totalPages);
    }
  }, [currentPage, handlePageChange, totalPages]);

  // 统计
  const stats = useAccountStats(allAccounts);

  // 事件处理（整合所有操作）
  const handlers = useAccountHandlers({
    accounts: allAccounts,
    paginatedAccounts: allAccounts,
    filteredAccounts: allAccounts,
    onRefresh: refresh,
  });

  // 导入抽屉状态
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [importItems, setImportItems] = useState<ImportAccountItem[]>([]);
  const { clearSelection } = handlers.selection;

  // 导出对话框状态
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // 当分页变化时，清除选择
  const handlePageChangeWithClearSelection = useCallback((page: number) => {
    handlePageChange(page);
    clearSelection();
  }, [clearSelection, handlePageChange]);

  const handleSearchChangeWithClearSelection = useCallback((query: string) => {
    handleSearchChange(query);
    clearSelection();
  }, [clearSelection, handleSearchChange]);

  // 处理导出：打开确认对话框
  const handleExport = () => {
    setExportDialogOpen(true);
  };

  // 计算要导出的账号列表
    const accountsToExport =
      handlers.selection.selectedIds.size > 0
        ? allAccounts.filter((a) => handlers.selection.selectedIds.has(a.uuid))
        : allAccounts;

  // 处理导入
  const handleImport = async () => {
    const items = await selectAndReadAccountFile();
    if (items && items.length > 0) {
      setImportItems(items);
      setImportDrawerOpen(true);
    }
  };

  // 导入完成后刷新数据
  const handleImportComplete = () => {
    refresh();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-50px)] relative">
      <AccountHeader
        onSearchChange={handleSearchChangeWithClearSelection}
        onCreateNew={handlers.handleCreateAccount}
        onImport={handleImport}
        onExport={handleExport}
      >
        <AccountStats
          total={total}
          active={stats.active}
          inactive={stats.inactive}
          expired={stats.expired}
        />
      </AccountHeader>

      {error && <div className="px-6 py-2 text-xs text-destructive">账号列表加载失败：{error}</div>}

      <AccountTable
        accounts={allAccounts}
        selectedIds={handlers.selection.selectedIds}
        onSelect={handlers.selection.select}
        onSelectAll={(selected) => handlers.selection.selectAll(allAccounts, selected)}
        onEdit={handlers.handleEditAccount}
        onDelete={handlers.handleDeleteAccount}
        loading={loading}
      />

      <AccountPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChangeWithClearSelection}
      />

      <AccountBatchActions
        selectedCount={handlers.selection.selectedIds.size}
        onClear={handlers.selection.clearSelection}
        onDelete={handlers.handleBatchDelete}
      />

      {/* 创建账号对话框 */}
      <AccountCreateDialog
        open={handlers.createDialogOpen}
        formData={handlers.newAccount}
        submitting={handlers.operations.submitting}
        onOpenChange={handlers.setCreateDialogOpen}
        onFormDataChange={handlers.setNewAccount}
        onSubmit={handlers.handleSubmitCreate}
      />

      {/* 编辑账号对话框 */}
      <AccountEditDialog
        open={handlers.editDialogOpen}
        account={handlers.editingAccount}
        formData={handlers.editAccount}
        submitting={handlers.operations.submitting}
        onOpenChange={handlers.setEditDialogOpen}
        onFormDataChange={handlers.setEditAccount}
        onSubmit={handlers.handleSubmitEdit}
      />

      {/* 删除账号确认对话框 */}
      <AccountDeleteDialog
        open={handlers.deleteDialogOpen}
        account={handlers.deletingAccount}
        onOpenChange={handlers.setDeleteDialogOpen}
        onConfirm={handlers.handleConfirmDelete}
      />

      {/* 批量删除确认对话框 */}
      <AccountBatchDeleteDialog
        open={handlers.batchDeleteDialogOpen}
        count={handlers.selection.selectedIds.size}
        onOpenChange={handlers.setBatchDeleteDialogOpen}
        onConfirm={handlers.handleConfirmBatchDelete}
      />

      {/* 导入账号抽屉 */}
      <AccountImportDrawer
        open={importDrawerOpen}
        items={importItems}
        onOpenChange={setImportDrawerOpen}
        onComplete={handleImportComplete}
      />

      {/* 导出账号确认对话框 */}
      <AccountExportConfirmDialog
        open={exportDialogOpen}
        accounts={accountsToExport}
        onOpenChange={setExportDialogOpen}
      />
    </div>
  );
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'account-center',
    value: {
      path: '/accounts',
      Component: AccountCenterPage,
    },
    priority: 10,
  });
  console.log('[account-center] Route contributed at module load: /accounts');
} catch (error) {
  console.warn('[account-center] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'account-center',
    value: {
      namespace: 'account',
      resources: accountResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[account-center] Failed to contribute i18n resources:', error);
}

const accountCenterPlugin = {
  id: 'account-center',
  name: 'Account Center',
  version: '1.0.0',
  component: AccountCenterPage,
  slots: [],
};

export default accountCenterPlugin;
