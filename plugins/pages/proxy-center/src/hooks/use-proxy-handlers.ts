import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Proxy, ProxyFormData, ExportRange } from '../types';
import { useProxyOperations } from './use-proxy-operations';
import { useProxySelection } from './use-proxy-selection';
import { parseImportData, importProxies } from '../utils/import-export';

interface UseProxyHandlersProps {
  proxies: Proxy[];
  paginatedProxies: Proxy[];
  filteredProxies: Proxy[];
  onRefresh: () => Promise<void>;
}

interface UseProxyHandlersReturn {
  // 对话框状态
  createDialogOpen: boolean;
  editDialogOpen: boolean;
  deleteDialogOpen: boolean;
  batchDeleteDialogOpen: boolean;
  importDialogOpen: boolean;
  exportDialogOpen: boolean;

  // 表单数据
  newProxy: ProxyFormData;
  editProxy: ProxyFormData;
  editingProxy: Proxy | null;
  deletingProxy: Proxy | null;
  importJson: string;
  exportRange: ExportRange;

  // 操作
  operations: ReturnType<typeof useProxyOperations>;

  // 选择
  selection: ReturnType<typeof useProxySelection>;

  // 事件处理
  handleCreateProxy: () => void;
  handleSubmitCreate: (extraData?: { country?: string; city?: string }) => Promise<void>;
  handleEditProxy: (proxy: Proxy) => void;
  handleSubmitEdit: (extraData?: { country?: string; city?: string }) => Promise<void>;
  handleDeleteProxy: (proxy: Proxy) => void;
  handleConfirmDelete: () => Promise<void>;
  handleBatchDelete: () => void;
  handleConfirmBatchDelete: () => Promise<void>;
  handleTestProxy: (proxy: Proxy) => Promise<void>;
  handleBatchTest: () => Promise<void>;
  handleTestAll: () => Promise<void>;
  handleImport: () => void;
  handleSubmitImport: () => Promise<void>;
  handleExport: () => void;
  handleSubmitExport: () => void;

  // 状态更新
  setCreateDialogOpen: (open: boolean) => void;
  setEditDialogOpen: (open: boolean) => void;
  setDeleteDialogOpen: (open: boolean) => void;
  setBatchDeleteDialogOpen: (open: boolean) => void;
  setImportDialogOpen: (open: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;
  setNewProxy: (data: ProxyFormData) => void;
  setEditProxy: (data: ProxyFormData) => void;
  setImportJson: (json: string) => void;
  setExportRange: (range: ExportRange) => void;
}

const defaultFormData: ProxyFormData = {
  name: '',
  host: '',
  port: '',
  type: 'http',
  username: '',
  password: '',
  country: '',
  remark: '',
};

/**
 * 代理操作事件处理 Hook
 * 整合所有代理相关的操作和事件处理逻辑
 */
export function useProxyHandlers({
  proxies,
  paginatedProxies,
  filteredProxies: _filteredProxies,
  onRefresh,
}: UseProxyHandlersProps): UseProxyHandlersReturn {
  const { t } = useTranslation('proxy');

  // 对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // 表单数据
  const [newProxy, setNewProxy] = useState<ProxyFormData>(defaultFormData);
  const [editProxy, setEditProxy] = useState<ProxyFormData>(defaultFormData);
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);
  const [deletingProxy, setDeletingProxy] = useState<Proxy | null>(null);
  const [importJson, setImportJson] = useState('');
  const [exportRange, setExportRange] = useState<ExportRange>('all');

  // 操作逻辑
  const operations = useProxyOperations(() => {
    void onRefresh();
  });

  // 选择管理
  const selection = useProxySelection(paginatedProxies);

  // 创建代理
  const handleCreateProxy = useCallback(() => {
    setNewProxy(defaultFormData);
    setCreateDialogOpen(true);
  }, []);

  const handleSubmitCreate = useCallback(async (extraData?: { country?: string; city?: string }) => {
    if (!newProxy.host.trim()) {
      toast.warning('请填写主机地址');
      return;
    }
    if (!newProxy.port.trim()) {
      toast.warning('请填写端口');
      return;
    }
    try {
      // 自动生成名称
      const name = newProxy.name.trim() || `${newProxy.host}:${newProxy.port}`;
      // 使用 extraData 中的 country 和 city（优先）或 newProxy 中的
      const country = extraData?.country || newProxy.country;
      const city = extraData?.city || newProxy.city;
      await operations.createProxyOp({ ...newProxy, name, country, city });
      setCreateDialogOpen(false);
      setNewProxy(defaultFormData);
      toast.success('创建代理成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建代理失败');
    }
  }, [newProxy, operations]);

  // 编辑代理
  const handleEditProxy = useCallback((proxy: Proxy) => {
    setEditingProxy(proxy);
    setEditProxy({
      name: proxy.name,
      host: proxy.host,
      port: String(proxy.port),
      type: proxy.type,
      country: proxy.country || '',
      username: proxy.username || '',
      password: proxy.password || '',
      remark: proxy.remark || '',
    });
    setEditDialogOpen(true);
  }, []);

  const handleSubmitEdit = useCallback(async (extraData?: { country?: string; city?: string }) => {
    if (!editingProxy) return;
    if (!editProxy.host.trim()) {
      toast.warning('请填写主机地址');
      return;
    }
    if (!editProxy.port.trim()) {
      toast.warning('请填写端口');
      return;
    }
    try {
      const name = editProxy.name.trim() || `${editProxy.host}:${editProxy.port}`;
      // 使用 extraData 中的 country 和 city（优先）或 editProxy 中的
      const country = extraData?.country || editProxy.country;
      const city = extraData?.city || editProxy.city;
      await operations.updateProxyOp(editingProxy.uuid, { ...editProxy, name, country, city });
      setEditDialogOpen(false);
      setEditingProxy(null);
      setEditProxy(defaultFormData);
      toast.success('更新代理成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新代理失败');
    }
  }, [editingProxy, editProxy, operations]);

  // 删除代理
  const handleDeleteProxy = useCallback((proxy: Proxy) => {
    setDeletingProxy(proxy);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingProxy) return;
    try {
      await operations.deleteProxyOp(deletingProxy.uuid);
      setDeleteDialogOpen(false);
      selection.select(deletingProxy.uuid, false);
      setDeletingProxy(null);
      toast.success('删除代理成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除代理失败');
    }
  }, [deletingProxy, operations, selection]);

  // 批量删除
  const handleBatchDelete = useCallback(() => {
    if (selection.selectedIds.size === 0) return;
    setBatchDeleteDialogOpen(true);
  }, [selection.selectedIds.size]);

  const handleConfirmBatchDelete = useCallback(async () => {
    try {
      const uuids = Array.from(selection.selectedIds);
      await operations.batchDeleteProxiesOp(uuids);
      selection.clearSelection();
      setBatchDeleteDialogOpen(false);
      toast.success('批量删除成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量删除失败');
    }
  }, [selection, operations]);

  // 测试单个代理
  const handleTestProxy = useCallback(async (proxy: Proxy) => {
    await operations.testProxy(proxy);
  }, [operations]);

  // 批量测试选中的代理
  const handleBatchTest = useCallback(async () => {
    if (selection.selectedIds.size === 0) {
      toast.warning('请先选择要测试的代理');
      return;
    }
    const selectedProxies = proxies.filter(p => selection.selectedIds.has(p.uuid));
    await operations.batchTestProxies(selectedProxies);
  }, [selection.selectedIds, proxies, operations]);

  // 测试选中的代理（与 batchTest 相同，用于工具栏按钮）
  const handleTestAll = useCallback(async () => {
    if (selection.selectedIds.size === 0) {
      toast.warning('请先选择要测试的代理');
      return;
    }
    const selectedProxies = proxies.filter(p => selection.selectedIds.has(p.uuid));
    await operations.batchTestProxies(selectedProxies);
  }, [selection.selectedIds, proxies, operations]);

  // 导入代理
  const handleImport = useCallback(() => {
    setImportJson('');
    setImportDialogOpen(true);
  }, []);

  const handleSubmitImport = useCallback(async () => {
    if (!importJson.trim()) {
      toast.warning('请输入要导入的代理数据');
      return;
    }
    try {
      const proxiesToImport = parseImportData(importJson);
      const successCount = await importProxies(proxiesToImport);
      if (successCount > 0) {
        await onRefresh();
        toast.success(t('dialog.import.success', { count: successCount }));
      }
      setImportDialogOpen(false);
      setImportJson('');
    } catch (e) {
      toast.error(
        t('dialog.import.error', { message: e instanceof Error ? e.message : '格式错误' })
      );
    }
  }, [importJson, onRefresh, t]);

  // 导出代理
  const handleExport = useCallback(() => {
    setExportRange('all');
    setExportDialogOpen(true);
  }, []);

  const handleSubmitExport = useCallback(() => {
    // 导出逻辑在组件中处理，因为需要访问 filteredProxies
    setExportDialogOpen(false);
  }, []);

  return {
    createDialogOpen,
    editDialogOpen,
    deleteDialogOpen,
    batchDeleteDialogOpen,
    importDialogOpen,
    exportDialogOpen,
    newProxy,
    editProxy,
    editingProxy,
    deletingProxy,
    importJson,
    exportRange,
    operations,
    selection,
    handleCreateProxy,
    handleSubmitCreate,
    handleEditProxy,
    handleSubmitEdit,
    handleDeleteProxy,
    handleConfirmDelete,
    handleBatchDelete,
    handleConfirmBatchDelete,
    handleTestProxy,
    handleBatchTest,
    handleTestAll,
    handleImport,
    handleSubmitImport,
    handleExport,
    handleSubmitExport,
    setCreateDialogOpen,
    setEditDialogOpen,
    setDeleteDialogOpen,
    setBatchDeleteDialogOpen,
    setImportDialogOpen,
    setExportDialogOpen,
    setNewProxy,
    setEditProxy,
    setImportJson,
    setExportRange,
  };
}
