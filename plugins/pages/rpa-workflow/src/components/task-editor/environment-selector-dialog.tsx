import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Check, Globe, Loader2, Search } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { listRpaEnvironmentsPage } from '../../api';

export interface Environment {
  id: string;
  name: string;
  status: 'running' | 'ready';
}

interface EnvironmentSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (selectedIds: string[]) => void;
}

function EnvironmentRow({
  env,
  selected,
  onClick,
  statusRunningLabel,
  statusReadyLabel,
}: {
  env: Environment;
  selected: boolean;
  onClick: () => void;
  statusRunningLabel: string;
  statusReadyLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 ${
        selected
          ? 'border-primary/40 bg-primary/8 text-primary'
          : 'border-border/60 bg-background hover:bg-muted/60'
      }`}
    >
      <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors duration-150 group-hover:text-foreground">
        <Globe className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium leading-none">{env.name || env.id}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`inline-flex h-1.5 w-1.5 rounded-full ${
              env.status === 'running' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="truncate">
            {env.status === 'running' ? statusRunningLabel : statusReadyLabel}
          </span>
        </div>
      </div>

      <div
        className={`shrink-0 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
          selected
            ? 'border-primary bg-primary'
            : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'
        }`}
      >
        {selected ? <Check className="h-3 w-3 text-primary-foreground" /> : null}
      </div>
    </button>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20">
        <BadgeCheck className="h-8 w-8 text-blue-500/60" />
      </div>
      <h4 className="mb-1 text-sm font-medium text-foreground">{title}</h4>
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function EnvironmentSelectorDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: EnvironmentSelectorDialogProps) {
  const { t } = useTranslation('rpa');
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedIds);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalSelectedIds(selectedIds);
      setSearchQuery('');
      setEnvironments([]);
      setPage(1);
      setHasMore(false);
    }
  }, [open, selectedIds]);

  useEffect(() => {
    if (!open) return;

    const fetchFirstPage = async () => {
      setLoading(true);
      try {
        const result = await listRpaEnvironmentsPage({
          page: 1,
          page_size: 20,
          keyword: searchQuery,
        });
        setEnvironments(result.items);
        setPage(result.page);
        setHasMore(result.page * result.page_size < result.total);
      } catch (error) {
        console.error('Failed to fetch environments:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchFirstPage();
  }, [open, searchQuery]);

  const toggleEnvironment = (envId: string) => {
    setLocalSelectedIds((prev) =>
      prev.includes(envId) ? prev.filter((id) => id !== envId) : [...prev, envId]
    );
  };

  const handleConfirm = () => {
    onConfirm(localSelectedIds);
    onOpenChange(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await listRpaEnvironmentsPage({
        page: nextPage,
        page_size: 20,
        keyword: searchQuery,
      });
      setEnvironments((prev) => [...prev, ...result.items]);
      setPage(result.page);
      setHasMore(result.page * result.page_size < result.total);
    } catch (error) {
      console.error('Failed to load more environments:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const statusRunningLabel = t('editor.environments.running', { defaultValue: '运行中' });
  const statusReadyLabel = t('editor.environments.ready', { defaultValue: '就绪' });

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      header={{
        icon: BadgeCheck,
        title: t('editor.environments.selectTitle'),
        description: t('editor.environments.selectHint', {
          defaultValue: '选择需要绑定到当前任务的环境，可多选。',
        }),
      }}
      contentClassName="space-y-3"
    >
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('editor.environments.searchPlaceholder')}
          className="h-9 pl-9 pr-3 text-sm placeholder:text-sm"
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t('editor.environments.total')}: {environments.length}</span>
        <span>
          {t('editor.environments.selected', {
            count: localSelectedIds.length,
            defaultValue: `已选择 ${localSelectedIds.length} 个环境`,
          })}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : environments.length === 0 ? (
        <EmptyState
          title={t('editor.environments.noResults')}
          description={
            searchQuery.trim()
              ? t('editor.environments.searchEmptyDescription', {
                  defaultValue: '没有找到匹配的环境，请尝试调整搜索关键词。',
                })
              : t('editor.environments.emptyDescription', {
                  defaultValue: '当前没有可用环境，请先在环境管理中创建环境。',
                })
          }
        />
      ) : (
        <>
          <ScrollArea className="h-[360px] -mx-1 px-1">
            <div className="space-y-2">
              {environments.map((env) => (
                <EnvironmentRow
                  key={env.id}
                  env={env}
                  selected={localSelectedIds.includes(env.id)}
                  onClick={() => toggleEnvironment(env.id)}
                  statusRunningLabel={statusRunningLabel}
                  statusReadyLabel={statusReadyLabel}
                />
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-center pt-1">
            {hasMore ? (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    加载中
                  </>
                ) : (
                  '加载更多'
                )}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">没有更多环境了</span>
            )}
          </div>
        </>
      )}

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => onOpenChange(false)}>
          {t('dialog.settings.cancel')}
        </Button>
        <Button size="sm" className="text-xs" onClick={handleConfirm}>
          <Check className="mr-1.5 h-3.5 w-3.5" />
          {t('dialog.settings.confirm')} ({localSelectedIds.length})
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
