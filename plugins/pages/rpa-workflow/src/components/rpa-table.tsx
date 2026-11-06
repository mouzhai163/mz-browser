import { useTranslation } from 'react-i18next';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { RpaTableRow } from './rpa-table-row';
import type { RpaTask } from '../types';

export type { RpaTask };

interface RpaTableProps {
  tasks: RpaTask[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: (selected: boolean) => void;
  onRun?: (id: string) => void;
  onStop?: (id: string) => void;
  onViewExecution?: (id: string) => void;
  onEdit?: (task: RpaTask) => void;
  onDelete?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onExport?: (id: string, name: string) => void;
  onViewLogs?: (id: string) => void;
  isTaskExecuting?: (id: string) => boolean;
  isTaskStopping?: (id: string) => boolean;
  canViewExecution?: (id: string) => boolean;
  loading?: boolean;
}

export function RpaTable({
  tasks,
  selectedIds,
  onSelect,
  onSelectAll,
  onRun,
  onStop,
  onViewExecution,
  onEdit,
  onDelete,
  onDuplicate,
  onExport,
  onViewLogs,
  isTaskExecuting,
  isTaskStopping,
  canViewExecution,
  loading = false,
}: RpaTableProps) {
  const { t } = useTranslation('rpa');

  const columns: ColumnDef<RpaTask>[] = [
    { id: 'name', header: t('table.headers.name'), cell: () => null, width: 128 },
    { id: 'trigger', header: t('table.headers.trigger'), cell: () => null, width: 128 },
    { id: 'environments', header: t('table.headers.environments'), cell: () => null, width: 96 },
    { id: 'status', header: t('table.headers.status'), cell: () => null, width: 96 },
    { id: 'runCount', header: t('table.headers.runCount'), cell: () => null, width: 96 },
    { id: 'lastRun', header: t('table.headers.lastRun'), cell: () => null, width: 128 },
    { id: 'nextRun', header: t('table.headers.nextRun'), cell: () => null, width: 128 },
    { id: 'actions', header: t('table.headers.actions'), cell: () => null, width: 144 },
  ];

  const handleSelectionChange = (newSelectedIds: Set<string>) => {
    const allSelected = tasks.length > 0 && tasks.every((task) => newSelectedIds.has(task.id));
    const noneSelected = tasks.every((task) => !newSelectedIds.has(task.id));

    if (allSelected) {
      onSelectAll(true);
    } else if (noneSelected) {
      onSelectAll(false);
    } else {
      tasks.forEach((task) => {
        const wasSelected = selectedIds.has(task.id);
        const isNowSelected = newSelectedIds.has(task.id);
        if (wasSelected !== isNowSelected) {
          onSelect(task.id);
        }
      });
    }
  };

  return (
    <DataTable
      data={tasks}
      columns={columns}
      getRowKey={(task) => task.id}
      loading={loading}
      skeletonRows={8}
      emptyText={t('table.empty')}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={handleSelectionChange}
      renderRow={({ row, rowKey, isSelected, onSelect: handleSelect }) => (
        <RpaTableRow
          key={rowKey}
          task={row}
          isSelected={isSelected}
          onSelect={() => handleSelect(!isSelected)}
          onRun={onRun}
          onStop={onStop}
          onViewExecution={onViewExecution}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onExport={onExport}
          onViewLogs={onViewLogs}
          isExecuting={isTaskExecuting?.(row.id) ?? false}
          isStopping={isTaskStopping?.(row.id) ?? false}
          canViewExecution={canViewExecution?.(row.id) ?? false}
        />
      )}
    />
  );
}
