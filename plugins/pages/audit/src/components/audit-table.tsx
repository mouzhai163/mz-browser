import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, X, CalendarIcon, FileText } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { AuditTableRow } from './audit-table-row';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { AuditLog } from '../types';

interface AuditTableProps {
  logs: AuditLog[];
  actionFilter: string;
  onActionFilterChange: (value: string) => void;
  targetTypeFilter: string;
  onTargetTypeFilterChange: (value: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  loading?: boolean;
}

export function AuditTable({
  logs,
  actionFilter,
  onActionFilterChange,
  targetTypeFilter,
  onTargetTypeFilterChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  loading = false,
}: AuditTableProps) {
  const { t } = useTranslation('audit');
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const actions = [
    { value: '', label: t('filters.allActions') },
    { value: 'create', label: t('action.create') },
    { value: 'update', label: t('action.update') },
    { value: 'delete', label: t('action.delete') },
    { value: 'login', label: t('action.login') },
    { value: 'logout', label: t('action.logout') },
    { value: 'register', label: t('action.register') },
    { value: 'export', label: t('action.export') },
    { value: 'import', label: t('action.import') },
    { value: 'start', label: t('action.start') },
    { value: 'stop', label: t('action.stop') },
    { value: 'batch', label: t('action.batch') },
    { value: 'batch_create', label: t('action.batch_create') },
    { value: 'batch_delete', label: t('action.batch_delete') },
    { value: 'batch_import', label: t('action.batch_import') },
    { value: 'invite', label: t('action.invite') },
    { value: 'remove', label: t('action.remove') },
    { value: 'accept_invitation', label: t('action.accept_invitation') },
    { value: 'reject_invitation', label: t('action.reject_invitation') },
    { value: 'leave', label: t('action.leave') },
    { value: 'update_password', label: t('action.update_password') },
  ];

  const targetTypes = [
    { value: '', label: t('filters.allTargetTypes') },
    { value: 'environment', label: t('targetType.environment') },
    { value: 'group', label: t('targetType.group') },
    { value: 'tag', label: t('targetType.tag') },
    { value: 'proxy', label: t('targetType.proxy') },
    { value: 'team', label: t('targetType.team') },
    { value: 'team_member', label: t('targetType.team_member') },
    { value: 'user', label: t('targetType.user') },
    { value: 'settings', label: t('targetType.settings') },
    { value: 'system', label: t('targetType.system') },
  ];

  const getActionLabel = () => {
    if (!actionFilter) return null;
    const item = actions.find((a) => a.value === actionFilter);
    return item?.label;
  };

  const getTargetTypeLabel = () => {
    if (!targetTypeFilter) return null;
    const item = targetTypes.find((tt) => tt.value === targetTypeFilter);
    return item?.label;
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'MM/dd', { locale: zhCN });
    } catch {
      return dateStr;
    }
  };

  const columns: ColumnDef<AuditLog>[] = useMemo(
    () => [
      {
        id: 'action',
        header: () => (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span className="shrink-0">{t('table.headers.action')}</span>
            {!actionFilter ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors shrink-0">
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-32">
                  {actions.map((action) => (
                    <DropdownMenuItem
                      key={action.value}
                      onClick={() => onActionFilterChange(action.value)}
                      className="text-xs cursor-pointer"
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <span
                  className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded max-w-[80px] truncate"
                  title={getActionLabel() || ''}
                >
                  {getActionLabel()}
                </span>
                <button
                  onClick={() => onActionFilterChange('')}
                  className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-destructive/20 text-destructive transition-colors shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ),
        width: 128,
      },
      {
        id: 'target',
        header: () => (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span className="shrink-0">{t('table.headers.target')}</span>
            {!targetTypeFilter ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors shrink-0">
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-32">
                  {targetTypes.map((type) => (
                    <DropdownMenuItem
                      key={type.value}
                      onClick={() => onTargetTypeFilterChange(type.value)}
                      className="text-xs cursor-pointer"
                    >
                      {type.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <span
                  className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded max-w-[80px] truncate"
                  title={getTargetTypeLabel() || ''}
                >
                  {getTargetTypeLabel()}
                </span>
                <button
                  onClick={() => onTargetTypeFilterChange('')}
                  className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-destructive/20 text-destructive transition-colors shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ),
        width: 160,
      },
      {
        id: 'details',
        header: t('table.headers.details'),
        width: 288,
      },
      {
        id: 'timestamp',
        header: () => (
          <div className="flex items-center gap-1">
            <span>{t('table.headers.timestamp')}</span>
            <div className="flex items-center gap-0.5">
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <button className="h-5 px-1 flex items-center gap-0.5 rounded hover:bg-accent transition-colors text-[9px]">
                    {startDate ? (
                      <span className="text-primary font-bold bg-primary/10 px-1 rounded">
                        {formatDateDisplay(startDate)}
                      </span>
                    ) : (
                      <CalendarIcon className="h-3 w-3" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate ? new Date(startDate) : undefined}
                    onSelect={(date) => {
                      onStartDateChange(date ? format(date, 'yyyy-MM-dd') : '');
                      setStartDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">-</span>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <button className="h-5 px-1 flex items-center gap-0.5 rounded hover:bg-accent transition-colors text-[9px]">
                    {endDate ? (
                      <span className="text-primary font-bold bg-primary/10 px-1 rounded">
                        {formatDateDisplay(endDate)}
                      </span>
                    ) : (
                      <CalendarIcon className="h-3 w-3" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate ? new Date(endDate) : undefined}
                    onSelect={(date) => {
                      onEndDateChange(date ? format(date, 'yyyy-MM-dd') : '');
                      setEndDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  onStartDateChange('');
                  onEndDateChange('');
                }}
                className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-destructive/20 text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ),
        width: 192,
      },
      {
        id: 'operator',
        header: t('table.headers.operator'),
        width: 96,
      },
      {
        id: 'ipAddress',
        header: t('table.headers.ipAddress'),
        width: 128,
      },
    ],
    [
      t,
      actionFilter,
      targetTypeFilter,
      startDate,
      endDate,
      startDateOpen,
      endDateOpen,
      actions,
      targetTypes,
      onActionFilterChange,
      onTargetTypeFilterChange,
      onStartDateChange,
      onEndDateChange,
    ]
  );

  return (
    <DataTable
      data={logs}
      columns={columns}
      getRowKey={(log) => log.id}
      loading={loading}
      skeletonRows={8}
      emptyText={
        <div className="flex flex-col items-center justify-center py-8">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <div className="text-xs">{t('table.empty')}</div>
        </div>
      }
      renderRow={({ row, rowKey }) => <AuditTableRow key={rowKey} log={row} />}
    />
  );
}
