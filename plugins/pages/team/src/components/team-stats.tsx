import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTeamFiltersStore } from '../stores';

interface TeamStatsProps {
  total?: number;
  active?: number;
  pending?: number;
  totalEnvironments?: number;
  onRefresh?: () => void;
}

export function TeamStats({
  total = 0,
  active = 0,
  pending = 0,
  totalEnvironments = 0,
  onRefresh,
}: TeamStatsProps) {
  const { t } = useTranslation('team');
  const filtersStore = useTeamFiltersStore();
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
        <span className="text-muted-foreground uppercase">{t('stats.active')}:</span>
        <span className="font-mono text-success font-bold">{active}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.pending')}:</span>
        <span className="font-mono text-amber-500 font-bold">{pending}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="text-muted-foreground uppercase">{t('stats.environments')}:</span>
        <span className="font-mono text-blue-500 font-bold">{totalEnvironments}</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
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
        {/* 刷新按钮 */}
        <button
          onClick={onRefresh}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title={t('stats.refresh')}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}
