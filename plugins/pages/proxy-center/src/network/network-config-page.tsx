import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Download,
  FolderOpen,
  FolderPlus,
  Gauge,
  LayoutGrid,
  Lightbulb,
  List,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Server,
  Shield,
  Trash2,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  addNetworkRelayGroup,
  addNetworkRelayNodes,
  addNetworkRelaySubscription,
  deleteNetworkRelayGroup,
  deleteNetworkRelayNode,
  getNetworkRelayState,
  installNetworkRelayCore,
  refreshNetworkRelaySubscription,
  selectNetworkRelayNode,
  setNetworkRelayCorePath,
  setNetworkRelayMode,
  testNetworkRelayGroupDelays,
  testNetworkRelayNodeDelay,
} from './api';
import { AddGroupDialog, AddNodeDialog, AddSubscriptionDialog } from './dialogs';
import { LinkFlowDiagram } from './link-flow-diagram';
import type { AddNodesRequest, NetworkMode, NetworkRelayState, RelayNode } from './types';

const MODE_META: Record<
  NetworkMode,
  {
    label: string;
    title: string;
    description: string;
    suggestion: string;
  }
> = {
  direct: {
    label: '直接连接',
    title: '直接连接模式',
    description: '客户端直接连接环境配置的代理 IP，不经过额外前置转发。',
    suggestion: '适用于本机网络已可直接稳定访问代理 IP 的常规场景，延迟最低。',
  },
  system_proxy: {
    label: '系统代理',
    title: '系统代理模式',
    description: '自动读取当前系统代理作为前置出口，再连接各环境的代理 IP。',
    suggestion: '适用于电脑已开启 Clash / v2rayN 等系统代理，希望浏览器复用该出口的场景。',
  },
  relay: {
    label: '中转节点',
    title: '中转节点模式',
    description: '通过指定的中转节点连接代理 IP。',
    suggestion: '适用于代理 IP 直连不稳定、需要固定前置出口，或需要多级代理转发的场景。',
  },
};

function extractError(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function formatLatencyColor(ms?: number | null): string {
  if (ms == null) return 'text-muted-foreground';
  if (ms <= 150) return 'text-emerald-600 dark:text-emerald-400';
  if (ms <= 400) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function CountryBadge({ code }: { code?: string | null }) {
  if (!code) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-rose-600 dark:text-rose-400">
      {code}
    </span>
  );
}

export function NetworkConfigPage() {
  const [state, setState] = useState<NetworkRelayState | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [installingCore, setInstallingCore] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [testingGroupIds, setTestingGroupIds] = useState<Record<string, boolean>>({});
  const [testingNodeIds, setTestingNodeIds] = useState<Record<string, boolean>>({});
  const [refreshingGroupIds, setRefreshingGroupIds] = useState<Record<string, boolean>>({});

  const activeNodeRef = useRef<HTMLDivElement | null>(null);

  const loadState = useCallback(async () => {
    try {
      const next = await getNetworkRelayState();
      setState(next);
    } catch (error) {
      toast.error(extractError(error, '加载网络配置失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleModeChange = async (mode: NetworkMode) => {
    if (!state || state.config.mode === mode || switchingMode) return;
    setSwitchingMode(true);
    try {
      const next = await setNetworkRelayMode(mode);
      setState(next);
      toast.success(`已切换为「${MODE_META[mode].label}」模式`);
    } catch (error) {
      toast.error(extractError(error, '切换网络模式失败'));
    } finally {
      setSwitchingMode(false);
    }
  };

  const handleSelectNode = async (groupId: string, node: RelayNode) => {
    try {
      const next = await selectNetworkRelayNode(groupId, node.id);
      setState(next);
      toast.success(`已切换中转节点：${node.name}`);
    } catch (error) {
      toast.error(extractError(error, '切换中转节点失败'));
    }
  };

  const handleInstallCore = async () => {
    setInstallingCore(true);
    try {
      const next = await installNetworkRelayCore();
      setState(next);
      toast.success('内置中转内核安装完成并已就绪');
    } catch (error) {
      toast.error(extractError(error, '安装内置内核失败'));
    } finally {
      setInstallingCore(false);
    }
  };

  const handlePickLocalCore = async () => {
    try {
      const selected = await openFileDialog({
        multiple: false,
        title: '选择本地 Mihomo / Clash 内核可执行文件',
        filters: [{ name: 'Executable', extensions: ['exe'] }],
      });
      if (typeof selected === 'string' && selected.trim()) {
        const next = await setNetworkRelayCorePath(selected);
        setState(next);
        toast.success('已配置本地内核并启动');
      }
    } catch (error) {
      toast.error(extractError(error, '配置本地内核失败'));
    }
  };

  const handleAddSubscription = async (name: string, url: string) => {
    setSubmitting(true);
    try {
      const next = await addNetworkRelaySubscription({ name, url });
      setState(next);
      setSubDialogOpen(false);
      toast.success(`订阅「${name}」导入成功`);
    } catch (error) {
      toast.error(extractError(error, '导入订阅失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshSubscription = async (groupId: string, groupName: string) => {
    setRefreshingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    try {
      const next = await refreshNetworkRelaySubscription(groupId);
      setState(next);
      toast.success(`订阅「${groupName}」已更新`);
    } catch (error) {
      toast.error(extractError(error, '更新订阅失败'));
    } finally {
      setRefreshingGroupIds((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const handleAddGroup = async (name: string) => {
    setSubmitting(true);
    try {
      const next = await addNetworkRelayGroup({ name });
      setState(next);
      setGroupDialogOpen(false);
      toast.success(`分组「${name}」已创建`);
    } catch (error) {
      toast.error(extractError(error, '创建分组失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    try {
      const next = await deleteNetworkRelayGroup(groupId);
      setState(next);
      toast.success(`已删除分组「${groupName}」`);
    } catch (error) {
      toast.error(extractError(error, '删除分组失败'));
    }
  };

  const handleAddNodes = async (request: AddNodesRequest) => {
    setSubmitting(true);
    try {
      const next = await addNetworkRelayNodes(request);
      setState(next);
      setNodeDialogOpen(false);
      toast.success('节点添加成功');
    } catch (error) {
      toast.error(extractError(error, '添加节点失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNode = async (groupId: string, nodeId: string) => {
    try {
      const next = await deleteNetworkRelayNode(groupId, nodeId);
      setState(next);
    } catch (error) {
      toast.error(extractError(error, '删除节点失败'));
    }
  };

  const handleTestNode = async (groupId: string, nodeId: string) => {
    setTestingNodeIds((prev) => ({ ...prev, [nodeId]: true }));
    try {
      const res = await testNetworkRelayNodeDelay(groupId, nodeId);
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          config: {
            ...prev.config,
            groups: prev.config.groups.map((g) =>
              g.id !== groupId
                ? g
                : {
                    ...g,
                    nodes: g.nodes.map((n) =>
                      n.id === nodeId ? { ...n, latency_ms: res.delay_ms ?? null } : n
                    ),
                  }
            ),
          },
        };
      });
    } catch (error) {
      toast.error(extractError(error, '测速失败'));
    } finally {
      setTestingNodeIds((prev) => ({ ...prev, [nodeId]: false }));
    }
  };

  const handleTestGroup = async (groupId: string) => {
    setTestingGroupIds((prev) => ({ ...prev, [groupId]: true }));
    try {
      const results = await testNetworkRelayGroupDelays(groupId);
      const delayMap = new Map(results.map((r) => [r.node_id, r.delay_ms ?? null]));
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          config: {
            ...prev.config,
            groups: prev.config.groups.map((g) =>
              g.id !== groupId
                ? g
                : {
                    ...g,
                    nodes: g.nodes.map((n) =>
                      delayMap.has(n.id) ? { ...n, latency_ms: delayMap.get(n.id) } : n
                    ),
                  }
            ),
          },
        };
      });
      const okCount = results.filter((r) => r.available).length;
      toast.success(`测速完成：${okCount}/${results.length} 个节点可用`);
    } catch (error) {
      toast.error(extractError(error, '分组测速失败'));
    } finally {
      setTestingGroupIds((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const handleLocateActive = () => {
    if (!state?.config.selected_group_id) {
      toast.info('当前尚未选择中转节点');
      return;
    }
    setCollapsedGroups((prev) => ({
      ...prev,
      [state.config.selected_group_id!]: false,
    }));
    setTimeout(() => {
      activeNodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  if (loading || !state) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        正在加载网络配置...
      </div>
    );
  }

  const { config, core_status: coreStatus, system_proxy: systemProxy, active_node: activeNode } =
    state;
  const mode = config.mode;
  const meta = MODE_META[mode];

  const statusText =
    mode === 'direct'
      ? '直连就绪'
      : mode === 'system_proxy'
        ? systemProxy.enabled
          ? '已检测到系统代理'
          : '未开启系统代理'
        : coreStatus.running
          ? '运行中'
          : coreStatus.installed
            ? '待启动'
            : '未安装内核';

  const statusHealthy =
    mode === 'direct' ||
    (mode === 'system_proxy' && systemProxy.enabled) ||
    (mode === 'relay' && coreStatus.running);

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* 顶部标题 + 三模式切换器 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">网络配置</h2>
            <p className="text-xs text-muted-foreground">
              统一控制浏览器环境与代理测速的前置连接方式
            </p>
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-card p-1 shadow-xs">
            {(['direct', 'system_proxy', 'relay'] as const).map((item) => {
              const active = mode === item;
              return (
                <button
                  key={item}
                  type="button"
                  disabled={switchingMode}
                  onClick={() => void handleModeChange(item)}
                  className={cn(
                    'rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all',
                    active
                      ? 'border border-foreground/80 bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {MODE_META[item].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 状态概览条 */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-primary/25 bg-card/90 px-4 py-2.5 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <Network className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-muted-foreground">当前模式:</span>
            <span className="font-semibold text-foreground">{meta.label}</span>
          </div>

          <span className="h-3.5 w-px bg-border" />

          {mode === 'relay' && (
            <>
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-muted-foreground">中转节点:</span>
                {activeNode ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                    <CountryBadge code={activeNode.country_code} />
                    <span>{activeNode.name}</span>
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">未选择节点</span>
                )}
              </div>
              <span className="h-3.5 w-px bg-border" />
            </>
          )}

          {mode === 'system_proxy' && (
            <>
              <div className="flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5 text-indigo-500" />
                <span className="text-muted-foreground">系统代理:</span>
                <span className="font-mono font-medium text-foreground">
                  {systemProxy.enabled && systemProxy.server
                    ? `${systemProxy.scheme}://${systemProxy.server}`
                    : '未检测到'}
                </span>
              </div>
              <span className="h-3.5 w-px bg-border" />
            </>
          )}

          <div className="flex items-center gap-1.5">
            <CheckCircle2
              className={cn(
                'h-3.5 w-3.5',
                statusHealthy ? 'text-emerald-500' : 'text-amber-500'
              )}
            />
            <span className="text-muted-foreground">状态:</span>
            <span
              className={cn(
                'font-medium',
                statusHealthy
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              )}
            >
              {statusText}
            </span>
          </div>
        </div>

        {/* 模式说明与可视化访问链路卡片 */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-violet-500/[0.04] p-5 shadow-xs">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                  <Network className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{meta.title}</h3>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500 px-2.5 py-0.5 text-[11px] font-medium text-white">
                  <Lightbulb className="h-3 w-3" />
                  使用建议
                </span>
                <span className="text-xs text-muted-foreground">{meta.suggestion}</span>
              </div>
            </div>

            <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500/70 sm:flex">
              <Shield className="h-7 w-7" />
            </div>
          </div>

          <LinkFlowDiagram mode={mode} />

          {/* 内置内核未安装引导条 */}
          {mode === 'relay' && !coreStatus.installed && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs">
              <div className="space-y-0.5">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  尚未安装内置中转内核（Mihomo）
                </p>
                <p className="text-amber-700/80 dark:text-amber-400/80">
                  一键安装后即可直接解析机场订阅和各类节点协议，无需额外运行外部代理软件。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handlePickLocalCore()}
                  disabled={installingCore}
                >
                  <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                  导入本地内核
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleInstallCore()}
                  disabled={installingCore}
                  className="bg-violet-600 text-white hover:bg-violet-700"
                >
                  {installingCore ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {installingCore ? '正在下载安装...' : '一键安装内核'}
                </Button>
              </div>
            </div>
          )}

          {mode === 'system_proxy' && !systemProxy.enabled && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              <span>当前未检测到已开启的系统代理，请先在系统或代理客户端中开启系统代理。</span>
              <Button size="sm" variant="outline" onClick={() => void loadState()}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                重新检测
              </Button>
            </div>
          )}
        </div>

        {/* 中转节点模式：自定义订阅分组工具栏 + 分组列表 */}
        {mode === 'relay' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-2.5 shadow-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-semibold text-foreground">自定义订阅分组</span>
                <Button
                  size="sm"
                  onClick={() => setSubDialogOpen(true)}
                  className="h-8 rounded-full bg-violet-600 px-3.5 text-xs text-white hover:bg-violet-700"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  订阅
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setGroupDialogOpen(true)}
                  className="h-8 rounded-full px-3 text-xs"
                >
                  <FolderPlus className="mr-1 h-3.5 w-3.5" />
                  分组
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNodeDialogOpen(true)}
                  className="h-8 rounded-full px-3 text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  节点
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="定位当前选中节点"
                  onClick={handleLocateActive}
                >
                  <Crosshair className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {config.groups.map((group) => {
                const collapsed = Boolean(collapsedGroups[group.id]);
                const testingGroup = Boolean(testingGroupIds[group.id]);
                const refreshing = Boolean(refreshingGroupIds[group.id]);
                const isDefault = group.id === 'default-local-group';

                return (
                  <div
                    key={group.id}
                    className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs"
                  >
                    {/* 分组头部 */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setCollapsedGroups((prev) => ({
                          ...prev,
                          [group.id]: !prev[group.id],
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setCollapsedGroups((prev) => ({
                            ...prev,
                            [group.id]: !prev[group.id],
                          }));
                        }
                      }}
                      className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-accent/30"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{group.name}</span>
                          {group.kind === 'subscription' && (
                            <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                              订阅
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {group.kind === 'subscription' ? '订阅分组' : '本地分组'} ·{' '}
                          {group.nodes.length} 节点
                        </p>
                      </div>

                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {group.kind === 'subscription' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="更新订阅"
                            disabled={refreshing}
                            onClick={() => void handleRefreshSubscription(group.id, group.name)}
                          >
                            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                          </Button>
                        )}

                        {!isDefault && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="删除分组"
                            onClick={() => void handleDeleteGroup(group.id, group.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-blue-500/12 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {group.nodes.length}
                        </span>

                        {collapsed ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {!collapsed && (
                      <div className="border-t border-border/50 px-4 pb-4 pt-2.5">
                        {/* 分组内工具栏：测速 + 视图切换 */}
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="测试本分组所有节点延迟"
                              disabled={testingGroup || group.nodes.length === 0}
                              onClick={() => void handleTestGroup(group.id)}
                            >
                              {testingGroup ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Gauge className="h-4 w-4" />
                              )}
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title={viewMode === 'grid' ? '切换为列表视图' : '切换为卡片视图'}
                              onClick={() =>
                                setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))
                              }
                            >
                              {viewMode === 'grid' ? (
                                <List className="h-4 w-4" />
                              ) : (
                                <LayoutGrid className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {group.nodes.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-xs text-muted-foreground">
                            当前分组没有节点。点击上方「+ 订阅」或「+ 节点」即可添加。
                          </div>
                        ) : (
                          <div
                            className={cn(
                              viewMode === 'grid'
                                ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3'
                                : 'space-y-1.5'
                            )}
                          >
                            {group.nodes.map((node) => {
                              const isSelected = config.selected_node_id === node.id;
                              const isTesting = Boolean(testingNodeIds[node.id]);

                              return (
                                <div
                                  key={node.id}
                                  ref={isSelected ? activeNodeRef : undefined}
                                  onClick={() => void handleSelectNode(group.id, node)}
                                  className={cn(
                                    'group flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 transition-all',
                                    isSelected
                                      ? 'border-violet-500 bg-violet-500/[0.06] shadow-xs'
                                      : 'border-border/70 bg-background/60 hover:border-violet-400/60 hover:bg-accent/40'
                                  )}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <CountryBadge code={node.country_code} />
                                      <span className="truncate text-xs font-medium text-foreground">
                                        {node.name}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                      <span className="uppercase">{node.protocol}</span>
                                      <span className="truncate opacity-75">
                                        {node.server}:{node.port}
                                      </span>
                                    </div>
                                  </div>

                                  <div
                                    className="flex shrink-0 items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      title="测试延迟"
                                      disabled={isTesting}
                                      onClick={() => void handleTestNode(group.id, node.id)}
                                      className={cn(
                                        'rounded px-1.5 py-0.5 text-[11px] font-medium hover:bg-accent',
                                        formatLatencyColor(node.latency_ms)
                                      )}
                                    >
                                      {isTesting ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : node.latency_ms != null ? (
                                        `${node.latency_ms}ms`
                                      ) : (
                                        '测速'
                                      )}
                                    </button>

                                    {group.kind === 'local' && (
                                      <button
                                        type="button"
                                        title="删除节点"
                                        onClick={() => void handleDeleteNode(group.id, node.id)}
                                        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 弹窗 */}
      <AddSubscriptionDialog
        open={subDialogOpen}
        submitting={submitting}
        onOpenChange={setSubDialogOpen}
        onSubmit={handleAddSubscription}
      />
      <AddGroupDialog
        open={groupDialogOpen}
        submitting={submitting}
        onOpenChange={setGroupDialogOpen}
        onSubmit={handleAddGroup}
      />
      <AddNodeDialog
        open={nodeDialogOpen}
        groups={config.groups}
        submitting={submitting}
        onOpenChange={setNodeDialogOpen}
        onSubmit={handleAddNodes}
      />
    </div>
  );
}
