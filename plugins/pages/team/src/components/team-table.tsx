import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { TeamTableRow, type TeamMember } from './team-table-row';
import { useTeamSelectionStore } from '../stores';

export type { TeamMember };

/**
 * 空状态组件
 */
const EmptyState: React.FC<{
  t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ t }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
      <Users className="h-8 w-8 text-primary/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{t('table.empty')}</h4>
    <p className="text-xs text-muted-foreground text-center max-w-[240px]">
      {t('table.emptyDescription')}
    </p>
  </div>
);

interface TeamTableProps {
  members: TeamMember[];
  onChangeRole?: (member: TeamMember, newRole: TeamMember['role']) => void;
  onDelete?: (id: string, name: string) => void;
  loading?: boolean;
  startIndex?: number;
}

export function TeamTable({
  members,
  onChangeRole,
  onDelete,
  loading = false,
  startIndex = 0,
}: TeamTableProps) {
  const { t } = useTranslation('team');
  const selectionStore = useTeamSelectionStore();

  // 排除 owner 的选择
  const selectableMembers = members.filter((m) => m.role !== 'owner');

  // 定义列
  const columns: ColumnDef<TeamMember>[] = [
    {
      id: 'member',
      header: t('table.headers.member'),
      cell: () => null,
      width: 256,
    },
    {
      id: 'role',
      header: t('table.headers.role'),
      cell: () => null,
      width: 128,
    },
    {
      id: 'status',
      header: t('table.headers.status'),
      cell: () => null,
      width: 96,
    },
    {
      id: 'environments',
      header: t('table.headers.environments'),
      cell: () => null,
      width: 96,
    },
    {
      id: 'groups',
      header: t('table.headers.groups'),
      cell: () => null,
      width: 96,
    },
    {
      id: 'joinedAt',
      header: t('table.headers.joinedAt'),
      cell: () => null,
      width: 112,
    },
    {
      id: 'actions',
      header: t('table.headers.actions'),
      cell: () => null,
      width: 80,
    },
  ];

  // 处理选择变化
  const handleSelectionChange = (newSelectedIds: Set<string>) => {
    // 过滤掉 owner 的 ID（owner 不能被选中）
    const filteredNewSelectedIds = new Set<string>();
    newSelectedIds.forEach((id) => {
      const member = members.find((m) => m.id === id);
      if (member && member.role !== 'owner') {
        filteredNewSelectedIds.add(id);
      }
    });

    // 检查是否全选或全不选
    const allSelected =
      selectableMembers.length > 0 &&
      selectableMembers.every((m) => filteredNewSelectedIds.has(m.id));
    const noneSelected = selectableMembers.every((m) => !filteredNewSelectedIds.has(m.id));

    if (allSelected) {
      selectionStore.selectAll(selectableMembers.map((m) => m.id));
    } else if (noneSelected) {
      selectionStore.clearSelection();
    }

    // 处理单个选择变化
    selectableMembers.forEach((member) => {
      const wasSelected = selectionStore.selectedIds.has(member.id);
      const isNowSelected = filteredNewSelectedIds.has(member.id);
      if (wasSelected !== isNowSelected) {
        selectionStore.select(member.id, isNowSelected);
      }
    });
  };

  return (
    <DataTable
      data={members}
      columns={columns}
      getRowKey={(member) => member.id}
      loading={loading}
      skeletonRows={8}
      emptyText={<EmptyState t={t} />}
      selectable
      selectedIds={selectionStore.selectedIds}
      onSelectionChange={handleSelectionChange}
      startIndex={startIndex}
      renderRow={({ row, rowKey, isSelected, onSelect: handleSelect }) => (
        <TeamTableRow
          key={rowKey}
          member={row}
          isSelected={isSelected}
          onSelect={(_id, selected) => handleSelect(selected)}
          onChangeRole={onChangeRole}
          onDelete={onDelete}
        />
      )}
    />
  );
}
