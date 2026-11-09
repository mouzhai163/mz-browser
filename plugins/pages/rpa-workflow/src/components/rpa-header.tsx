import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Upload, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageTitle } from '@/components/page-title';
import { cn } from '@/lib/utils';

interface RpaHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateTask: () => void;
  onImportTask: () => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onRefresh: () => void;
  /** 放在页头和工具栏之间（统计卡片） */
  children?: ReactNode;
}

export function RpaHeader({
  searchQuery,
  onSearchChange,
  onCreateTask,
  onImportTask,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  children,
}: RpaHeaderProps) {
  const { t } = useTranslation('rpa');
  const filters = [
    { value: 'all', label: t('tabs.all') },
    { value: 'running', label: t('tabs.running') },
    { value: 'scheduled', label: t('tabs.scheduled') },
    { value: 'completed', label: t('tabs.completed') },
  ];

  return (
    <header className="space-y-4 px-6 pb-3 pt-5">
      <PageTitle
        title={t('header.title', { defaultValue: 'RPA 任务流' })}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={onImportTask}>
              <Upload className="h-4 w-4" />
              {t('header.importTask', { defaultValue: '导入' })}
            </Button>
            <Button size="sm" onClick={onCreateTask}>
              <Plus className="h-4 w-4" />
              {t('header.createTask')}
            </Button>
          </>
        }
      />

      {children}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex gap-0.5 rounded-md bg-black/[0.04] p-0.5 dark:bg-white/[0.08]">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => onStatusFilterChange(filter.value)}
                className={cn(
                  'h-7 rounded px-3 text-[13px] transition-colors',
                  statusFilter === filter.value
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onRefresh}
            title={t('stats.refresh')}
            aria-label={t('stats.refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('header.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 w-72 bg-card pl-8 text-[13px]"
          />
        </div>
      </div>
    </header>
  );
}
