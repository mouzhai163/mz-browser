import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Search, MousePointer2 } from 'lucide-react';
import { invoke } from '@/lib/tauri';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEnvironmentFiltersStore } from '../stores';

interface EnvironmentStatsProps {
  total?: number;
  running?: number;
  proxyErrors?: number;
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

export function EnvironmentStats({
  total = 0,
  running = 0,
  proxyErrors = 0,
  onManageTags,
}: EnvironmentStatsProps) {
  const { t } = useTranslation('environment');
  const filtersStore = useEnvironmentFiltersStore();
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    filtersStore.setSearchQuery(value);
  };

  const handleSearchToggle = () => {
    setSearchExpanded(true);
  };

  const handleSearchClose = () => {
    // 只有在搜索框为空时才收起
    if (!filtersStore.searchQuery.trim()) {
      setSearchExpanded(false);
    }
  };

  // 当搜索框展开时，自动聚焦
  useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchExpanded]);

  return (
    <section className="h-10 bg-background border-b border-border flex items-center px-6 gap-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.total')}:</span>
        <span className="font-mono text-foreground">{total}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.running')}:</span>
        <span className="font-mono text-success font-bold">{running}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.proxyErrors')}:</span>
        <span className="font-mono text-destructive font-bold">{proxyErrors}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {/* 搜索框 */}
        {searchExpanded ? (
          <div className="flex items-center" onMouseLeave={handleSearchClose}>
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={t('header.searchPlaceholder')}
              value={filtersStore.searchQuery}
              onChange={handleSearchChange}
              className="text-xs w-72 h-7"
              onKeyDown={(e) => {
                // ESC 键关闭搜索框（强制关闭，清空内容）
                if (e.key === 'Escape') {
                  filtersStore.setSearchQuery('');
                  setSearchExpanded(false);
                }
              }}
              onBlur={() => {
                // 失去焦点时，如果搜索框为空则收起
                setTimeout(() => {
                  if (!filtersStore.searchQuery.trim()) {
                    setSearchExpanded(false);
                  }
                }, 150);
              }}
            />
          </div>
        ) : (
          <button
            onClick={handleSearchToggle}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title={t('header.searchPlaceholder')}
          >
            <Search className="h-4 w-4" />
          </button>
        )}
        {/* 分割线 */}
        <div className="h-5 w-px bg-border" />
        {/* 同步器按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => void openSyncerWindow()}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <MousePointer2 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('stats.syncer') || '同步器'}</p>
          </TooltipContent>
        </Tooltip>
        {/* 分割线 */}
        <div className="h-5 w-px bg-border" />
        {/* 标签管理按钮 */}
        <button
          onClick={onManageTags}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title={t('stats.manageTags')}
        >
          <Tag className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
