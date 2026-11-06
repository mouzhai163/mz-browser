import { Fragment, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FaApple, FaFirefoxBrowser, FaLinux, FaWindows } from 'react-icons/fa';
import { SiGooglechrome } from 'react-icons/si';
import {
  MoreVertical,
  Edit,
  Trash2,
  Tag,
  FolderTree,
  Plus,
  UserPlus,
  Globe,
  Unplug,
  Play,
  Square,
  Download,
  Network,
  PlusCircle,
  List,
  User,
  StickyNote,
  Cookie,
  Eraser,
  Pencil,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';
import {
  DataTableRowContainer,
  DataTableCell,
  DataTableCheckboxCell,
  DataTableIndexCell,
  DataTableActionsCell,
} from '@/components/data-table';
import { useEnvironmentDialogStore, useEnvironmentSelectionStore, useRunningEnvsStore, useEnvironmentFiltersStore } from '../stores';
import { useEnvironmentOperations } from '../hooks/use-environment-operations';
import type { Environment, TagItem } from '../types';
import { parseFingerprint, getTagColorClasses, getTagDotColorClasses, getPlatformIcon } from '../utils';

interface EnvironmentTableRowProps {
  environment: Environment;
  index: number;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onEdit?: (environment: Environment) => void;
  availableTags?: TagItem[];
  onComplete?: () => void;
}

/**
 * 指纹信息图标显示组件
 * 优先使用 fingerprint_summary，如果没有则使用 system_info 和 kernel_info 组合
 */
function FingerprintIcons({ environment }: { environment: Environment }) {
  // 优先使用 fingerprint_summary，如果没有则组合 system_info 和 kernel_info
  const fingerprintText =
    environment.fingerprint_summary ||
    [environment.system_info, environment.kernel_info].filter(Boolean).join(' ') ||
    '';

  const { os, browser } = parseFingerprint(fingerprintText);

  const osItems: Array<{ key: string; label: string; node: React.ReactNode }> = [];
  const browserItems: Array<{ key: string; label: string; node: React.ReactNode }> = [];

  if (os === 'Windows') {
    osItems.push({
      key: 'os-windows',
      label: 'Windows',
      node: <FaWindows className="h-4 w-4 text-blue-500" />,
    });
  }
  if (os === 'macOS') {
    osItems.push({
      key: 'os-macos',
      label: 'macOS',
      node: <FaApple className="h-4 w-4 text-foreground" />,
    });
  }
  if (os === 'Linux') {
    osItems.push({
      key: 'os-linux',
      label: 'Linux',
      node: <FaLinux className="h-4 w-4 text-orange-500" />,
    });
  }

  if (browser === 'Chrome') {
    browserItems.push({
      key: 'browser-chrome',
      label: 'Chrome',
      node: <SiGooglechrome className="h-4 w-4 text-blue-500" />,
    });
  }
  if (browser === 'Firefox') {
    browserItems.push({
      key: 'browser-firefox',
      label: 'Firefox',
      node: <FaFirefoxBrowser className="h-4 w-4 text-orange-500" />,
    });
  }

  if (osItems.length === 0 && browserItems.length === 0) {
    return null;
  }

  const osIcon = osItems[0];
  const browserIcon = browserItems[0];

  return (
    <div className="flex items-center">
      {/* 操作系统边框 */}
      {osIcon && (
        <div className="inline-flex items-center rounded-md border bg-background px-2 py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help leading-none">{osIcon.node}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{osIcon.label}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* 连接线 */}
      {osIcon && browserIcon && <div className="w-4 h-px bg-border"></div>}

      {/* 浏览器边框 */}
      {browserIcon && (
        <div className="inline-flex items-center rounded-md border bg-background px-2 py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help leading-none">{browserIcon.node}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{browserIcon.label}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

/**
 * 代理信息单元格组件
 */
function ProxyCellContent({
  environment,
  onOpenProxyDialog,
  noProxyText,
  unsetText,
}: {
  environment: Environment;
  onOpenProxyDialog: () => void;
  noProxyText: string;
  unsetText: string;
}) {
  if (environment.proxy) {
    const { proxy } = environment;
    const flagCode = proxy.country_code || proxy.country;
    const isLocalProxy = proxy.source === 'local';
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onOpenProxyDialog}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent cursor-pointer"
          >
            {isLocalProxy ? (
              <Network className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex items-center gap-2">
            {flagCode && (
              <img
                src={`https://flagcdn.com/w20/${flagCode.toLowerCase()}.png`}
                className="h-3"
                alt={proxy.country || flagCode}
              />
            )}
            <div className="flex flex-col">
              <span className="font-mono text-xs">
                {proxy.name}
                {isLocalProxy && <span className="ml-1 text-[10px] text-muted-foreground">LOCAL</span>}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {proxy.host}:{proxy.port}
              </span>
              {proxy.city && (
                <span className="text-[10px] text-muted-foreground">{proxy.city}</span>
              )}
              {proxy.local_missing && (
                <span className="text-[10px] text-amber-600">本地代理不可用</span>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={onOpenProxyDialog}
      className="text-[10px] border px-2 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity bg-orange-50 text-orange-600 border-orange-300 border-dashed whitespace-nowrap flex items-center gap-1"
      title={noProxyText}
    >
      <Unplug className="h-3 w-3" />
      {unsetText}
    </button>
  );
}

/**
 * 账号信息单元格组件
 */
function AccountsCellContent({
  environment,
  onOpenAccountDialog,
  noAccountText,
}: {
  environment: Environment;
  onOpenAccountDialog: () => void;
  noAccountText: string;
}) {
  if (environment.accounts && environment.accounts.length > 0) {
    return (
      <div className="flex items-center gap-1">
        {environment.accounts.map((account) => {
          return (
            <Tooltip key={account.uuid}>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenAccountDialog}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent cursor-pointer"
                >
                  {getPlatformIcon(account.platform_url)}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex flex-col">
                  <p className="text-xs font-medium">{account.account}</p>
                  {account.platform_name && <p className="text-[10px] text-muted-foreground">{account.platform_name}</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return (
    <button
      onClick={onOpenAccountDialog}
      className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
      title={noAccountText}
    >
      <UserPlus className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * 分组单元格组件
 */
function GroupCellContent({
  environment,
  onOpenGroupDialog,
  assignGroupText,
  unsetText,
}: {
  environment: Environment;
  onOpenGroupDialog: () => void;
  assignGroupText: string;
  unsetText: string;
}) {
  if (environment.group) {
    return (
      <button
        onClick={onOpenGroupDialog}
        className="text-[10px] border px-2 py-0.5 font-bold rounded cursor-pointer hover:opacity-80 transition-opacity bg-muted"
        title={assignGroupText}
      >
        {environment.group.name}
      </button>
    );
  }

  return (
    <button
      onClick={onOpenGroupDialog}
      className="text-[10px] border px-2 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity bg-blue-50 text-blue-600 border-blue-300 border-dashed whitespace-nowrap flex items-center gap-1"
      title={assignGroupText}
    >
      <FolderTree className="h-3 w-3" />
      {unsetText}
    </button>
  );
}

/**
 * 标签单元格组件
 */
function TagsCellContent({
  environment,
  availableTags,
  onAssignTag,
  onRemoveTag,
  onCreateTag,
  assignTagText,
  createTagText,
  unsetText,
}: {
  environment: Environment;
  availableTags: TagItem[];
  onAssignTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateTag: () => void;
  assignTagText: string;
  createTagText: string;
  unsetText: string;
}) {
  const hasTags = environment.tags && environment.tags.length > 0;
  // 当前环境已有的标签 UUID 列表
  const currentTagUuids = environment.tags.map((t) => t.uuid);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {hasTags ? (
          <div className="flex items-center gap-1 flex-nowrap cursor-pointer">
            {environment.tags.map((tag) => (
              <span
                key={tag.uuid}
                className={`text-[10px] border px-2 py-0.5 font-bold rounded hover:opacity-80 transition-opacity ${getTagColorClasses(tag.color || 'gray')}`}
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : (
          <button
            className="text-[10px] border px-2 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity bg-purple-50 text-purple-600 border-purple-300 border-dashed whitespace-nowrap flex items-center gap-1"
            title={assignTagText}
          >
            <Tag className="h-3 w-3" />
            {unsetText}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 max-h-[300px]">
        <div className="max-h-[240px] overflow-y-auto">
          {availableTags.map((tag) => {
            const isChecked = currentTagUuids.includes(tag.uuid);
            return (
              <DropdownMenuCheckboxItem
                key={tag.uuid}
                checked={isChecked}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onAssignTag(tag.uuid);
                  } else {
                    onRemoveTag(tag.uuid);
                  }
                }}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className={`w-3 h-3 rounded border ${getTagDotColorClasses(tag.color)}`} />
                  <span className="flex-1">{tag.name}</span>
                </div>
              </DropdownMenuCheckboxItem>
            );
          })}
        </div>
        {availableTags.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={onCreateTag} className="cursor-pointer">
          <div className="flex items-center gap-2 w-full">
            <Plus className="h-4 w-4" />
            <span>{createTagText}</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 操作下拉菜单组件
 */
function ActionsDropdown({
  environment,
  isRunning,
  t,
  onEdit,
  onToggle,
  onExport,
  onAddProxy,
  onSelectProxy,
  onOpenAccountDialog,
  onEditName,
  onEditNote,
  onEditUrl,
  onEditTags,
  onEditCookies,
  onClearCache,
  onDelete,
}: {
  environment: Environment;
  isRunning: boolean;
  t: (key: string) => string;
  onEdit?: () => void;
  onToggle: () => void;
  onExport: () => void;
  onAddProxy: () => void;
  onSelectProxy: () => void;
  onOpenAccountDialog: () => void;
  onEditName: () => void;
  onEditNote: () => void;
  onEditUrl: () => void;
  onEditTags: () => void;
  onEditCookies: () => void;
  onClearCache: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title={t('table.actions.more')}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {/* 编辑窗口 */}
        <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
          <Edit className="w-4 h-4 mr-2" />
          <span>{t('table.actions.edit')}</span>
        </DropdownMenuItem>

        {/* 打开/关闭窗口 */}
        {isRunning ? (
          <DropdownMenuItem onClick={onToggle} className="cursor-pointer">
            <Square className="w-4 h-4 mr-2" />
            <span>{t('table.actions.closeWindow')}</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onToggle} className="cursor-pointer">
            <Play className="w-4 h-4 mr-2" />
            <span>{t('table.actions.openWindow')}</span>
          </DropdownMenuItem>
        )}

        {/* 导出窗口 */}
        <DropdownMenuItem onClick={onExport} className="cursor-pointer">
          <Download className="w-4 h-4 mr-2" />
          <span>{t('table.actions.exportWindow')}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* 代理操作 - 二级菜单 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <Network className="w-4 h-4 mr-2" />
            <span>{t('table.actions.proxyOperations')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            <DropdownMenuItem onClick={onAddProxy} className="cursor-pointer">
              <PlusCircle className="w-4 h-4 mr-2" />
              <span>{t('table.actions.addProxy')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSelectProxy} className="cursor-pointer">
              <List className="w-4 h-4 mr-2" />
              <span>{t('table.actions.selectProxy')}</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* 平台账号 */}
        <DropdownMenuItem onClick={onOpenAccountDialog} className="cursor-pointer">
          <User className="w-4 h-4 mr-2" />
          <span>{t('table.actions.platformAccount')}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* 编辑名称 */}
        <DropdownMenuItem onClick={onEditName} className="cursor-pointer">
          <Pencil className="w-4 h-4 mr-2" />
          <span>{t('table.actions.editName')}</span>
        </DropdownMenuItem>

        {/* 编辑备注 */}
        <DropdownMenuItem onClick={onEditNote} className="cursor-pointer">
          <StickyNote className="w-4 h-4 mr-2" />
          <span>{t('table.actions.editNote')}</span>
        </DropdownMenuItem>

        {/* 设置启动 URL */}
        <DropdownMenuItem onClick={onEditUrl} className="cursor-pointer">
          <Globe className="w-4 h-4 mr-2" />
          <span>{t('table.actions.editUrl')}</span>
        </DropdownMenuItem>

        {/* 编辑标签 */}
        <DropdownMenuItem onClick={onEditTags} className="cursor-pointer">
          <Tag className="w-4 h-4 mr-2" />
          <span>{t('table.actions.editTags')}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* 编辑 Cookies */}
        <DropdownMenuItem onClick={onEditCookies} className="cursor-pointer">
          <Cookie className="w-4 h-4 mr-2" />
          <span>{t('table.actions.editCookies')}</span>
        </DropdownMenuItem>

        {/* 清除缓存 */}
        <DropdownMenuItem onClick={onClearCache} className="cursor-pointer">
          <Eraser className="w-4 h-4 mr-2" />
          <span>{t('table.actions.clearCache')}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* 删除环境 */}
        <DropdownMenuItem
          onClick={onDelete}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          <span>{t('table.actions.deleteEnvironment')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 环境表格行组件
 */
export function EnvironmentTableRow({
  environment,
  index,
  isSelected = false,
  onSelect,
  onEdit,
  availableTags = [],
  onComplete,
}: EnvironmentTableRowProps) {
  const { t } = useTranslation('environment');
  const unsetText = t('table.unset');
  const dialogStore = useEnvironmentDialogStore();
  const selectionStore = useEnvironmentSelectionStore();
  const runningEnvsStore = useRunningEnvsStore();
  const filtersStore = useEnvironmentFiltersStore();
  const operations = useEnvironmentOperations(onComplete);

  // 使用 store 中的运行状态
  const isRunning = runningEnvsStore.isRunning(environment.uuid);
  const isStarting = runningEnvsStore.isStarting(environment.uuid);
  const isStopping = runningEnvsStore.isStopping(environment.uuid);
  const currentStatus = runningEnvsStore.getStatus(environment.uuid);
  const isShaking = runningEnvsStore.isShaking(environment.uuid);

  // 本地停止状态，用于立即触发动画
  const [isLocalStopping, setIsLocalStopping] = useState(false);

  // 计算启动进度（基于实际的下载进度）
  const isLoadingKernel = environment.uuid === operations.loadingEnvUuid;

  // 根据状态计算进度百分比
  const [startingProgress, setStartingProgress] = useState(0);
  const [startingPausePoint, setStartingPausePoint] = useState(0);
  const [stoppingProgress, setStoppingProgress] = useState(0);
  const [stoppingPausePoint, setStoppingPausePoint] = useState(0);

  useEffect(() => {
    if (isLoadingKernel && startingProgress === 0) {
      // 内核准备阶段：暂停点在 30-70 之间随机
      const pausePoint = 30 + Math.random() * 40;
      setStartingPausePoint(pausePoint);
      setStartingProgress(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStartingProgress(pausePoint);
        });
      });
    } else if (isStarting && startingProgress === 0) {
      // 批量启动时立即触发动画：跳转到 30-70% 之间的随机值
      const pausePoint = 30 + Math.random() * 40;
      setStartingPausePoint(pausePoint);
      setStartingProgress(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStartingProgress(pausePoint);
        });
      });
    } else if (currentStatus === 'initializing' && startingProgress >= 50 && startingProgress < 75) {
      // 初始化阶段：50-75%
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStartingProgress(75);
        });
      });
    } else if (currentStatus === 'starting' && startingProgress >= 75 && startingProgress < 100) {
      // 启动阶段：75-100%
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStartingProgress(100);
        });
      });
    }
  }, [isLoadingKernel, isStarting, currentStatus, startingProgress]);

  useEffect(() => {
    // 启动动画完成：收到启动完成通知后，进度到 100%
    if (currentStatus === 'running' && startingProgress > 0) {
      setStartingProgress(100);
      // 等待 CSS 动画播放完成（1500ms）后重置
      setTimeout(() => {
        setStartingProgress(0);
        setStartingPausePoint(0);
      }, 1500);
    }
  }, [currentStatus, startingProgress]);

  useEffect(() => {
    // 停止动画开始：只在 isLocalStopping 或 isStopping 从 false 变为 true 时触发
    if (isLocalStopping || isStopping) {
      // 生成 80-100 之间的随机暂停点
      const pausePoint = 80 + Math.random() * 20;
      setStoppingPausePoint(pausePoint);

      // 快速到达暂停点
      setStoppingProgress(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStoppingProgress(pausePoint);
        });
      });
    }
  }, [isLocalStopping, isStopping]);

  useEffect(() => {
    // 停止动画完成：收到停止完成通知后，进度到 100%
    if (currentStatus === 'stopped' && stoppingProgress > 0) {
      setStoppingProgress(100);
      // 动画结束后重置
      setTimeout(() => {
        setStoppingProgress(0);
        setStoppingPausePoint(0);
        setIsLocalStopping(false);
      }, 300);
    }
  }, [currentStatus, isRunning, stoppingProgress]);

  // 获取当前视图类型
  const isTrashMode = filtersStore.viewType === 'trash';

  // 切换环境状态
  const handleToggle = async () => {
    try {
      // 如果是停止操作，立即设置本地停止状态触发动画
      if (isRunning) {
        setIsLocalStopping(true);
      }
      await operations.toggleEnvironment(environment.uuid, String(index));
    } catch (e) {
      // 失败时重置本地停止状态
      setIsLocalStopping(false);
      toast.error(
        e instanceof Error ? e.message : t('table.actions.toggleFailed') || '切换状态失败'
      );
    }
  };

  // 删除环境（打开确认对话框）
  const handleDelete = () => {
    dialogStore.openDeleteConfirmDialog(environment);
  };

  // 恢复环境（打开确认对话框）
  const handleRestore = () => {
    dialogStore.openRestoreConfirmDialog(environment);
  };

  // 永久删除环境（打开确认对话框）
  const handlePermanentDelete = () => {
    dialogStore.openPermanentDeleteConfirmDialog(environment);
  };

  // 分配标签
  const handleAssignTag = async (tagId: string) => {
    const selectedTag = availableTags.find((t) => t.uuid === tagId);
    if (!selectedTag) return;
    try {
      await operations.assignTag(
        environment.uuid,
        selectedTag.uuid,
        selectedTag.name,
        selectedTag.color
      );
      toast.success('分配标签成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '分配标签失败');
    }
  };

  // 移除标签
  const handleRemoveTag = async (tagId: string) => {
    try {
      await operations.removeTag(environment.uuid, tagId);
      toast.success('移除标签成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '移除标签失败');
    }
  };

  // 导出窗口（导出单个环境配置）
  const handleExportWindow = async () => {
    // 使用与头部导出相同的逻辑，只导出当前环境
    const { exportEnvironmentsToCSV } = await import('../utils/export');
    await exportEnvironmentsToCSV([environment], environment.name);
  };

  // 选择已有代理（直接打开选择代理对话框）
  const handleSelectProxy = () => {
    dialogStore.openSelectProxyDialog(environment);
  };

  // 编辑名称
  const handleEditName = () => {
    dialogStore.openEditNameDialog(environment);
  };

  // 编辑备注
  const handleEditNote = () => {
    dialogStore.openEditNoteDialog(environment);
  };

  // 设置启动 URL
  const handleEditUrl = () => {
    dialogStore.openEditUrlDialog(environment);
  };

  // 编辑标签（打开单个环境标签配置对话框）
  const handleEditTags = () => {
    dialogStore.openAssignSingleTagDialog(environment);
  };

  // 编辑 Cookies（客户端功能）
  const handleEditCookies = () => {
    dialogStore.openEditCookiesDialog(environment);
  };

  // 清除缓存（打开确认对话框）
  const handleClearCache = () => {
    dialogStore.openClearCacheDialog(environment);
  };

  return (
    <DataTableRowContainer
      isSelected={isSelected}
      className={cn(
        isRunning && 'bg-green-50/50 hover:bg-green-50/70',
        isShaking && 'animate-shake'
      )}
    >
      {/* 选择框列 */}
      <DataTableCell
        isSelected={isSelected}
        stickyLeft
        stickyLeftOffset={0}
        align="center"
        // className="bg-muted"
      >
        {/* 启动进度条遮罩层 - 从左到右，覆盖整行 */}
        {(isLoadingKernel || isStarting || startingProgress > 0) && (
          <div
            className="absolute top-0 bottom-0 left-0 bg-blue-100/40 pointer-events-none transition-[width] duration-[1500ms] ease-out z-[1]"
            style={{
              width: `calc(100vw * ${startingProgress / 100})`,
            }}
          />
        )}
        <div className="flex items-center justify-center relative z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(value) => onSelect?.(environment.uuid, value as boolean)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4"
          />
        </div>
      </DataTableCell>

      {/* 序号列 */}
      <DataTableCell
        isSelected={isSelected}
        stickyLeft
        stickyLeftOffset={48}
        // className="bg-muted"
      >
        <span className="text-xs text-muted-foreground font-mono">{index}</span>
      </DataTableCell>

      {/* 指纹列 */}
      <DataTableCell>
        <FingerprintIcons environment={environment} />
      </DataTableCell>

      {/* 名称列 */}
      <DataTableCell>
        {environment.description ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-medium cursor-help">{environment.name}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{environment.description}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="font-medium">{environment.name}</span>
        )}
      </DataTableCell>

      {/* 代理列 */}
      <DataTableCell>
        <ProxyCellContent
          environment={environment}
          onOpenProxyDialog={() => dialogStore.openSelectProxyDialog(environment)}
          noProxyText={t('dialog.proxy.noProxy')}
          unsetText={unsetText}
        />
      </DataTableCell>

      {/* 账号列 */}
      <DataTableCell>
        <AccountsCellContent
          environment={environment}
          onOpenAccountDialog={() => dialogStore.openSelectAccountDialog(environment)}
          noAccountText={t('dialog.account.noAccount')}
        />
      </DataTableCell>

      {/* 分组列 */}
      <DataTableCell>
        <GroupCellContent
          environment={environment}
          onOpenGroupDialog={() => dialogStore.openAssignSingleGroupDialog(environment)}
          assignGroupText={t('table.actions.assignGroup')}
          unsetText={unsetText}
        />
      </DataTableCell>

      {/* 标签列 */}
      <DataTableCell>
        <TagsCellContent
          environment={environment}
          availableTags={availableTags}
          onAssignTag={(tagId) => void handleAssignTag(tagId)}
          onRemoveTag={(tagId) => void handleRemoveTag(tagId)}
          onCreateTag={dialogStore.openCreateTagDialog}
          assignTagText={t('table.actions.assignTag')}
          createTagText={t('dialog.manageTags.createTag')}
          unsetText={unsetText}
        />
      </DataTableCell>

      {/* 最后操作列 */}
      <DataTableCell className="text-xs text-muted-foreground font-mono">
        {environment.last_opened_at
          ? new Date(environment.last_opened_at).toLocaleString()
          : environment.created_at
            ? new Date(environment.created_at).toLocaleString()
            : '-'}
      </DataTableCell>

      {/* 操作列 */}
      <DataTableActionsCell isSelected={isSelected} sticky className='bg-muted'>
        {/* 停止进度条遮罩层 - 从右到左，覆盖整行 */}
        {(isLocalStopping || isStopping) && (
          <div
            className="absolute top-0 bottom-0 right-0 bg-orange-100/40 pointer-events-none transition-[width] duration-[800ms] ease-out z-[1]"
            style={{
              width: `calc(100vw * ${stoppingProgress / 100})`,
            }}
          />
        )}
        {isTrashMode ? (
          // 回收站模式：显示恢复和永久删除按钮
          <>
            <button
              onClick={handleRestore}
              className="px-3 py-1 text-[11px] font-bold transition-all rounded-md border flex items-center gap-1.5 bg-primary text-primary-foreground border-primary hover:bg-primary/90 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>恢复</span>
            </button>
            <button
              onClick={handlePermanentDelete}
              className="px-3 py-1 text-[11px] font-bold transition-all rounded-md border flex items-center gap-1.5 bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>永久删除</span>
            </button>
          </>
        ) : (
          // 正常模式：显示启动/停止按钮和操作菜单
          <>
            <button
              onClick={handleToggle}
              disabled={environment.uuid === operations.loadingEnvUuid || isStarting || isLocalStopping || isStopping}
              className={`px-3 py-1 text-[11px] font-bold transition-all rounded-md border flex items-center gap-1.5 ${
                environment.uuid === operations.loadingEnvUuid || isStarting || isLocalStopping || isStopping
                  ? 'bg-muted text-muted-foreground border-muted cursor-not-allowed'
                  : isRunning
                    ? 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90 cursor-pointer'
                    : 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 cursor-pointer'
              }`}
            >
              {environment.uuid === operations.loadingEnvUuid ? (
                <>
                  <span className="truncate max-w-[80px]" title={operations.kernelStatusMessage}>
                    {operations.kernelStatusMessage || '准备中…'}
                  </span>
                </>
              ) : isLocalStopping || isStopping ? (
                <>
                  <span>{t('table.actions.stopping') || '关闭中…'}</span>
                </>
              ) : isStarting ? (
                <>
                  <span>{t('table.actions.starting') || '启动中…'}</span>
                </>
              ) : isRunning ? (
                <>
                  <i className="fa-solid fa-stop text-[10px]"></i>
                  <span>{t('table.actions.stop')}</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-play text-[10px]"></i>
                  <span>{t('table.actions.start')}</span>
                </>
              )}
            </button>

            <ActionsDropdown
              environment={environment}
              isRunning={isRunning}
              t={t}
              onEdit={() => onEdit?.(environment)}
              onToggle={handleToggle}
              onExport={handleExportWindow}
              onAddProxy={() => dialogStore.openCreateProxyDialog()}
              onSelectProxy={handleSelectProxy}
              onOpenAccountDialog={() => dialogStore.openSelectAccountDialog(environment)}
              onEditName={handleEditName}
              onEditNote={handleEditNote}
              onEditUrl={handleEditUrl}
              onEditTags={handleEditTags}
              onEditCookies={handleEditCookies}
              onClearCache={handleClearCache}
              onDelete={handleDelete}
            />
          </>
        )}
      </DataTableActionsCell>
    </DataTableRowContainer>
  );
}
