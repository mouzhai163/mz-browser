import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, MousePointer2, Download, Search, LayoutList, Zap, TriangleAlert, Cpu } from 'lucide-react';
import { invoke } from '@/lib/tauri';
import { cn } from '@/lib/utils';
import { PageTitle } from '@/components/page-title';
import { StatCards, type StatCardItem } from '@/components/stat-cards';
import { Button } from '@/components/ui/button';
import { useEnvironmentFiltersStore, useEnvironmentSelectionStore, useRunningEnvsStore } from '../stores';
import type { EnvironmentViewType } from '../stores/filters-store';
import type { Environment } from '../types';
import { EnvironmentExportDialog } from './environment-export-dialog';
import { EnvironmentSearchDialog } from './environment-search-dialog';

interface EnvironmentHeaderProps {
  environments: Environment[];
  /** 服务端返回的当前视图总数 */
  total?: number;
  onComplete?: () => void;
  onManageTags?: () => void;
}

/**
 * 打开同步器窗口
 */
async function openSyncerWindow() {
  try {
    await invoke('create_syncer_window');
  } catch (error) {
    console.error('打开同步器窗口失败:', error);
  }
}

const PROXY_ERROR_STATUSES = new Set(['error', 'failed', 'unavailable', 'offline', 'inactive', 'invalid']);

export function EnvironmentHeader({ environments, total, onManageTags }: EnvironmentHeaderProps) {
  const { t } = useTranslation('environment');
  const filtersStore = useEnvironmentFiltersStore();
  const selectionStore = useEnvironmentSelectionStore();
  const statusCache = useRunningEnvsStore((state) => state.statusCache);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);

  // 监听 Ctrl+K / Cmd+K 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchDialogOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 计算要导出的环境列表
  const environmentsToExport = (() => {
    if (selectionStore.selectedIds.size > 0) {
      const selectedIds = Array.from(selectionStore.selectedIds);
      return environments.filter((env) => selectedIds.includes(env.uuid));
    }
    return environments;
  })();

  const stats = useMemo<StatCardItem[]>(() => {
    let running = 0;
    statusCache.forEach((status) => {
      if (status === 'running') running += 1;
    });
    const proxyErrors = environments.filter(
      (env) => env.proxy && PROXY_ERROR_STATUSES.has(String(env.proxy.status).toLowerCase())
    ).length;
    const kernels = new Set(environments.map((env) => env.kernel_info).filter(Boolean)).size;
    return [
      { key: 'total', label: t('header.statTotal', { defaultValue: '全部环境' }), value: total ?? environments.length, icon: LayoutList, tone: 'primary' },
      { key: 'running', label: t('stats.running'), value: running, icon: Zap, tone: 'success' },
      { key: 'proxy', label: t('stats.proxyErrors'), value: proxyErrors, icon: TriangleAlert, tone: 'danger' },
      { key: 'kernels', label: t('header.statKernels', { defaultValue: '使用中的内核' }), value: kernels, icon: Cpu, tone: 'warning' },
    ];
  }, [environments, statusCache, t, total]);

  const viewTypes: { value: EnvironmentViewType; key: string }[] = [
    { value: 'all', key: 'header.viewAll' },
    { value: 'opened', key: 'header.viewOpened' },
    { value: 'trash', key: 'header.viewTrash' },
  ];

  return (
    <header className="space-y-4 px-6 pb-3 pt-5">
      <PageTitle
        title={t('header.title', { defaultValue: '环境' })}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void openSyncerWindow()}>
              <MousePointer2 className="h-4 w-4" />
              {t('stats.syncer') || '同步器'}
            </Button>
            <Button variant="outline" size="sm" onClick={onManageTags}>
              <Tag className="h-4 w-4" />
              {t('stats.manageTags') || '标签管理'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)}>
              <Download className="h-4 w-4" />
              {t('header.export')}
            </Button>
          </>
        }
      />

      <StatCards items={stats} />

      <div className="flex items-center justify-between gap-3">
        {/* 视图类型：Ant Design 分段控制器样式 */}
        <div className="inline-flex gap-0.5 rounded-md bg-black/[0.04] p-0.5 dark:bg-white/[0.08]">
          {viewTypes.map((view) => (
            <button
              key={view.value}
              onClick={() => filtersStore.setViewType(view.value)}
              className={cn(
                'h-7 rounded px-3 text-[13px] transition-colors',
                filtersStore.viewType === view.value
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(view.key)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSearchDialogOpen(true)}
          className="flex h-8 w-72 items-center gap-2 rounded-md border border-input bg-card px-3 text-[13px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">{t('header.searchPlaceholder')}</span>
          <span className="text-[10px] opacity-60">Ctrl+K</span>
        </button>
      </div>

      <EnvironmentExportDialog
        open={exportDialogOpen}
        environments={environmentsToExport}
        onOpenChange={setExportDialogOpen}
      />

      <EnvironmentSearchDialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen} />
    </header>
  );
}
