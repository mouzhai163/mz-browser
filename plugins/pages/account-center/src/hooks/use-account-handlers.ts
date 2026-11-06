import { useState, useCallback } from 'react';
import type { Account, AccountFormData, ExportRange } from '../types';
import { useAccountSelection } from './use-account-selection';
import { useAccountOperations } from './use-account-operations';
import { decryptAccountPassword } from '../utils/password';

interface UseAccountHandlersProps {
  accounts: Account[];
  paginatedAccounts: Account[];
  filteredAccounts: Account[];
  onRefresh: () => void;
}

const emptyFormData: AccountFormData = {
  platform: '',
  account: '',
  password: '',
  remark: '',
};

export function useAccountHandlers({ paginatedAccounts, onRefresh }: UseAccountHandlersProps) {
  // 选择状态
  const selection = useAccountSelection();

  // 操作
  const operations = useAccountOperations(onRefresh);

  // 对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // 表单状态
  const [newAccount, setNewAccount] = useState<AccountFormData>(emptyFormData);
  const [editAccount, setEditAccount] = useState<AccountFormData>(emptyFormData);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [importJson, setImportJson] = useState('');
  const [exportRange, setExportRange] = useState<ExportRange>('all');

  // 创建账号
  const handleCreateAccount = useCallback(() => {
    setNewAccount(emptyFormData);
    setCreateDialogOpen(true);
  }, []);

  const handleSubmitCreate = useCallback(async () => {
    try {
      await operations.createAccount(newAccount);
      setCreateDialogOpen(false);
      setNewAccount(emptyFormData);
    } catch {
      // 错误已在 operations 中处理
    }
  }, [operations, newAccount]);

  // 编辑账号
  const handleEditAccount = useCallback((account: Account) => {
    setEditingAccount(account);
    setEditAccount({
      platform: account.platform,
      account: account.account,
      password: '',
      remark: account.remark || '',
    });
    setEditDialogOpen(true);

    void (async () => {
      try {
        const plainPassword = await decryptAccountPassword(account);
        setEditAccount({
          platform: account.platform,
          account: account.account,
          password: plainPassword,
          remark: account.remark || '',
        });
      } catch {
        // 行内查看/复制处会提示，这里保持表单可编辑即可
      }
    })();
  }, []);

  const handleSubmitEdit = useCallback(async () => {
    if (!editingAccount) return;
    try {
      await operations.updateAccount(editingAccount.uuid, editAccount);
      setEditDialogOpen(false);
      setEditingAccount(null);
    } catch {
      // 错误已在 operations 中处理
    }
  }, [operations, editingAccount, editAccount]);

  // 删除账号
  const handleDeleteAccount = useCallback((account: Account) => {
    setDeletingAccount(account);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingAccount) return;
    try {
      await operations.deleteAccount(deletingAccount.uuid);
      setDeleteDialogOpen(false);
      setDeletingAccount(null);
      selection.select(deletingAccount.uuid, false);
    } catch {
      // 错误已在 operations 中处理
    }
  }, [operations, deletingAccount, selection]);

  // 批量删除
  const handleBatchDelete = useCallback(() => {
    setBatchDeleteDialogOpen(true);
  }, []);

  const handleConfirmBatchDelete = useCallback(async () => {
    try {
      await operations.batchDeleteAccounts(Array.from(selection.selectedIds));
      setBatchDeleteDialogOpen(false);
      selection.clearSelection();
    } catch {
      // 错误已在 operations 中处理
    }
  }, [operations, selection]);

  // 导入
  const handleImport = useCallback(() => {
    setImportJson('');
    setImportDialogOpen(true);
  }, []);

  const handleSubmitImport = useCallback(async () => {
    try {
      const accountsData = JSON.parse(importJson) as AccountFormData[];
      await operations.importAccounts(Array.isArray(accountsData) ? accountsData : [accountsData]);
      setImportDialogOpen(false);
      setImportJson('');
    } catch {
      // 错误已在 operations 中处理
    }
  }, [operations, importJson]);

  // 导出
  const handleExport = useCallback(() => {
    setExportRange('all');
    setExportDialogOpen(true);
  }, []);

  return {
    // 选择
    selection: {
      ...selection,
      isAllSelected: () => selection.isAllSelected(paginatedAccounts),
    },

    // 操作
    operations,

    // 创建相关
    createDialogOpen,
    setCreateDialogOpen,
    newAccount,
    setNewAccount,
    handleCreateAccount,
    handleSubmitCreate,

    // 编辑相关
    editDialogOpen,
    setEditDialogOpen,
    editAccount,
    setEditAccount,
    editingAccount,
    handleEditAccount,
    handleSubmitEdit,

    // 删除相关
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletingAccount,
    handleDeleteAccount,
    handleConfirmDelete,

    // 批量删除相关
    batchDeleteDialogOpen,
    setBatchDeleteDialogOpen,
    handleBatchDelete,
    handleConfirmBatchDelete,

    // 导入相关
    importDialogOpen,
    setImportDialogOpen,
    importJson,
    setImportJson,
    handleImport,
    handleSubmitImport,

    // 导出相关
    exportDialogOpen,
    setExportDialogOpen,
    exportRange,
    setExportRange,
    handleExport,
  };
}
