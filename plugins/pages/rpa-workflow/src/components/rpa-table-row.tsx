import { useTranslation } from 'react-i18next';
import {
  Play,
  Square,
  Edit,
  Trash2,
  MoreVertical,
  Copy,
  Clock,
  Zap,
  Hand,
  Monitor,
  FileText,
  Download,
  Loader2,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DataTableRowContainer,
  DataTableCell,
  DataTableCheckboxCell,
  DataTableActionsCell,
} from '@/components/data-table';
import type { RpaTask } from '../types';

interface RpaTableRowProps {
  task: RpaTask;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRun?: (id: string) => void;
  onStop?: (id: string) => void;
  onViewExecution?: (id: string) => void;
  onEdit?: (task: RpaTask) => void;
  onDelete?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onExport?: (id: string, name: string) => void;
  onViewLogs?: (id: string) => void;
  isExecuting?: boolean;
  isStopping?: boolean;
  canViewExecution?: boolean;
}

export function RpaTableRow({
  task,
  isSelected,
  onSelect,
  onRun,
  onStop,
  onViewExecution,
  onEdit,
  onDelete,
  onDuplicate,
  onExport,
  onViewLogs,
  isExecuting = false,
  isStopping = false,
  canViewExecution = false,
}: RpaTableRowProps) {
  const { t } = useTranslation('rpa');
  const effectiveStatus = isExecuting ? 'running' : task.status;

  const getStatusBadge = () => {
    const statusConfig = {
      idle: {
        label: t('status.idle'),
        className: 'bg-secondary text-muted-foreground border-border',
      },
      running: {
        label: isStopping ? '停止中' : t('status.running'),
        className: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
      },
      completed: {
        label: t('status.completed'),
        className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
      },
      failed: {
        label: t('status.failed'),
        className: 'bg-destructive/10 text-destructive border-destructive/30',
      },
    };
    const config = statusConfig[effectiveStatus];
    return (
      <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase border ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getTriggerIcon = () => {
    switch (task.triggerType) {
      case 'manual':
        return <Hand className="h-3.5 w-3.5 text-muted-foreground" />;
      case 'scheduled':
        return <Clock className="h-3.5 w-3.5 text-blue-500" />;
      case 'event':
        return <Zap className="h-3.5 w-3.5 text-amber-500" />;
    }
  };

  const getTriggerLabel = () => {
    switch (task.triggerType) {
      case 'manual':
        return t('trigger.manual');
      case 'scheduled':
        return task.schedule || t('trigger.scheduled');
      case 'event':
        return t('trigger.event');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <DataTableRowContainer isSelected={isSelected}>
      <DataTableCheckboxCell isSelected={isSelected} onSelect={() => onSelect(task.id)} />

      <DataTableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground">{task.name}</span>
          {task.description && (
            <span className="line-clamp-1 text-[10px] text-muted-foreground">{task.description}</span>
          )}
        </div>
      </DataTableCell>

      <DataTableCell>
        <div className="flex items-center gap-1.5">
          {getTriggerIcon()}
          <span className="text-xs text-muted-foreground">{getTriggerLabel()}</span>
        </div>
      </DataTableCell>

      <DataTableCell>
        <div className="flex items-center gap-1.5">
          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs">{task.environmentCount}</span>
        </div>
      </DataTableCell>

      <DataTableCell>{getStatusBadge()}</DataTableCell>

      <DataTableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs">{task.runCount}</span>
          <span className="text-[10px] text-muted-foreground">
            {t('table.successRate', { rate: task.successRate })}
          </span>
        </div>
      </DataTableCell>

      <DataTableCell>
        <span className="text-xs text-muted-foreground">{formatDate(task.lastRunAt)}</span>
      </DataTableCell>

      <DataTableCell>
        <span className="text-xs text-muted-foreground">
          {task.triggerType === 'scheduled' ? formatDate(task.nextRunAt) : '-'}
        </span>
      </DataTableCell>

      <DataTableActionsCell isSelected={isSelected}>
        {isExecuting ? (
          <button
            onClick={() => onStop?.(task.id)}
            className="h-7 w-7 flex items-center justify-center cursor-pointer transition-all border bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20"
            title={isStopping ? '停止中' : t('table.actions.stop')}
          >
            {isStopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <button
            onClick={() => onRun?.(task.id)}
            className="h-7 w-7 flex items-center justify-center cursor-pointer transition-all border bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
            title={t('table.actions.run')}
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          onClick={() => onViewExecution?.(task.id)}
          disabled={!canViewExecution}
          className="h-7 w-7 flex items-center justify-center transition-all border bg-secondary/40 text-muted-foreground border-border enabled:cursor-pointer enabled:hover:bg-accent enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          title="查看执行"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => onEdit?.(task)}
          className="h-7 w-7 flex items-center justify-center cursor-pointer transition-all border bg-blue-500/10 text-blue-500 border-blue-500/30 hover:bg-blue-500/20"
          title={t('table.actions.edit')}
        >
          <Edit className="h-3.5 w-3.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-7 w-7 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent"
              title={t('table.actions.more')}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onViewLogs?.(task.id)} className="cursor-pointer">
              <FileText className="w-4 h-4 mr-2" />
              <span>{t('table.actions.viewLogs')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate?.(task.id)} className="cursor-pointer">
              <Copy className="w-4 h-4 mr-2" />
              <span>{t('table.actions.duplicate')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport?.(task.id, task.name)} className="cursor-pointer">
              <Download className="w-4 h-4 mr-2" />
              <span>{t('table.actions.export', { defaultValue: '导出' })}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete?.(task.id, task.name)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              <span>{t('table.actions.delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DataTableActionsCell>
    </DataTableRowContainer>
  );
}
