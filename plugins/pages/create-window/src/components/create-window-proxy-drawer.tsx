import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProxySourceMode } from '../types';
// @ts-ignore - Cross-plugin import
import {
  listProxies,
  deleteProxy,
  type ProxyItem,
} from '../../../environment-manager/src/api';
// @ts-ignore - Cross-plugin import
import {
  getLocalMihomoProxyRecords,
  mapLocalMihomoProxyToProxyCandidate,
  type EnvironmentProxyCandidate,
} from '../../../environment-manager/src/utils';
import { CreateWindowCreateProxyDialog } from './create-window-create-proxy-dialog';

interface CreateWindowProxyDrawerProps {
  open: boolean;
  selectedProxyMode: ProxySourceMode;
  selectedProxyUuids: string[];
  selectedLocalProxyNodeNames: string[];
  maxCount?: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (value: {
    mode: ProxySourceMode;
    remoteProxyUuids: string[];
    localProxyNodeNames: string[];
  }) => void;
}

type ProxyTestStatus = 'untested' | 'testing' | 'healthy' | 'unhealthy';

interface ProxyTestResult {
  status: ProxyTestStatus;
  ip?: string;
  country?: string;
  country_code?: string;
  latency?: number;
  error?: string;
}

const LOCAL_PROXY_LOAD_FAILED = '加载本地代理失败';

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
    default:
      return {
        bg: 'bg-gray-500/15',
        text: 'text-gray-500',
        dot: 'bg-gray-400',
        label: t('dialog.proxy.statusUntested') || '未检测',
      };
  }
};

const getProxyInfoText = (proxy: EnvironmentProxyCandidate) =>
  proxy.source === 'local' ? proxy.name : `${proxy.host}:${proxy.port}`;

const getProxyCategoryText = (proxy: EnvironmentProxyCandidate) =>
  (proxy.proxy_type || '-').toUpperCase();

const getAssociatedText = (proxy: EnvironmentProxyCandidate) => {
  if (typeof proxy.environments_count === 'number') return String(proxy.environments_count);
  return '-';
};

const EmptyState: React.FC<{
  title: string;
  description: string;
}> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      <WifiOff className="h-8 w-8 text-blue-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{title}</h4>
    <p className="text-xs text-muted-foreground text-center max-w-[240px]">{description}</p>
  </div>
);

export function CreateWindowProxyDrawer({
  open,
  selectedProxyMode,
  selectedProxyUuids,
  selectedLocalProxyNodeNames,
  maxCount,
  onOpenChange,
  onConfirm,
}: CreateWindowProxyDrawerProps) {
  const { t } = useTranslation('create-window');

  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [loadingProxies, setLoadingProxies] = useState(false);
  const [localProxies, setLocalProxies] = useState<EnvironmentProxyCandidate[]>([]);
  const [loadingLocalProxies, setLoadingLocalProxies] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [proxySourceMode, setProxySourceMode] = useState<ProxySourceMode>('remote');

  const [proxyTestResults, setProxyTestResults] = useState<Map<string, ProxyTestResult>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const [createProxyDialogOpen, setCreateProxyDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proxyToDelete, setProxyToDelete] = useState<ProxyItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testingSelected, setTestingSelected] = useState(false);

  const remoteProxies = useMemo<EnvironmentProxyCandidate[]>(
    () => proxies.map((proxy) => ({ ...proxy, source: 'remote' })),
    [proxies]
  );
  const currentProxies = proxySourceMode === 'remote' ? remoteProxies : localProxies;
  const currentLoading = proxySourceMode === 'remote' ? loadingProxies : loadingLocalProxies;

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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredProxies.length / pageSize)),
    [filteredProxies.length, pageSize]
  );
  const currentPage = Math.min(page, totalPages);
  const pagedProxies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProxies.slice(start, start + pageSize);
  }, [filteredProxies, currentPage, pageSize]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setProxySourceMode(selectedProxyMode);
    setSelectedIds(
      new Set(selectedProxyMode === 'local' ? selectedLocalProxyNodeNames : selectedProxyUuids)
    );
    setSearchQuery('');
    setPage(1);
    void loadProxies();
    void loadLocalProxies();
  }, [open, selectedProxyMode, selectedProxyUuids, selectedLocalProxyNodeNames]);

  const loadProxies = async () => {
    setLoadingProxies(true);
    try {
      setProxies(await listProxies());
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('dialog.proxy.loadFailed') || '加载代理列表失败'
      );
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

  const applySelectionLimit = (nextSelected: Set<string>) => {
    if (maxCount === 1) {
      if (nextSelected.size <= 1) {
        setSelectedIds(nextSelected);
        return;
      }
      const lastSelected = Array.from(nextSelected).pop();
      setSelectedIds(new Set(lastSelected ? [lastSelected] : []));
      return;
    }

    if (maxCount && maxCount > 1 && nextSelected.size > maxCount) {
      toast.error(
        t('dialog.proxy.maxCountExceeded') ||
          `代理数量不可以超出实际创建的窗口数量（${maxCount}）`
      );
      setSelectedIds(new Set(Array.from(nextSelected).slice(0, maxCount)));
      return;
    }

    setSelectedIds(nextSelected);
  };

  const handleConfirm = () => {
    const values = Array.from(selectedIds);
    onConfirm({
      mode: proxySourceMode,
      remoteProxyUuids: proxySourceMode === 'remote' ? values : [],
      localProxyNodeNames: proxySourceMode === 'local' ? values : [],
    });
    onOpenChange(false);
  };

  const handleTestProxy = async (proxy: EnvironmentProxyCandidate) => {
    setProxyTestResults((prev) => new Map(prev).set(proxy.uuid, { status: 'testing' }));

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
          password: proxy.password ? { value: proxy.password, encrypted: false } : null,
        },
      });

      if (result.success && result.ip_info) {
        setProxyTestResults((prev) =>
          new Map(prev).set(proxy.uuid, {
            status: 'healthy',
            ip: result.ip_info.ip,
            country: result.ip_info.country,
            country_code: result.ip_info.country_code,
            latency: result.latency_ms,
          })
        );
        return;
      }

      setProxyTestResults((prev) =>
        new Map(prev).set(proxy.uuid, {
          status: 'unhealthy',
          error: result.error || '连接失败',
        })
      );
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setProxyTestResults((prev) =>
        new Map(prev).set(proxy.uuid, {
          status: 'unhealthy',
          error: errorMsg,
        })
      );
    }
  };

  const handleTestSelected = async () => {
    if (selectedIds.size === 0) return;
    const selectedProxies = currentProxies.filter((proxy) => selectedIds.has(proxy.uuid));
    if (selectedProxies.length === 0) return;

    setTestingSelected(true);
    for (const proxy of selectedProxies) {
      await handleTestProxy(proxy);
    }
    setTestingSelected(false);
  };

  const handleDeleteProxy = (proxy: EnvironmentProxyCandidate) => {
    if (proxy.source !== 'remote') return;
    setProxyToDelete(proxy);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!proxyToDelete) return;

    setDeleting(true);
    try {
      await deleteProxy({ uuid: proxyToDelete.uuid });
      setProxies((prev) => prev.filter((proxy) => proxy.uuid !== proxyToDelete.uuid));
      const nextSelected = new Set(selectedIds);
      nextSelected.delete(proxyToDelete.uuid);
      setSelectedIds(nextSelected);
      setDeleteDialogOpen(false);
      setProxyToDelete(null);
      toast.success(t('dialog.proxy.deleteSuccess') || '删除代理成功');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('dialog.proxy.deleteFailed') || '删除代理失败'
      );
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<EnvironmentProxyCandidate>[] = useMemo(
    () => [
      {
        id: 'info',
        header: t('dialog.proxy.tableHeaderInfo') || '代理信息',
        cell: ({ row }) => {
          const testResult = proxyTestResults.get(row.uuid);
          const statusStyle = getStatusStyle(testResult?.status || 'untested', t);
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
                {testResult?.latency ? <span className="ml-1">{testResult.latency}ms</span> : null}
              </span>
              {testResult?.status === 'healthy' && testResult.country && testResult.country_code ? (
                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {testResult.country_code} | {testResult.country}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'category',
        header: t('dialog.proxy.tableHeaderCategory') || '分类',
        width: 96,
        cell: ({ row }) => (
          <span className="text-[10px] font-semibold text-muted-foreground">
            {getProxyCategoryText(row)}
          </span>
        ),
      },
      {
        id: 'associated',
        header: t('dialog.proxy.tableHeaderAssociated') || '关联环境',
        width: 96,
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground font-mono">{getAssociatedText(row)}</span>
        ),
      },
      {
        id: 'actions',
        header: t('dialog.proxy.tableHeaderActions') || '操作',
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
              title={t('dialog.proxy.testButton') || '检测'}
            >
              {proxyTestResults.get(row.uuid)?.status === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
            </Button>
            {row.source === 'remote' ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteProxy(row);
                }}
                title={t('dialog.proxy.delete') || '删除'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [proxyTestResults, t]
  );

  const renderPageItems = () => {
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
          <PaginationItem key={`ellipsis-${idx}`}>
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      return (
        <PaginationItem key={it}>
          <PaginationLink
            href="#"
            isActive={it === currentPage}
            size="sm"
            className="h-7 w-7 text-xs"
            onClick={(e) => {
              e.preventDefault();
              setPage(it);
            }}
          >
            {it}
          </PaginationLink>
        </PaginationItem>
      );
    });
  };

  return (
    <>
      <Drawer open={open} direction="right" onOpenChange={onOpenChange}>
        <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-[48vw] my-auto mr-4 rounded-md max-w-[1100px] h-[96%] gap-0 p-0 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 px-5 py-4 border-b border-border/50">
            <DrawerHeader className="space-y-1 p-0">
              <DrawerTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                {t('dialog.proxy.title') || '代理设置'}
              </DrawerTitle>
              <DrawerDescription className="text-xs">
                {t('dialog.proxy.selectDescription') || '选择或创建代理'}
              </DrawerDescription>
            </DrawerHeader>
          </div>

          <div className="p-4 space-y-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-xl bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => {
                    setProxySourceMode('remote');
                    setSearchQuery('');
                    setPage(1);
                    setSelectedIds(new Set(selectedProxyUuids));
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
                    setSelectedIds(new Set(selectedLocalProxyNodeNames));
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

            <div className="flex items-center justify-between gap-2">
              <div className="relative group w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder={t('dialog.proxy.searchPlaceholder') || '搜索代理名称、IP 或类型...'}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 pr-8 h-9 text-sm bg-muted/30 border-border/50 rounded-lg focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {searchQuery ? (
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
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleTestSelected}
                  disabled={selectedIds.size === 0 || testingSelected}
                  title={t('dialog.proxy.testButton') || '检测'}
                >
                  {testingSelected ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setCreateProxyDialogOpen(true)}
                  disabled={proxySourceMode === 'local'}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {proxySourceMode === 'local'
                    ? t('dialog.proxy.localManagedByMihomo', { defaultValue: '由 Mihomo 管理' })
                    : t('dialog.proxy.createNew') || '新建代理'}
                </Button>
              </div>
            </div>

            {currentProxies.length === 0 && !currentLoading ? (
              <div className="rounded-lg border border-border/50 flex-1 min-h-0 flex items-center justify-center">
                <EmptyState
                  title={
                    proxySourceMode === 'local'
                      ? t('dialog.proxy.noLocalProxies', { defaultValue: '暂无本地代理' })
                      : t('dialog.proxy.noProxies') || '暂无代理'
                  }
                  description={
                    proxySourceMode === 'local'
                      ? localError ||
                        t('dialog.proxy.noLocalProxiesDescription', {
                          defaultValue: '请先在 Mihomo 中选择并应用本地代理节点',
                        })
                      : t('dialog.proxy.noProxiesDescription') ||
                        '创建代理以保护您的环境隐私并隐藏您的真实 IP 地址'
                  }
                />
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden flex flex-col flex-1 min-h-0">
                <DataTable
                  data={pagedProxies}
                  columns={columns}
                  getRowKey={(row) => row.uuid}
                  loading={currentLoading}
                  skeletonRows={pageSize}
                  emptyText={
                    filteredProxies.length === 0
                      ? t('dialog.proxy.noMatch') || '未找到匹配的代理'
                      : t('dialog.proxy.noProxies') || '暂无代理'
                  }
                  selectable={true}
                  selectedIds={selectedIds}
                  onSelectionChange={(newSelected) => {
                    applySelectionLimit(newSelected);
                  }}
                  onRowClick={(row) => {
                    const nextSelected = new Set(selectedIds);
                    if (nextSelected.has(row.uuid)) {
                      nextSelected.delete(row.uuid);
                    } else {
                      nextSelected.add(row.uuid);
                    }
                    applySelectionLimit(nextSelected);
                  }}
                  stickyRightColumns={['actions']}
                  className="m-0 border-0 rounded-none flex-1 min-h-0 [&_td]:py-2 [&_th]:py-3 [&_tbody_tr:last-child]:border-b-0 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_td:first-child]:border-b-0"
                  tableClassName="min-w-full"
                />
              </div>
            )}

            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border border-border/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t('dialog.proxy.total') || '共'}{' '}
                  <span className="font-medium text-foreground">{filteredProxies.length}</span>{' '}
                  {t('dialog.proxy.items') || '项'}
                </span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger size="sm" className="h-8 w-[86px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} {t('dialog.proxy.itemsPerPage') || '项/页'}
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
                        setPage((prev) => Math.max(1, prev - 1));
                      }}
                      aria-label={t('dialog.proxy.previous') || '上一页'}
                      aria-disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">
                        {t('dialog.proxy.previous') || '上一页'}
                      </span>
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
                        setPage((prev) => Math.min(totalPages, prev + 1));
                      }}
                      aria-label={t('dialog.proxy.next') || '下一页'}
                      aria-disabled={currentPage === totalPages}
                    >
                      <span className="hidden sm:inline">{t('dialog.proxy.next') || '下一页'}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </PaginationLink>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>

          <DrawerFooter className="px-5 py-3 bg-muted/30 border-t border-border/50 gap-2 flex-row items-center justify-end">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => onOpenChange(false)}
              >
                {t('dialog.proxy.cancel') || '取消'}
              </Button>
              <Button
                size="sm"
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
                onClick={handleConfirm}
                disabled={selectedIds.size === 0}
              >
                {t('dialog.proxy.confirm') || '确认'}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <CreateWindowCreateProxyDialog
        open={createProxyDialogOpen}
        onOpenChange={setCreateProxyDialogOpen}
        onComplete={() => {
          void loadProxies();
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="gap-0 p-3">
          <AlertDialogHeader className="mb-3">
            <AlertDialogTitle className="text-sm font-semibold mb-0 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t('dialog.proxy.deleteTitle') || '删除代理'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[10px] text-muted-foreground mt-0.5 mb-0">
              {proxyToDelete
                ? t('dialog.proxy.deleteDescription', {
                    name: proxyToDelete.name || `${proxyToDelete.host}:${proxyToDelete.port}`,
                  }) ||
                  `确定要删除代理 "${proxyToDelete.name || `${proxyToDelete.host}:${proxyToDelete.port}`}" 吗？`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert className="border-destructive/50 bg-destructive/10 mb-3 px-3 py-2">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            <AlertTitle className="text-[10px] text-destructive">
              {t('dialog.proxy.deleteWarningTitle') || '警告'}
            </AlertTitle>
            <AlertDescription className="text-[10px] text-destructive/90">
              {t('dialog.proxy.deleteWarningDescription') ||
                '删除代理后，使用该代理的环境将无法继续使用该代理。此操作不可恢复。'}
            </AlertDescription>
          </Alert>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false);
                setProxyToDelete(null);
              }}
              className="text-[10px] px-3 py-1.5 h-7"
              disabled={deleting}
            >
              {t('dialog.proxy.deleteCancel') || '取消'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[10px] px-3 py-1.5 h-7"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  {t('dialog.proxy.deleting') || '删除中...'}
                </>
              ) : (
                t('dialog.proxy.deleteConfirm') || '确认删除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
