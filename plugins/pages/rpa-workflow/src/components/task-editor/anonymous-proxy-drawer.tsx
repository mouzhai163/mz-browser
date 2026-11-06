import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@/lib/tauri';
import {
  Activity,
  Loader2,
  Search,
  Shield,
  WifiOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTable, type ColumnDef } from '@/components/data-table';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import {
  listProxies,
  type ProxyItem,
} from '../../../../../pages/environment-manager/src/api';
import {
  getLocalMihomoProxyRecords,
  mapLocalMihomoProxyToProxyCandidate,
  type EnvironmentProxyCandidate,
} from '../../../../../pages/environment-manager/src/utils/local-proxy';

export type AnonymousProxyCandidate = EnvironmentProxyCandidate;

interface AnonymousProxyDrawerProps {
  open: boolean;
  value: AnonymousProxyCandidate | null;
  onOpenChange: (open: boolean) => void;
  onChange: (value: AnonymousProxyCandidate | null) => void;
}

type ProxySourceMode = 'remote' | 'local';
type ProxyTestStatus = 'untested' | 'testing' | 'healthy' | 'unhealthy';

interface ProxyTestResult {
  status: ProxyTestStatus;
  ip?: string;
  country?: string;
  country_code?: string;
  latency?: number;
  error?: string;
}

function createSingleSelection(proxyUuid?: string) {
  return proxyUuid ? new Set([proxyUuid]) : new Set<string>();
}

function getProxyInfoText(proxy: AnonymousProxyCandidate) {
  return proxy.source === 'local' ? proxy.name : `${proxy.host}:${proxy.port}`;
}

function getProxyCategoryText(proxy: AnonymousProxyCandidate) {
  return (proxy.proxy_type || 'http').toUpperCase();
}

function getAssociatedText(proxy: AnonymousProxyCandidate) {
  if (typeof proxy.environments_count === 'number') {
    return String(proxy.environments_count);
  }

  return proxy.source === 'local' ? '-' : '0';
}

function getStatusStyle(
  status: ProxyTestStatus,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  switch (status) {
    case 'healthy':
      return {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-600 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: t('editor.proxy.statusHealthy', { defaultValue: '健康' }),
      };
    case 'unhealthy':
      return {
        bg: 'bg-red-500/15',
        text: 'text-red-600 dark:text-red-400',
        dot: 'bg-red-500',
        label: t('editor.proxy.statusUnhealthy', { defaultValue: '不可用' }),
      };
    case 'testing':
      return {
        bg: 'bg-blue-500/15',
        text: 'text-blue-600 dark:text-blue-400',
        dot: 'bg-blue-500 animate-pulse',
        label: t('editor.proxy.statusTesting', { defaultValue: '检测中' }),
      };
    default:
      return {
        bg: 'bg-gray-500/15',
        text: 'text-gray-500',
        dot: 'bg-gray-400',
        label: t('editor.proxy.statusUntested', { defaultValue: '未检测' }),
      };
  }
}

function getSelectionMode(value: AnonymousProxyCandidate | null): ProxySourceMode {
  return value?.source === 'local' ? 'local' : 'remote';
}

export function AnonymousProxyDrawer({
  open,
  value,
  onOpenChange,
  onChange,
}: AnonymousProxyDrawerProps) {
  const { t } = useTranslation('rpa');
  const [remoteProxies, setRemoteProxies] = useState<ProxyItem[]>([]);
  const [localProxies, setLocalProxies] = useState<AnonymousProxyCandidate[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [proxySourceMode, setProxySourceMode] = useState<ProxySourceMode>('remote');
  const [selectedProxyUuids, setSelectedProxyUuids] = useState<Set<string>>(new Set());
  const [proxyTestResults, setProxyTestResults] = useState<Map<string, ProxyTestResult>>(new Map());
  const [testingSelected, setTestingSelected] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const remoteCandidates = useMemo<AnonymousProxyCandidate[]>(
    () => remoteProxies.map((proxy) => ({ ...proxy, source: 'remote' })),
    [remoteProxies]
  );
  const currentProxies = proxySourceMode === 'remote' ? remoteCandidates : localProxies;
  const currentLoading = proxySourceMode === 'remote' ? loadingRemote : loadingLocal;

  const filteredProxies = useMemo(() => {
    if (!searchQuery.trim()) {
      return currentProxies;
    }

    const query = searchQuery.toLowerCase();
    return currentProxies.filter(
      (proxy) =>
        proxy.name.toLowerCase().includes(query) ||
        proxy.host.toLowerCase().includes(query) ||
        proxy.proxy_type.toLowerCase().includes(query) ||
        proxy.country?.toLowerCase().includes(query) ||
        proxy.city?.toLowerCase().includes(query)
    );
  }, [currentProxies, searchQuery]);

  const selectedSingleProxyUuid =
    selectedProxyUuids.size === 1 ? Array.from(selectedProxyUuids)[0] : '';
  const selectedProxy =
    currentProxies.find((proxy) => proxy.uuid === selectedSingleProxyUuid) ?? null;

  const columns: ColumnDef<AnonymousProxyCandidate>[] = useMemo(
    () => [
      {
        id: 'info',
        header: t('editor.proxy.tableHeaderInfo', { defaultValue: '代理信息' }),
        cell: ({ row }) => {
          const testResult = proxyTestResults.get(row.uuid);
          const status = testResult?.status || 'untested';
          const statusStyle = getStatusStyle(status, t);

          return (
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground font-mono truncate">
                {getProxyInfoText(row)}
              </div>
              <span
                className={cn(
                  'shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                  statusStyle.bg,
                  statusStyle.text
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', statusStyle.dot)} />
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
        header: t('editor.proxy.tableHeaderCategory', { defaultValue: '类型' }),
        width: 96,
        cell: ({ row }) => (
          <span className="text-[10px] font-semibold text-muted-foreground">
            {getProxyCategoryText(row)}
          </span>
        ),
      },
      {
        id: 'associated',
        header: t('editor.proxy.tableHeaderAssociated', { defaultValue: '关联' }),
        width: 96,
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground font-mono">
            {getAssociatedText(row)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('editor.proxy.tableHeaderActions', { defaultValue: '操作' }),
        width: 88,
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(event) => {
                event.stopPropagation();
                void handleTestProxy(row);
              }}
              disabled={proxyTestResults.get(row.uuid)?.status === 'testing'}
              title={t('editor.proxy.testButton', { defaultValue: '检测代理' })}
            >
              {proxyTestResults.get(row.uuid)?.status === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
            </Button>
          </div>
        ),
      },
    ],
    [proxyTestResults, t]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearchQuery('');
    setProxySourceMode(getSelectionMode(value));
    setSelectedProxyUuids(createSingleSelection(value?.uuid));

    let cancelled = false;

    const loadRemote = async () => {
      setLoadingRemote(true);
      try {
        const list = await listProxies();
        if (!cancelled) {
          setRemoteProxies(list);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : t('editor.proxy.loadRemoteFailed', { defaultValue: '加载代理列表失败' })
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingRemote(false);
        }
      }
    };

    const loadLocal = async () => {
      setLoadingLocal(true);
      try {
        const list = await getLocalMihomoProxyRecords();
        if (!cancelled) {
          setLocalProxies(list.map(mapLocalMihomoProxyToProxyCandidate));
        }
      } catch (error) {
        if (!cancelled) {
          setLocalProxies([]);
          toast.error(
            error instanceof Error
              ? error.message
              : t('editor.proxy.loadLocalFailed', { defaultValue: '加载本地代理失败' })
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingLocal(false);
        }
      }
    };

    void loadRemote();
    void loadLocal();

    return () => {
      cancelled = true;
    };
  }, [open, t, value]);

  const handleTestProxy = async (proxy: AnonymousProxyCandidate) => {
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
          password: proxy.password
            ? { value: proxy.password, encrypted: false }
            : null,
        },
      });

      if (result.success && result.ip_info) {
        setProxyTestResults((prev) =>
          new Map(prev).set(proxy.uuid, {
            status: 'healthy',
            ip: result.ip_info?.ip,
            country: result.ip_info?.country,
            country_code: result.ip_info?.country_code,
            latency: result.latency_ms,
          })
        );
      } else {
        setProxyTestResults((prev) =>
          new Map(prev).set(proxy.uuid, {
            status: 'unhealthy',
            error: result.error || '连接失败',
          })
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProxyTestResults((prev) =>
        new Map(prev).set(proxy.uuid, {
          status: 'unhealthy',
          error: message,
        })
      );
      toast.error(message);
    }
  };

  const handleTestSelected = async () => {
    const selectedProxies = currentProxies.filter((proxy) => selectedProxyUuids.has(proxy.uuid));
    if (selectedProxies.length === 0) {
      return;
    }

    setTestingSelected(true);
    try {
      for (const proxy of selectedProxies) {
        await handleTestProxy(proxy);
      }
    } finally {
      setTestingSelected(false);
    }
  };

  const handleSave = () => {
    setSubmitting(true);
    try {
      onChange(selectedProxy);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    onChange(null);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} direction="right" onOpenChange={onOpenChange}>
      <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-[42vw] my-auto mr-4 rounded-md max-w-[920px] h-[96%] gap-0 p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-sky-500/10 px-5 py-4 border-b border-border/50">
          <DrawerHeader className="space-y-1 p-0">
            <DrawerTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-sky-500" />
              {t('editor.proxy.title', { defaultValue: '匿名环境代理' })}
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {t('editor.proxy.description', {
                defaultValue: '为当前 RPA 试运行选择临时代理，仅影响匿名环境。',
              })}
            </DrawerDescription>
          </DrawerHeader>
        </div>

        <div className="p-4 space-y-3 flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 rounded-xl bg-secondary p-1 w-fit">
            <button
              type="button"
              onClick={() => {
                setProxySourceMode('remote');
                setSearchQuery('');
                setSelectedProxyUuids(
                  value?.source === 'remote'
                    ? createSingleSelection(value.uuid)
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
              {t('editor.proxy.modeRemote', { defaultValue: '代理' })}
            </button>
            <button
              type="button"
              onClick={() => {
                setProxySourceMode('local');
                setSearchQuery('');
                setSelectedProxyUuids(
                  value?.source === 'local'
                    ? createSingleSelection(value.uuid)
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
              {t('editor.proxy.modeLocal', { defaultValue: '本地代理' })}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="relative group w-[320px] max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder={t('editor.proxy.searchPlaceholder', {
                  defaultValue: '搜索代理名称、地址或类型...',
                })}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9 pr-8 h-9 text-sm bg-muted/30 border-border/50 rounded-lg focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => void handleTestSelected()}
              disabled={selectedProxyUuids.size === 0 || testingSelected}
              title={t('editor.proxy.testButton', { defaultValue: '检测代理' })}
            >
              {testingSelected ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="rounded-lg border border-border/50 flex-1 min-h-0 overflow-hidden bg-background/70">
            {currentLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                {t('loading')}
              </div>
            ) : filteredProxies.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-sky-500/20 to-cyan-500/20 flex items-center justify-center">
                  <WifiOff className="h-7 w-7 text-sky-500/60" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {proxySourceMode === 'local'
                      ? t('editor.proxy.noLocalProxies', { defaultValue: '暂无本地代理' })
                      : t('editor.proxy.noRemoteProxies', { defaultValue: '暂无代理' })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {proxySourceMode === 'local'
                      ? t('editor.proxy.noLocalDescription', {
                          defaultValue: '请先在 Mihomo 中选择并应用本地代理节点。',
                        })
                      : t('editor.proxy.noRemoteDescription', {
                          defaultValue: '当前没有可用的远程代理记录。',
                        })}
                  </p>
                </div>
              </div>
            ) : (
              <DataTable
                data={filteredProxies}
                columns={columns}
                getRowKey={(row) => row.uuid}
                loading={false}
                emptyText=""
                selectable
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
                className="m-0 border-0 rounded-none h-full [&_td]:py-2 [&_th]:py-3"
                tableClassName="min-w-full"
              />
            )}
          </div>
        </div>

        <DrawerFooter className="px-5 py-3 bg-muted/30 border-t border-border/50 gap-2 flex-row items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={handleClear}
            disabled={submitting || (!value && selectedProxyUuids.size === 0)}
          >
            {t('editor.proxy.clear', { defaultValue: '清除代理' })}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('dialog.settings.cancel')}
            </Button>
            <Button
              size="sm"
              className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
              onClick={handleSave}
              disabled={submitting || !selectedProxy}
            >
              {t('editor.proxy.save', { defaultValue: '使用此代理' })}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
