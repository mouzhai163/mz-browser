import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { AccountTableRow } from './account-table-row';
import type { Account } from '../types';

/**
 * 空状态组件
 */
const EmptyState: React.FC<{
  t: (key: string) => string;
}> = ({ t }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      <User className="h-8 w-8 text-blue-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{t('table.empty')}</h4>
  </div>
);

interface AccountTableProps {
  accounts: Account[];
  selectedIds: Set<string>;
  onSelect: (uuid: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  loading?: boolean;
}

export function AccountTable({
  accounts,
  selectedIds,
  onSelect,
  onSelectAll,
  onEdit,
  onDelete,
  loading,
}: AccountTableProps) {
  const { t } = useTranslation('account');

  // 定义列
  const columns: ColumnDef<Account>[] = [
    {
      id: 'platform',
      header: t('table.headers.platform'),
      cell: () => null,
      width: 128,
    },
    {
      id: 'account',
      header: t('table.headers.account'),
      cell: () => null,
      width: 192,
    },
    {
      id: 'password',
      header: t('table.headers.password'),
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
      id: 'linkedEnvironments',
      header: t('table.headers.linkedEnvironments'),
      cell: () => null,
      width: 96,
    },
    {
      id: 'lastUsed',
      header: t('table.headers.lastUsed'),
      cell: () => null,
      width: 112,
    },
    {
      id: 'createdAt',
      header: t('table.headers.createdAt'),
      cell: () => null,
      width: 112,
    },
    {
      id: 'actions',
      header: t('table.headers.actions'),
      cell: () => null,
      width: 112,
    },
  ];

  // 处理选择变化
  const handleSelectionChange = (newSelectedIds: Set<string>) => {
    const allSelected = accounts.length > 0 && accounts.every((a) => newSelectedIds.has(a.uuid));
    const noneSelected = accounts.every((a) => !newSelectedIds.has(a.uuid));

    if (allSelected) {
      onSelectAll(true);
    } else if (noneSelected) {
      onSelectAll(false);
    } else {
      accounts.forEach((account) => {
        const wasSelected = selectedIds.has(account.uuid);
        const isNowSelected = newSelectedIds.has(account.uuid);
        if (wasSelected !== isNowSelected) {
          onSelect(account.uuid, isNowSelected);
        }
      });
    }
  };

  return (
    <DataTable
      data={accounts}
      columns={columns}
      getRowKey={(account) => account.uuid}
      loading={loading}
      skeletonRows={8}
      emptyText={<EmptyState t={t} />}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={handleSelectionChange}
      renderRow={({ row, rowKey, isSelected, onSelect: handleSelect }) => (
        <AccountTableRow
          key={rowKey}
          account={row}
          isSelected={isSelected}
          onSelect={(_, selected) => handleSelect(selected)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    />
  );
}
