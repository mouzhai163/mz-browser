import { Download, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDownloadStore, type DownloadStatus } from '../../stores/download-store';

/**
 * 下载菜单组件：展示下载记录，进行中任务显示进度。
 * 事件监听在布局根 DownloadEventSubscriber 中注册，避免本组件重渲染导致只收到首次事件。
 */
export function DownloadMenu() {
  const { t } = useTranslation('appLayout');
  const tasks = useDownloadStore((s) => s.tasks);

  const activeCount = tasks.filter(
    (d) => d.status === 'downloading' || d.status === 'pending'
  ).length;
  const completedCount = tasks.filter(
    (d) => d.status === 'completed' || d.status === 'failed'
  ).length;
  const downloads = [...tasks].reverse();
  const clearCompleted = useDownloadStore((s) => s.clearCompleted);

  const getStatusIcon = (status: DownloadStatus) => {
    switch (status) {
      case 'downloading':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Download className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative w-8 h-8 flex items-center justify-center text-muted-foreground/80 hover:bg-accent/80 hover:text-foreground transition-all duration-200 ease-in-out rounded-sm cursor-pointer outline-none"
          title={t('download.title')}
        >
          <Download className="w-4 h-4" />
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('download.title')}</span>
          {activeCount > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              {t('download.active', { count: activeCount })}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {downloads.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('download.empty')}
          </div>
        ) : (
          downloads.map((task) => (
            <DropdownMenuItem
              key={task.id}
              className="flex flex-col items-stretch gap-1.5 cursor-default py-2.5"
              onSelect={(e) => e.preventDefault()}
            >
              <div className="flex items-center gap-3 min-w-0">
                {getStatusIcon(task.status)}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{task.name}</div>
                  {(task.status === 'downloading' || task.status === 'pending') &&
                    task.message && (
                      <div className="text-xs text-muted-foreground truncate">
                        {task.message}
                      </div>
                    )}
                </div>
                {(task.status === 'downloading' || task.status === 'pending') && (
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {task.progress >= 0 && task.progress <= 100
                      ? `${Math.round(task.progress)}%`
                      : '—'}
                  </span>
                )}
              </div>
              {(task.status === 'downloading' || task.status === 'pending') && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width:
                        task.progress >= 0 && task.progress <= 100
                          ? `${task.progress}%`
                          : '0%',
                    }}
                  />
                </div>
              )}
            </DropdownMenuItem>
          ))
        )}
        {downloads.length > 0 && completedCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs text-muted-foreground justify-center cursor-pointer"
              onSelect={() => clearCompleted()}
            >
              {t('download.clearCompleted')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
