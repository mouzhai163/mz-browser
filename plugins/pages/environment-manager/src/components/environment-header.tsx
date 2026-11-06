import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, MousePointer2, Download, Search } from 'lucide-react';
import { invoke } from '@/lib/tauri';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEnvironmentFiltersStore, useEnvironmentSelectionStore } from '../stores';
import type { EnvironmentViewType } from '../stores/filters-store';
import type { Environment } from '../types';
import { EnvironmentExportDialog } from './environment-export-dialog';
import { EnvironmentSearchDialog } from './environment-search-dialog';

interface EnvironmentHeaderProps {
  environments: Environment[];
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

export function EnvironmentHeader({ environments, onComplete, onManageTags }: EnvironmentHeaderProps) {
  const { t } = useTranslation('environment');
  const filtersStore = useEnvironmentFiltersStore();
  const selectionStore = useEnvironmentSelectionStore();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);

  const handleExportClick = () => {
    setExportDialogOpen(true);
  };

  // 监听 Ctrl+K / Cmd+K 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K (Windows/Linux) 或 Cmd+K (Mac)
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

  const viewTypes: { value: EnvironmentViewType; key: string }[] = [
    { value: 'all', key: 'header.viewAll' },
    { value: 'opened', key: 'header.viewOpened' },
    { value: 'trash', key: 'header.viewTrash' },
  ];

  return (
    <header className="border-b border-border flex items-center justify-between px-4 py-2 bg-background/10 backdrop-blur-2xl">
      <div className="flex items-center gap-4">
        {/* 视图类型菜单 */}
        <div className="flex items-center gap-2 p-1 bg-secondary rounded-xl">
          {viewTypes.map((view) => (
            <button
              key={view.value}
              onClick={() => filtersStore.setViewType(view.value)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-xl transition-all duration-200',
                filtersStore.viewType === view.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {t(view.key)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* 搜索按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setSearchDialogOpen(true)}
              className="h-8 px-3 flex items-center justify-center gap-2 rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Search className="h-4 w-4" />
              <div className="h-3 w-px bg-border" />
              <span className="text-[10px] font-medium opacity-60">Ctrl+K</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('header.search')}</p>
          </TooltipContent>
        </Tooltip>

        {/* 同步器按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => void openSyncerWindow()}
              className="h-8 px-3 flex items-center justify-center gap-2 rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              <MousePointer2 className="h-4 w-4" />
              <span>{t('stats.syncer') || '同步器'}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('stats.syncer') || '同步器'}</p>
          </TooltipContent>
        </Tooltip>

        {/* 标签管理按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onManageTags}
              className="h-8 px-3 flex items-center justify-center gap-2 rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              <Tag className="h-4 w-4" />
              <span>{t('stats.manageTags') || '标签管理'}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('stats.manageTags') || '标签管理'}</p>
          </TooltipContent>
        </Tooltip>

        {/* 导出按钮 */}
        <button
          onClick={handleExportClick}
          className="h-8 px-3 flex items-center justify-center gap-2 rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-xs font-medium"
        >
          <Download className="h-4 w-4" />
          <span>{t('header.export')}</span>
        </button>
      </div>

      <EnvironmentExportDialog
        open={exportDialogOpen}
        environments={environmentsToExport}
        onOpenChange={setExportDialogOpen}
      />

      <EnvironmentSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
      />
    </header>
  );
}
