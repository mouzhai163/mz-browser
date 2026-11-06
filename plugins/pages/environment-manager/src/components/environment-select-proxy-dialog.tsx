import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Plus,
  Search,
  Zap,
  WifiOff,
  X,
  Activity,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { useEnvironmentDialogStore, useRunningEnvsStore } from '../stores';
import {
  listProxies,
  deleteProxy,
  refreshEnvironmentProxy,
  ProxyItem,
  setEnvironmentProxy,
} from '../api';
import {
  getEnvironmentLocalProxyBindings,
  removeEnvironmentLocalProxyBinding,
  setEnvironmentLocalProxyBinding,
} from '../../../../services/store/src';
import {
  getLocalMihomoProxyRecords,
  mapLocalMihomoProxyToProxyCandidate,
  type EnvironmentProxyCandidate,
} from '../utils';

interface EnvironmentSelectProxyDialogProps {
  onComplete?: () => void;
}

/**
 * 客户端代理检测状态
 */
type ProxyTestStatus = 'untested' | 'testing' | 'healthy' | 'unhealthy';

interface ProxyTestResult {
  status: ProxyTestStatus;
  ip?: string;
  country?: string;
  country_code?: string;
  latency?: number;
  error?: string;
}

/**
 * 获取状态样式
 */
const getStatusStyle = (status: ProxyTestStatus, t: (key: string) => string) => {
  switch (status) {
    case 'healthy':
      return {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-600 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: t('dialog.proxy.statusHealthy') || '健康',
      };
    case 'unhealthy':
      return {
        bg: 'bg-red-500/15',
        text: 'text-red-600 dark:text-red-400',
        dot: 'bg-red-500',
        label: t('dialog.proxy.statusUnhealthy') || '不可用',
      };
    case 'testing':
      return {
        bg: 'bg-blue-500/15',
        text: 'text-blue-600 dark:text-blue-400',
        dot: 'bg-blue-500 animate-pulse',
        label: t('dialog.proxy.statusTesting') || '检测中',
      };
    default: // untested
      return {
        bg: 'bg-gray-500/15',
        text: 'text-gray-500',
        dot: 'bg-gray-400',
        label: t('dialog.proxy.statusUntested') || '未检测',
      };
  }
};

const getProxyInfoText = (proxy: EnvironmentProxyCandidate) => {
  // 本地代理优先显示节点名，远程代理显示 host:port
  return proxy.source === 'local' ? proxy.name : `${proxy.host}:${proxy.port}`;
};

const getProxyCategoryText = (proxy: EnvironmentProxyCandidate) => {
  // 分类优先用 proxy_type，保持简洁大写
  return (proxy.proxy_type || '-').toUpperCase();
};

const getProxyRemarkText = (proxy: EnvironmentProxyCandidate) => {
  if (proxy.remark) return proxy.remark;
  if (proxy.country && proxy.city) return `${proxy.country} · ${proxy.city}`;
  if (proxy.country) return proxy.country;
  if (proxy.city) return proxy.city;
  return '-';
};

const getAssociatedText = (proxy: EnvironmentProxyCandidate) => {
  if (typeof proxy.environments_count === 'number') return String(proxy.environments_count);
  return '-';
};

const createSingleSelection = (proxyUuid?: string) => {
  return proxyUuid ? new Set([proxyUuid]) : new Set<string>();
};

const LOCAL_PROXY_LOAD_FAILED = '加载本地代理失败';

/**
 * 空状态组件
 */
const EmptyState: React.FC<{
  title: string;
  description: string;
}> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      <WifiOff className="h-8 w-8 text-blue-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{title}</h4>
    <p className="text-xs text-muted-foreground text-center max-w-[240px]">
      {description}
    </p>
  </div>
);

/**
 * 选择代理对话框
 */
export function EnvironmentSelectProxyDialog({ onComplete }: EnvironmentSelectProxyDialogProps) {
  const { t } = useTranslation('environment');
  const dialogStore = useEnvironmentDialogStore();
  const runningEnvsStore = useRunningEnvsStore();

  // 代理列表
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [loadingProxies, setLoadingProxies] = useState(false);
  const [localProxies, setLocalProxies] = useState<EnvironmentProxyCandidate[]>([]);
  const [loadingLocalProxies, setLoadingLocalProxies] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [proxySourceMode, setProxySourceMode] = useState<'remote' | 'local'>('remote');

  // 客户端检测状态管理（key: proxy.uuid, value: 检测结果）
  const [proxyTestResults, setProxyTestResults] = useState<Map<string, ProxyTestResult>>(new Map());

  // 选中的代理 UUID（使用 Set 以匹配 DataTable）
  const [selectedProxyUuids, setSelectedProxyUuids] = useState<Set<string>>(new Set());
  const [initialSelection, setInitialSelection] = useState<{
    mode: 'remote' | 'local' | null;
    key?: string;
  }>({ mode: null });
  const [submitting, setSubmitting] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proxyToDelete, setProxyToDelete] = useState<ProxyItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const remoteProxies = useMemo<EnvironmentProxyCandidate[]>(
    () => proxies.map((proxy) => ({ ...proxy, source: 'remote' })),
    [proxies]
  );
  const currentProxies = proxySourceMode === 'remote' ? remoteProxies : localProxies;
  const currentLoading = proxySourceMode === 'remote' ? loadingProxies : loadingLocalProxies;

  // 过滤后的代理列表
  const filteredProxies = useMemo(() => {
    if (!searchQuery.trim()) return currentProxies;
    const query = searchQuery.toLowerCase();
    return currentProxies.filter(
      (proxy) =>
        proxy.name.toLowerCase().includes(query) ||
        proxy.host.toLowerCase().includes(query) ||
        proxy.proxy_type.toLowerCase().includes(query) ||
        proxy.country?.toLowerCase().includes(query)
    );
  }, [currentProxies, searchQuery]);

  const totalPages = useMemo(() => {
    const total = filteredProxies.length;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [filteredProxies.length, pageSize]);

  const currentPage = Math.min(page, totalPages);

  const pagedProxies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProxies.slice(start, start + pageSize);
  }, [filteredProxies, currentPage, pageSize]);

  const selectedSingleProxyUuid =
    selectedProxyUuids.size === 1 ? Array.from(selectedProxyUuids)[0] : '';
  const canSaveSelection =
    selectedProxyUuids.size === 1 &&
    currentProxies.some((proxy) => proxy.uuid === selectedSingleProxyUuid);

  // 加载代理列表
  useEffect(() => {
    if (dialogStore.selectProxyDialogOpen) {
      void loadProxies();
      void loadLocalProxies();
      setSearchQuery('');
      setPage(1);
    }
  }, [dialogStore.selectProxyDialogOpen]);

  // 当环境变化时，设置当前代理
  useEffect(() => {
    let cancelled = false;

    const syncSelection = async () => {
      const environment = dialogStore.selectProxyEnvironment;
      if (!environment || !dialogStore.selectProxyDialogOpen) {
        setInitialSelection({ mode: null });
        setSelectedProxyUuids(createSingleSelection());
        setProxySourceMode('remote');
        return;
      }

      const bindings = await getEnvironmentLocalProxyBindings().catch(() => ({}));
      if (cancelled) {
        return;
      }

      const binding = bindings[environment.uuid];
      if (binding) {
        setProxySourceMode('local');
        setInitialSelection({ mode: 'local', key: binding.node_name });
        setSelectedProxyUuids(createSingleSelection(binding.node_name));
        return;
      }

      const remoteProxyUuid =
        environment.proxy?.source === 'local' ? undefined : environment.proxy?.uuid;
      setProxySourceMode('remote');
      setInitialSelection({ mode: 'remote', key: remoteProxyUuid });
      setSelectedProxyUuids(createSingleSelection(remoteProxyUuid));
    };

    void syncSelection();

    return () => {
      cancelled = true;
    };
  }, [dialogStore.selectProxyDialogOpen, dialogStore.selectProxyEnvironment]);

  const loadProxies = async () => {
    setLoadingProxies(true);
    try {
      const list = await listProxies();
      setProxies(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.proxy.loadFailed'));
    } finally {
      setLoadingProxies(false);
    }
  };

  const loadLocalProxies = async () => {
    setLoadingLocalProxies(true);
    setLocalError(null);
    try {
      const list = await getLocalMihomoProxyRecords();
      setLocalProxies(list.map(mapLocalMihomoProxyToProxyCandidate));
    } catch (e) {
      setLocalProxies([]);
      setLocalError(e instanceof Error ? e.message : LOCAL_PROXY_LOAD_FAILED);
    } finally {
      setLoadingLocalProxies(false);
    }
  };

  // 打开创建代理弹窗
  const handleOpenCreateProxy = () => {
    dialogStore.openCreateProxyDialog();
  };

  // 保存代理设置
  const handleSave = async () => {
    const environment = dialogStore.selectProxyEnvironment;
    if (!environment) return;

    if (selectedProxyUuids.size !== 1) {
      toast.warning(t('dialog.proxy.selectRequired'));
      return;
    }

    const nextProxyUuid = selectedSingleProxyUuid || undefined;
    const proxyChanged =
      initialSelection.mode !== proxySourceMode || initialSelection.key !== nextProxyUuid;
    const nextProxy = currentProxies.find((proxy) => proxy.uuid === nextProxyUuid);

    setSubmitting(true);
    try {
      if (proxySourceMode === 'local') {
        const localNodeName = nextProxy?.node_name ?? nextProxy?.uuid;
        if (!localNodeName || !nextProxy) {
          toast.warning(t('dialog.proxy.selectRequired'));
          return;
        }

        await setEnvironmentLocalProxyBinding(environment.uuid, localNodeName);
      } else {
        await removeEnvironmentLocalProxyBinding(environment.uuid);
        await setEnvironmentProxy({
          uuid: environment.uuid,
          proxy_uuid: nextProxyUuid,
        });
      }

      if (proxyChanged && runningEnvsStore.isRunning(environment.uuid)) {
        await refreshEnvironmentProxy(environment.uuid, nextProxy ?? null);
      }
      dialogStore.closeSelectProxyDialog();
      toast.success(t('dialog.proxy.saveSuccess'));
      onComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dialog.proxy.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const environmentName =
    dialogStore.selectProxyEnvironment?.name || t('dialog.proxy.defaultEnvName');

  // 测试单个代理
  const handleTestProxy = async (proxy: EnvironmentProxyCandidate) => {
    // 设置为检测中状态
    setProxyTestResults(prev => new Map(prev).set(proxy.uuid, { status: 'testing' }));

    try {
      const result = await invoke<{
        success: boolean;
        ip_info?: { ip: string; country: string; country_code: string };
        latency_ms?: number;
        error?: string;
      }>('test_proxy', {
        config: {
          proxy_type: proxy.proxy_type,
          host: proxy.host,
          port: proxy.port,
          username: proxy.username || null,
          password: proxy.password
            ? { value: proxy.password, encrypted: false }
            : null,
        },
      });

      if (result.success && result.ip_info) {
        // 更新为健康状态
        setProxyTestResults(prev => new Map(prev).set(proxy.uuid, {
          status: 'healthy',
          ip: result.ip_info!.ip,
          country: result.ip_info!.country,
          country_code: result.ip_info!.country_code,
          latency: result.latency_ms,
        }));
      } else {
        // 更新为不健康状态
        setProxyTestResults(prev => new Map(prev).set(proxy.uuid, {
          status: 'unhealthy',
          error: result.error || '连接失败',
        }));
      }
    } catch (e) {
      // 更新为不健康状态
      const errorMsg = e instanceof Error ? e.message : String(e);
      setProxyTestResults(prev => new Map(prev).set(proxy.uuid, {
        status: 'unhealthy',
        error: errorMsg,
      }));
    }
  };

  // 批量测试选中的代理
  const [testingSelected, setTestingSelected] = useState(false);
  const handleTestSelected = async () => {
    if (selectedProxyUuids.size === 0) return;
    const selectedProxies = currentProxies.filter(p => selectedProxyUuids.has(p.uuid));
    if (selectedProxies.length === 0) return;

    setTestingSelected(true);
    
    for (const proxy of selectedProxies) {
      await handleTestProxy(proxy);
    }
    
    setTestingSelected(false);
  };

  // 打开删除确认对话框
  const handleDeleteProxy = (proxy: EnvironmentProxyCandidate) => {
    if (proxy.source !== 'remote') {
      return;
    }
    setProxyToDelete(proxy);
    setDeleteDialogOpen(true);
  };

  // 确认删除代理
  const handleConfirmDelete = async () => {
    if (!proxyToDelete) return;

    setDeleting(true);
    try {
      await deleteProxy({ uuid: proxyToDelete.uuid });
      toast.success(t('dialog.proxy.deleteSuccess') || '删除代理成功');
      // 从列表中移除已删除的代理
      setProxies((prev) => prev.filter((p) => p.uuid !== proxyToDelete.uuid));
      // 如果删除的代理在选中列表中，也要移除
      const newSelected = new Set(selectedProxyUuids);
      newSelected.delete(proxyToDelete.uuid);
      setSelectedProxyUuids(newSelected);
      setDeleteDialogOpen(false);
      setProxyToDelete(null);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('dialog.proxy.deleteFailed') || '删除代理失败'
      );
    } finally {
      setDeleting(false);
    }
  };

  // 定义列配置
  const columns: ColumnDef<EnvironmentProxyCandidate>[] = useMemo(
    () => [
      {
        id: 'info',
        header: t('dialog.proxy.tableHeaderInfo'),
        cell: ({ row }) => {
          // 使用本地检测状态，默认为未检测
          const testResult = proxyTestResults.get(row.uuid);
          const status: ProxyTestStatus = testResult?.status || 'untested';
          const statusStyle = getStatusStyle(status, t);
          
          return (
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground font-mono truncate">
                {getProxyInfoText(row)}
              </div>
              <span
                className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                {statusStyle.label}
                {testResult?.latency && (
                  <span className="ml-1">{testResult.latency}ms</span>
                )}
              </span>
              {testResult?.status === 'healthy' && testResult.country && testResult.country_code && (
                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {testResult.country_code} | {testResult.country}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'category',
        header: t('dialog.proxy.tableHeaderCategory'),
        width: 96,
        cell: ({ row }) => (
              <span className="text-[10px] font-semibold text-muted-foreground">
                {getProxyCategoryText(row)}
              </span>
        ),
      },
      {
        id: 'associated',
        header: t('dialog.proxy.tableHeaderAssociated'),
        width: 96,
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground font-mono">{getAssociatedText(row)}</span>
        ),
      },
      {
        id: 'actions',
        header: t('dialog.proxy.tableHeaderActions'),
        width: 112,
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                void handleTestProxy(row);
              }}
              disabled={proxyTestResults.get(row.uuid)?.status === 'testing'}
              title={t('dialog.proxy.testButton')}
            >
              {proxyTestResults.get(row.uuid)?.status === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
            </Button>
            {row.source === 'remote' && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteProxy(row);
                }}
                title={t('dialog.proxy.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [t, proxyTestResults]
  );

  const renderPageItems = () => {
    // 简单分页：最多展示 7 个按钮（含省略）
    const max = totalPages;
    const p = currentPage;
    const pages: (number | 'ellipsis')[] = [];
    if (max <= 7) {
      for (let i = 1; i <= max; i++) pages.push(i);
    } else {
      pages.push(1);
      const left = Math.max(2, p - 1);
      const right = Math.min(max - 1, p + 1);
      if (left > 2) pages.push('ellipsis');
      for (let i = left; i <= right; i++) pages.push(i);
      if (right < max - 1) pages.push('ellipsis');
      pages.push(max);
    }

    return pages.map((it, idx) => {
      if (it === 'ellipsis') {
        return (
          <PaginationItem key={`e-${idx}`}>
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      const pageNum = it;
      return (
        <PaginationItem key={pageNum}>
          <PaginationLink
            href="#"
            isActive={pageNum === currentPage}
            size="sm"
            className="h-7 w-7 text-xs"
            onClick={(e) => {
              e.preventDefault();
              setPage(pageNum);
            }}
          >
            {pageNum}
          </PaginationLink>
        </PaginationItem>
      );
    });
  };

  return (
    <>
      <Drawer
        open={dialogStore.selectProxyDialogOpen}
        direction="right"
        onOpenChange={(open) => {
          if (!open) {
            dialogStore.closeSelectProxyDialog();
          }
        }}
      >
        <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-[48vw] my-auto mr-4 rounded-md max-w-[1100px] h-[96%] gap-0 p-0 overflow-hidden flex flex-col">
          {/* 渐变头部 */}
          <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 px-5 py-4 border-b border-border/50">
            <DrawerHeader className="space-y-1 p-0">
              <DrawerTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                {t('dialog.proxy.title')}
              </DrawerTitle>
              <DrawerDescription className="text-xs">
                {t('dialog.proxy.selectDescription', { envName: environmentName })}
              </DrawerDescription>
            </DrawerHeader>
          </div>

          {/* 内容区域 */}
          <div className="p-4 space-y-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-xl bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => {
                    setProxySourceMode('remote');
                    setSearchQuery('');
                    setPage(1);
                    setSelectedProxyUuids(
                      initialSelection.mode === 'remote'
                        ? createSingleSelection(initialSelection.key)
                        : createSingleSelection()
                    );
                  }}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-xs transition-all duration-200',
                    proxySourceMode === 'remote'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {t('dialog.proxy.modeRemote', { defaultValue: '代理' })}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProxySourceMode('local');
                    setSearchQuery('');
                    setPage(1);
                    setSelectedProxyUuids(
                      initialSelection.mode === 'local'
                        ? createSingleSelection(initialSelection.key)
                        : createSingleSelection()
                    );
                  }}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-xs transition-all duration-200',
                    proxySourceMode === 'local'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {t('dialog.proxy.modeLocal', { defaultValue: '本地代理' })}
                </button>
              </div>
            </div>
            {/* 工具栏：搜索（左上角）+ 检测（右上角） */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative group w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder={t('dialog.proxy.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 pr-8 h-9 text-sm bg-muted/30 border-border/50 rounded-lg focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={handleTestSelected}
                disabled={selectedProxyUuids.size === 0 || testingSelected}
                title={t('dialog.proxy.testButton')}
              >
                {testingSelected ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* 表格区域 */}
            {currentProxies.length === 0 && !currentLoading ? (
              <div className="rounded-lg border border-border/50 flex-1 min-h-0 flex items-center justify-center">
                <EmptyState
                  title={
                    proxySourceMode === 'local'
                      ? t('dialog.proxy.noLocalProxies', { defaultValue: '暂无本地代理' })
                      : t('dialog.proxy.noProxies')
                  }
                  description={
                    proxySourceMode === 'local'
                      ? localError ||
                        t('dialog.proxy.noLocalProxiesDescription', {
                          defaultValue: '请先在 Mihomo 中选择并应用本地代理节点。',
                        })
                      : t('dialog.proxy.noProxiesDescription')
                  }
                />
              </div>
            ) : filteredProxies.length === 0 && !currentLoading ? (
              <div className="rounded-lg border border-border/50 flex-1 min-h-0 flex items-center justify-center">
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-blue-500/60" />
                  </div>
                  <h4 className="text-sm font-medium text-foreground mb-1">
                    {t('dialog.proxy.noMatch')}
                  </h4>
                  <p className="text-xs text-muted-foreground text-center max-w-[240px]">
                    {t('dialog.proxy.noMatchDescription')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden flex flex-col flex-1 min-h-0">
                <DataTable
                  data={pagedProxies}
                  columns={columns}
                  getRowKey={(row) => row.uuid}
                  loading={currentLoading}
                  skeletonRows={pageSize}
                  emptyText=""
                  selectable={true}
                  selectedIds={selectedProxyUuids}
                  onSelectionChange={(selectedIds) => {
                    const nextSelectedUuid = Array.from(selectedIds).at(-1);
                    setSelectedProxyUuids(createSingleSelection(nextSelectedUuid));
                  }}
                  onRowClick={(row) => {
                    setSelectedProxyUuids((prev) =>
                      prev.has(row.uuid)
                        ? createSingleSelection()
                        : createSingleSelection(row.uuid)
                    );
                  }}
                  stickyRightColumns={['actions']}
                  className="m-0 border-0 rounded-none flex-1 min-h-0 [&_td]:py-2 [&_th]:py-3 [&_tbody_tr:last-child]:border-b-0 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_td:first-child]:border-b-0"
                  tableClassName="min-w-full"
                />
              </div>
            )}

            {/* 分页：底部 */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border border-border/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t('dialog.proxy.total')}{' '}
                  <span className="font-medium text-foreground">{filteredProxies.length}</span>{' '}
                  {t('dialog.proxy.items')}
                </span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger size="sm" className="h-8 w-[86px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {t('dialog.proxy.itemsPerPage')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.max(1, p - 1));
                      }}
                      aria-label={t('dialog.proxy.previous')}
                      aria-disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{t('dialog.proxy.previous')}</span>
                    </PaginationLink>
                  </PaginationItem>
                  {renderPageItems()}
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.min(totalPages, p + 1));
                      }}
                      aria-label={t('dialog.proxy.next')}
                      aria-disabled={currentPage === totalPages}
                    >
                      <span className="hidden sm:inline">{t('dialog.proxy.next')}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </PaginationLink>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>

          {/* 底部操作栏 */}
          <DrawerFooter className="px-5 py-3 bg-muted/30 border-t border-border/50 gap-2 flex-row items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-dashed hover:border-primary/50 hover:bg-primary/5"
              onClick={handleOpenCreateProxy}
              disabled={proxySourceMode === 'local'}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {proxySourceMode === 'local'
                ? t('dialog.proxy.localManagedByMihomo', { defaultValue: '由 Mihomo 管理' })
                : t('dialog.proxy.createNew')}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => dialogStore.closeSelectProxyDialog()}
              >
                {t('dialog.proxy.cancel')}
              </Button>
              <Button
                size="sm"
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
                onClick={handleSave}
                disabled={submitting || !canSaveSelection}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {t('dialog.proxy.saving')}
                  </>
                ) : (
                  t('dialog.proxy.save')
                )}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* 删除确认对话框 */}
      {proxyToDelete && (
        <FormattedDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setProxyToDelete(null);
            }
          }}
          minWidth="min-w-[440px]"
          header={{
            icon: Trash2,
            iconColor: 'text-destructive',
            title: t('dialog.proxy.deleteTitle') || '删除代理',
            description:
              t('dialog.proxy.deleteDescription', {
                name: proxyToDelete.name || `${proxyToDelete.host}:${proxyToDelete.port}`,
              }) ||
              `确定要删除代理 "${proxyToDelete.name || `${proxyToDelete.host}:${proxyToDelete.port}`}" 吗？`,
            gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
            className: 'border-b border-destructive/20',
          }}
          contentPadding="p-5"
        >
          {/* 代理信息卡片 */}
          <div className="bg-muted/50 rounded-md p-3 border border-border/50">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {proxyToDelete.name || `${proxyToDelete.host}:${proxyToDelete.port}`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {proxyToDelete.host}:{proxyToDelete.port} ·{' '}
                {proxyToDelete.proxy_type?.toUpperCase() || 'HTTP'}
              </p>
              {proxyToDelete.remark && (
                <p className="text-xs text-muted-foreground mt-0.5">{proxyToDelete.remark}</p>
              )}
            </div>
          </div>

          <FormattedDialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteDialogOpen(false);
                setProxyToDelete(null);
              }}
              disabled={deleting}
            >
              <X className="h-4 w-4 mr-1.5" />
              {t('dialog.proxy.deleteCancel') || '取消'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  {t('dialog.proxy.deleting') || '删除中...'}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  {t('dialog.proxy.deleteConfirm') || '确认删除'}
                </>
              )}
            </Button>
          </FormattedDialogFooter>
        </FormattedDialog>
      )}
    </>
  );
}
