import { useState, useEffect, useCallback } from 'react';
import { extensionRegistry } from '@slotkitjs/core';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { useMihomoRuntimeStore } from '../../../services/store/src';
import { proxyResources } from './i18n/resources';
import { ProxyHeader } from './components/proxy-header';
import { ProxyStats } from './components/proxy-stats';
import { ProxyTable } from './components/proxy-table';
import { ProxyBatchActions } from './components/proxy-batch-actions';
import { ProxyPagination } from './components/proxy-pagination';
import { ProxyCreateDialog } from './components/proxy-create-dialog';
import { ProxyEditDialog } from './components/proxy-edit-dialog';
import { ProxyDeleteDialog } from './components/proxy-delete-dialog';
import { ProxyBatchDeleteDialog } from './components/proxy-batch-delete-dialog';
import { ProxyImportDrawer } from './components/proxy-import-drawer';
import { ProxyExportDialog } from './components/proxy-export-dialog';
import { useProxies } from './hooks/use-proxies';
import { useProxyStats } from './hooks/use-proxy-stats';
import { useSearchPagination } from './hooks/use-search-pagination';
import { useProxyHandlers } from './hooks/use-proxy-handlers';
import { useProxySelection } from './hooks/use-proxy-selection';
import { selectAndReadProxyFile, type ImportProxyItem } from './utils/import-export';
import type { Proxy } from './types';
import { ITEMS_PER_PAGE } from './constants';
import { getLocalMihomoProxies, updateLocalMihomoProxy } from './mihomo/api';
import { MihomoConnectDialog } from './mihomo/mihomo-connect-dialog';
import { MihomoPage } from './mihomo/mihomo-page';
import type { MihomoLocalProxy } from './mihomo/types';

const LOCAL_MIHOMO_CORE_ERROR = 'mihomo-core-unavailable';
const LOCAL_MIHOMO_NOT_CONFIGURED_ERROR = 'mihomo-not-configured';
const LOCAL_MIHOMO_NOT_CONNECTED_ERROR = '当前未连接 Mihomo，请先完成连接配置';

function parseProxyMode(search: string): 'remote' | 'local' {
  return new URLSearchParams(search).get('mode') === 'local' ? 'local' : 'remote';
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const message = Reflect.get(error, 'message');
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

const ProxyCenterPage: React.FC = () => {
  const { t } = useTranslation('proxy');
  const location = useLocation();
  const navigate = useNavigate();
  const mihomoRunning = useMihomoRuntimeStore((state) => state.running);
  const mihomoAttached = useMihomoRuntimeStore((state) => state.attached);

  // 搜索和分页
  const {
    searchQuery,
    proxyType,
    currentPage,
    handleSearchChange,
    handleProxyTypeChange,
    handlePageChange,
  } = useSearchPagination();

  const [proxyMode, setProxyMode] = useState<'remote' | 'local'>(() => parseProxyMode(location.search));

  // 数据获取
  const {
    proxies: fetchedProxies,
    total,
    totalPages,
    loading,
    error,
    refresh,
  } = useProxies({
    page: currentPage,
    pageSize: ITEMS_PER_PAGE,
    searchQuery,
    proxyType,
    enabled: proxyMode === 'remote',
  });
  const [localProxies, setLocalProxies] = useState<Proxy[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // 客户端代理状态管理（用于更新测试后的数据）
  const [allProxies, setAllProxies] = useState(fetchedProxies);

  // 测试状态管理（用于显示加载动画）
  const [testingProxies, setTestingProxies] = useState<Set<string>>(new Set());

  // 同步 fetchedProxies 到 allProxies
  useEffect(() => {
    setAllProxies(fetchedProxies);
  }, [fetchedProxies]);

  useEffect(() => {
    if (currentPage > totalPages) {
      handlePageChange(totalPages);
    }
  }, [currentPage, handlePageChange, totalPages]);

  // 事件处理（整合所有操作）
  const handlers = useProxyHandlers({
    proxies: allProxies,
    paginatedProxies: allProxies,
    filteredProxies: allProxies,
    onRefresh: refresh,
  });

  // 导入抽屉状态
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [importItems, setImportItems] = useState<ImportProxyItem[]>([]);

  // 导出对话框状态
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [mihomoDialogOpen, setMihomoDialogOpen] = useState(false);
  const { clearSelection } = handlers.selection;

  const loadLocalProxies = useCallback(async () => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const items = await getLocalMihomoProxies();
      setLocalProxies(items.map(mapLocalMihomoProxyToProxy));
    } catch (error) {
      const message = extractErrorMessage(error, '获取本地节点代理失败');
      if (message.includes(LOCAL_MIHOMO_NOT_CONNECTED_ERROR)) {
        setLocalError(LOCAL_MIHOMO_NOT_CONFIGURED_ERROR);
      } else {
        setLocalError(message);
      }
      setLocalProxies([]);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  const filteredLocalProxies = localProxies.filter((proxy) => {
    const matchesKeyword =
      !searchQuery.trim() ||
      proxy.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      proxy.host.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      proxy.remark?.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesType = proxyType === 'all' || proxy.type === proxyType;
    return matchesKeyword && matchesType;
  });
  const localSelection = useProxySelection(filteredLocalProxies);

  // 当分页变化时，清除选择
  const handlePageChangeWithClearSelection = useCallback((page: number) => {
    handlePageChange(page);
    clearSelection();
    localSelection.clearSelection();
  }, [clearSelection, handlePageChange, localSelection]);

  const handleSearchChangeWithClearSelection = useCallback((value: string) => {
    handleSearchChange(value);
    clearSelection();
    localSelection.clearSelection();
  }, [clearSelection, handleSearchChange, localSelection]);

  const handleProxyTypeChangeWithClearSelection = useCallback((value: string) => {
    handleProxyTypeChange(value);
    clearSelection();
    localSelection.clearSelection();
  }, [clearSelection, handleProxyTypeChange, localSelection]);

  const handleModeChange = useCallback((mode: 'remote' | 'local') => {
    setProxyMode(mode);
    navigate(mode === 'local' ? '/proxy?mode=local' : '/proxy', { replace: true });
    clearSelection();
    localSelection.clearSelection();
  }, [clearSelection, localSelection, navigate]);

  useEffect(() => {
    setProxyMode(parseProxyMode(location.search));
  }, [location.search]);

  useEffect(() => {
    if (proxyMode !== 'local') {
      return;
    }

    if (!mihomoRunning) {
      setLocalProxies([]);
      setLocalError(LOCAL_MIHOMO_CORE_ERROR);
      setLocalLoading(false);
      return;
    }

    if (proxyMode === 'local') {
      void loadLocalProxies();
    }
  }, [loadLocalProxies, mihomoRunning, proxyMode]);

  // 处理导出：打开确认对话框
  const handleExport = () => {
    setExportDialogOpen(true);
  };

  const handleOpenMihomo = useCallback(async () => {
    if (!mihomoRunning) {
      return;
    }

    await useMihomoRuntimeStore.getState().refresh();
    const { running, attached } = useMihomoRuntimeStore.getState();
    if (!running) {
      return;
    }

    if (attached) {
      navigate('/proxy/mihomo');
      return;
    }

    setMihomoDialogOpen(true);
  }, [mihomoRunning, navigate]);

  // 计算要导出的代理列表
  const proxiesToExport =
      handlers.selection.selectedIds.size > 0
        ? allProxies.filter((p) => handlers.selection.selectedIds.has(p.uuid))
        : allProxies;

  // 处理导入：选择文件后打开抽屉（支持 CSV 和 JSON）
  const handleImport = async () => {
    const items = await selectAndReadProxyFile();
    if (items && items.length > 0) {
      setImportItems(items);
      setImportDrawerOpen(true);
    }
  };

  const activeProxies = proxyMode === 'remote' ? allProxies : filteredLocalProxies;
  const activeLoading = proxyMode === 'remote' ? loading : localLoading;
  const activeError = proxyMode === 'remote' ? error : localError;
  const localCoreAbnormal = proxyMode === 'local' && localError === LOCAL_MIHOMO_CORE_ERROR;
  const localNotConfigured = proxyMode === 'local' && localError === LOCAL_MIHOMO_NOT_CONFIGURED_ERROR;
  const localEmptyStateTitle = localCoreAbnormal
    ? t('localCoreAbnormal.title', { defaultValue: '代理核心状态异常' })
    : localNotConfigured
      ? t('localNotConfigured.title', { defaultValue: '尚未连接 Mihomo' })
      : proxyMode === 'local' && activeError
        ? t('localLoadFailed.title', { defaultValue: '本地代理加载失败' })
        : undefined;
  const localEmptyStateDescription = localCoreAbnormal
    ? t('localCoreAbnormal.description', {
        defaultValue: '未检测到可用的 Mihomo/Clash 核心，请确保核心正常运行。',
      })
    : localNotConfigured
      ? t('localNotConfigured.description', {
          defaultValue: '请先完成 Mihomo 连接配置，然后再查看本地代理节点。',
        })
      : proxyMode === 'local' && activeError
        ? activeError
        : undefined;
  const activeStats = useProxyStats(activeProxies);
  const activeTotal = proxyMode === 'remote' ? total : filteredLocalProxies.length;
  const activeTotalPages = proxyMode === 'remote' ? totalPages : 1;

  // 包装测试代理函数，更新本地状态
  const handleTestProxyWrapper = async (proxy: Proxy) => {
    // 设置测试中状态
    setTestingProxies(prev => new Set(prev).add(proxy.uuid));

    const updatedProxy = await handlers.operations.testProxy(proxy);

    // 移除测试中状态
    setTestingProxies(prev => {
      const newSet = new Set(prev);
      newSet.delete(proxy.uuid);
      return newSet;
    });

    if (updatedProxy) {
      setAllProxies(prev => prev.map(p => p.uuid === updatedProxy.uuid ? updatedProxy : p));
    }
  };

  // 包装批量测试函数
  const handleBatchTestWrapper = async () => {
    const selectedProxies = allProxies.filter(p => handlers.selection.selectedIds.has(p.uuid));
    for (const proxy of selectedProxies) {
      // 设置测试中状态
      setTestingProxies(prev => new Set(prev).add(proxy.uuid));

      const updatedProxy = await handlers.operations.testProxy(proxy);

      // 移除测试中状态
      setTestingProxies(prev => {
        const newSet = new Set(prev);
        newSet.delete(proxy.uuid);
        return newSet;
      });

      if (updatedProxy) {
        setAllProxies(prev => prev.map(p => p.uuid === updatedProxy.uuid ? updatedProxy : p));
      }
    }
  };

  const handleLocalTestProxyWrapper = async (proxy: Proxy) => {
    setTestingProxies(prev => new Set(prev).add(proxy.uuid));

    const testedProxy = await handlers.operations.testProxy(proxy);

    setTestingProxies(prev => {
      const newSet = new Set(prev);
      newSet.delete(proxy.uuid);
      return newSet;
    });

    if (testedProxy) {
      try {
        const persistedProxy = await updateLocalMihomoProxy({
          id: testedProxy.uuid,
          status: testedProxy.status,
          latency_ms: testedProxy.latency ?? null,
          country: testedProxy.country ?? null,
          country_code: testedProxy.countryCode ?? null,
          city: testedProxy.city ?? null,
        });
        const nextProxy = mapLocalMihomoProxyToProxy(persistedProxy);
        setLocalProxies(prev => prev.map(p => p.uuid === nextProxy.uuid ? nextProxy : p));
      } catch {
        setLocalProxies(prev => prev.map(p => p.uuid === testedProxy.uuid ? testedProxy : p));
      }
    }
  };

  const handleLocalBatchTestWrapper = async () => {
    const selectedProxies = localProxies.filter(p => localSelection.selectedIds.has(p.uuid));
    for (const proxy of selectedProxies) {
      setTestingProxies(prev => new Set(prev).add(proxy.uuid));

      const updatedProxy = await handlers.operations.testProxy(proxy);

      setTestingProxies(prev => {
        const newSet = new Set(prev);
        newSet.delete(proxy.uuid);
        return newSet;
      });

      if (updatedProxy) {
        try {
          const persistedProxy = await updateLocalMihomoProxy({
            id: updatedProxy.uuid,
            status: updatedProxy.status,
            latency_ms: updatedProxy.latency ?? null,
            country: updatedProxy.country ?? null,
            country_code: updatedProxy.countryCode ?? null,
            city: updatedProxy.city ?? null,
          });
          const nextProxy = mapLocalMihomoProxyToProxy(persistedProxy);
          setLocalProxies(prev => prev.map(p => p.uuid === nextProxy.uuid ? nextProxy : p));
        } catch {
          setLocalProxies(prev => prev.map(p => p.uuid === updatedProxy.uuid ? updatedProxy : p));
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-50px)] relative">
      <ProxyHeader
        mode={proxyMode}
        searchValue={searchQuery}
        mihomoAttached={mihomoAttached}
        onModeChange={handleModeChange}
        onSearchChange={handleSearchChangeWithClearSelection}
        onOpenMihomo={() => void handleOpenMihomo()}
        onCreateNew={handlers.handleCreateProxy}
        onImport={handleImport}
        onExport={handleExport}
      />

      <ProxyStats
        total={activeTotal}
        healthy={activeStats.healthy}
        unreachable={activeStats.unreachable}
        selectedCount={
          proxyMode === 'remote'
            ? handlers.selection.selectedIds.size
            : localSelection.selectedIds.size
        }
        onTestSelected={
          proxyMode === 'remote' ? handleBatchTestWrapper : handleLocalBatchTestWrapper
        }
      />

      {proxyMode === 'remote' && activeError && (
        <div className="px-6 py-2 text-xs text-destructive">代理列表加载失败：{activeError}</div>
      )}

      <ProxyTable
        proxies={activeProxies}
        proxyTypeFilter={proxyType}
        onProxyTypeFilterChange={handleProxyTypeChangeWithClearSelection}
        selectedIds={
          proxyMode === 'remote' ? handlers.selection.selectedIds : localSelection.selectedIds
        }
        testingIds={testingProxies}
        onSelect={proxyMode === 'remote' ? handlers.selection.select : localSelection.select}
        onSelectAll={
          proxyMode === 'remote'
            ? (selected) => handlers.selection.selectAll(allProxies, selected)
            : (selected) => localSelection.selectAll(filteredLocalProxies, selected)
        }
        onTest={proxyMode === 'remote' ? handleTestProxyWrapper : handleLocalTestProxyWrapper}
        onEdit={proxyMode === 'remote' ? handlers.handleEditProxy : undefined}
        onDelete={proxyMode === 'remote' ? handlers.handleDeleteProxy : undefined}
        loading={activeLoading}
        emptyStateTitle={proxyMode === 'local' ? localEmptyStateTitle : undefined}
        emptyStateDescription={proxyMode === 'local' ? localEmptyStateDescription : undefined}
        emptyStateVariant={proxyMode === 'local' && activeError ? 'warning' : 'default'}
      />

      {proxyMode === 'remote' && (
        <ProxyPagination
          currentPage={currentPage}
          totalPages={activeTotalPages}
          onPageChange={handlePageChangeWithClearSelection}
        />
      )}

      {(proxyMode === 'remote' || localSelection.selectedIds.size > 0) && (
        <ProxyBatchActions
          selectedCount={
            proxyMode === 'remote'
              ? handlers.selection.selectedIds.size
              : localSelection.selectedIds.size
          }
          onClear={
            proxyMode === 'remote'
              ? handlers.selection.clearSelection
              : localSelection.clearSelection
          }
          onTestSelected={
            proxyMode === 'remote' ? handleBatchTestWrapper : handleLocalBatchTestWrapper
          }
          onDelete={proxyMode === 'remote' ? handlers.handleBatchDelete : undefined}
        />
      )}

      {/* 创建代理对话框 */}
      <ProxyCreateDialog
        open={handlers.createDialogOpen}
        formData={handlers.newProxy}
        submitting={handlers.operations.submitting}
        onOpenChange={handlers.setCreateDialogOpen}
        onFormDataChange={handlers.setNewProxy}
        onSubmit={handlers.handleSubmitCreate}
      />

      {/* 编辑代理对话框 */}
      <ProxyEditDialog
        open={handlers.editDialogOpen}
        proxy={handlers.editingProxy}
        formData={handlers.editProxy}
        submitting={handlers.operations.submitting}
        onOpenChange={handlers.setEditDialogOpen}
        onFormDataChange={handlers.setEditProxy}
        onSubmit={handlers.handleSubmitEdit}
      />

      {/* 删除代理确认对话框 */}
      <ProxyDeleteDialog
        open={handlers.deleteDialogOpen}
        proxy={handlers.deletingProxy}
        onOpenChange={handlers.setDeleteDialogOpen}
        onConfirm={handlers.handleConfirmDelete}
      />

      {/* 批量删除确认对话框 */}
      <ProxyBatchDeleteDialog
        open={handlers.batchDeleteDialogOpen}
        count={handlers.selection.selectedIds.size}
        onOpenChange={handlers.setBatchDeleteDialogOpen}
        onConfirm={handlers.handleConfirmBatchDelete}
      />

      {/* 导入代理抽屉 */}
      <ProxyImportDrawer
        open={importDrawerOpen}
        items={importItems}
        onOpenChange={setImportDrawerOpen}
        onComplete={refresh}
      />

      {/* 导出代理确认对话框 */}
      <ProxyExportDialog
        open={exportDialogOpen}
        proxies={proxiesToExport}
        onOpenChange={setExportDialogOpen}
      />

      <MihomoConnectDialog
        open={mihomoDialogOpen}
        onOpenChange={setMihomoDialogOpen}
        onConnected={() => {
          void useMihomoRuntimeStore.getState().refresh();
          navigate('/proxy/mihomo');
        }}
      />
    </div>
  );
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'proxy-center',
    value: {
      path: '/proxy',
      Component: ProxyCenterPage,
    },
    priority: 10,
  });
  console.log('[proxy-center] Route contributed at module load: /proxy');
} catch (error) {
  console.warn('[proxy-center] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('routes', {
    contributorId: 'proxy-center-mihomo',
    value: {
      path: '/proxy/mihomo',
      Component: MihomoPage,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[proxy-center] Failed to contribute Mihomo route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'proxy-center',
    value: {
      namespace: 'proxy',
      resources: proxyResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[proxy-center] Failed to contribute i18n resources:', error);
}

const proxyCenterPlugin = {
  id: 'proxy-center',
  name: 'Proxy Center',
  version: '1.0.0',
  component: ProxyCenterPage,
  slots: [],
};

export default proxyCenterPlugin;

function mapLocalMihomoProxyToProxy(proxy: MihomoLocalProxy): Proxy {
  const status =
    proxy.status === 'healthy' || proxy.status === 'unreachable' || proxy.status === 'unknown'
      ? proxy.status
      : proxy.status === 'ready'
        ? 'unknown'
        : 'unreachable';
  return {
    id: 0,
    uuid: proxy.id,
    name: proxy.name,
    host: proxy.listen_host,
    port: proxy.listen_port,
    type: proxy.proxy_scheme as Proxy['type'],
    status,
    latency: proxy.latency_ms ?? undefined,
    environmentsCount: 0,
    createdAt: proxy.created_at,
    updatedAt: proxy.updated_at,
    remark: proxy.node_name,
    country: proxy.country || 'LOCAL',
    countryCode: proxy.country_code || undefined,
    city: proxy.city || undefined,
  };
}
