import { useTranslation } from 'react-i18next';
import { FolderTree } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { GroupTableRow } from './group-table-row';
import type { Group } from '../types';

export type { Group };

/**
 * 空状态组件
 */
const EmptyState: React.FC<{
  t: (key: string) => string;
}> = ({ t }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      <FolderTree className="h-8 w-8 text-blue-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{t('table.empty')}</h4>
    <p className="text-xs text-muted-foreground text-center max-w-[240px]">
      {t('table.emptyDescription')}
    </p>
  </div>
);

interface GroupTableProps {
  groups: Group[];
  selectedIds?: Set<string>;
  onSelect?: (uuid: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onAssignToTeam?: (group: Group) => void;
  onEdit?: (group: Group) => void;
  onDelete?: (group: Group) => void;
  loading?: boolean;
}

export function GroupTable({
  groups,
  selectedIds = new Set(),
  onSelect,
  onSelectAll,
  onAssignToTeam,
  onEdit,
  onDelete,
  loading = false,
}: GroupTableProps) {
  const { t } = useTranslation('groups');

  // 定义列
  const columns: ColumnDef<Group>[] = [
    {
      id: 'name',
      header: t('table.headers.name'),
      cell: () => null,
      width: 200,
    },
    {
      id: 'environmentsCount',
      header: t('table.headers.environmentsCount'),
      cell: () => null,
      width: 96,
    },
    {
      id: 'team',
      header: t('table.headers.team'),
      cell: () => null,
      width: 160,
    },
    {
      id: 'createdBy',
      header: t('table.headers.createdBy'),
      cell: () => null,
      width: 112,
    },
    {
      id: 'createdAt',
      header: t('table.headers.createdAt'),
      cell: () => null,
      width: 128,
    },
    {
      id: 'description',
      header: t('table.headers.description'),
      cell: () => null,
      width: 256,
    },
    {
      id: 'actions',
      header: t('table.headers.actions'),
      cell: () => null,
      width: 160,
    },
  ];

  // 处理选择变化
  const handleSelectionChange = (newSelectedIds: Set<string>) => {
    // 检查是全选还是取消全选
    const allSelected = groups.length > 0 && groups.every((g) => newSelectedIds.has(g.uuid));
    const noneSelected = groups.every((g) => !newSelectedIds.has(g.uuid));

    if (allSelected && onSelectAll) {
      onSelectAll(true);
    } else if (noneSelected && onSelectAll) {
      onSelectAll(false);
    } else if (onSelect) {
      // 找出变化的项
      groups.forEach((group) => {
        const wasSelected = selectedIds.has(group.uuid);
        const isNowSelected = newSelectedIds.has(group.uuid);
        if (wasSelected !== isNowSelected) {
          onSelect(group.uuid, isNowSelected);
        }
      });
    }
  };

  return (
    <DataTable
      data={groups}
      columns={columns}
      getRowKey={(group) => group.uuid}
      loading={loading}
      skeletonRows={8}
      emptyText={<EmptyState t={t} />}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={handleSelectionChange}
      renderRow={({ row, rowKey, isSelected, onSelect: handleSelect }) => (
        <GroupTableRow
          key={rowKey}
          group={row}
          isSelected={isSelected}
          onSelect={(id, selected) => handleSelect(selected)}
          onAssignToTeam={onAssignToTeam}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    />
  );
}
