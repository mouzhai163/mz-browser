import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ChevronDown, X, Monitor } from 'lucide-react';
import { useEnvironmentFiltersStore, useEnvironmentSelectionStore } from '../stores';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { EnvironmentTableRow } from './environment-table-row';
import type { Environment, GroupItem, TagItem } from '../types';

/**
 * 空状态组件
 */
const EmptyState: React.FC<{
  t: (key: string) => string;
  viewType: 'all' | 'opened' | 'trash';
}> = ({ t, viewType }) => {
  const getEmptyContent = () => {
    switch (viewType) {
      case 'opened':
        return {
          title: t('table.emptyOpened'),
          description: t('table.emptyOpenedDescription'),
        };
      case 'trash':
        return {
          title: t('table.emptyTrash'),
          description: t('table.emptyTrashDescription'),
        };
      default:
        return {
          title: t('table.empty'),
          description: t('table.emptyDescription'),
        };
    }
  };

  const content = getEmptyContent();

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
        <Monitor className="h-8 w-8 text-blue-500/60" />
      </div>
      <h4 className="text-sm font-medium text-foreground mb-1">{content.title}</h4>
      <p className="text-xs text-muted-foreground text-center max-w-[240px]">
        {content.description}
      </p>
    </div>
  );
};

interface EnvironmentTableProps {
  environments: Environment[];
  availableTags?: TagItem[];
  availableGroups?: GroupItem[];
  loading?: boolean;
  onComplete?: () => void;
  startIndex?: number;
}

export function EnvironmentTable({
  environments,
  availableTags = [],
  availableGroups = [],
  loading = false,
  onComplete,
  startIndex = 0,
}: EnvironmentTableProps) {
  const { t } = useTranslation('environment');
  const navigate = useNavigate();
  const filtersStore = useEnvironmentFiltersStore();
  const selectionStore = useEnvironmentSelectionStore();

  const getTagLabel = () => {
    if (!filtersStore.filterTagId) return '';
    const tag = availableTags.find((t) => t.uuid === filtersStore.filterTagId);
    return tag?.name || '';
  };

  const getGroupLabel = () => {
    if (!filtersStore.filterGroupId) return '';
    const group = availableGroups.find((g) => g.uuid === filtersStore.filterGroupId);
    return group?.name || '';
  };

  // 分组列表头（带过滤下拉）
  const GroupHeader = () => (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span className="shrink-0">{t('table.headers.group')}</span>
      {availableGroups.length > 0 && (
        <>
          {!filtersStore.filterGroupId ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors shrink-0">
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32">
                <DropdownMenuItem
                  onClick={() => filtersStore.setFilterGroupId('')}
                  className="text-xs cursor-pointer"
                >
                  {t('table.filterAllGroups')}
                </DropdownMenuItem>
                {availableGroups.map((group) => (
                  <DropdownMenuItem
                    key={group.uuid}
                    onClick={() => filtersStore.setFilterGroupId(group.uuid)}
                    className="text-xs cursor-pointer"
                  >
                    {group.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <span
                className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded max-w-[80px] truncate"
                title={getGroupLabel()}
              >
                {getGroupLabel()}
              </span>
              <button
                onClick={() => filtersStore.setFilterGroupId('')}
                className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-destructive/20 text-destructive transition-colors shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );

  // 标签列表头（带过滤下拉）
  const TagHeader = () => (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span className="shrink-0">{t('table.headers.tag')}</span>
      {availableTags.length > 0 && (
        <>
          {!filtersStore.filterTagId ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors shrink-0">
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32 max-h-[300px]">
                <DropdownMenuItem
                  onClick={() => filtersStore.setFilterTagId('')}
                  className="text-xs cursor-pointer"
                >
                  {t('table.filterAllTags')}
                </DropdownMenuItem>
                <div className="max-h-[240px] overflow-y-auto">
                  {availableTags.map((tag) => (
                    <DropdownMenuItem
                      key={tag.uuid}
                      onClick={() => filtersStore.setFilterTagId(tag.uuid)}
                      className="text-xs cursor-pointer"
                    >
                      {tag.name}
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <span
                className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded max-w-[80px] truncate"
                title={getTagLabel()}
              >
                {getTagLabel()}
              </span>
              <button
                onClick={() => filtersStore.setFilterTagId('')}
                className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-destructive/20 text-destructive transition-colors shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );

  // 定义列
  const columns: ColumnDef<Environment>[] = [
    {
      id: 'index',
      header: t('table.headers.index'),
      cell: () => null, // 由 renderRow 处理
      width: 64,
    },
    {
      id: 'fingerprint',
      header: '', // 无字段名
      cell: () => null,
      width: 80,
    },
    {
      id: 'name',
      header: t('table.headers.name'),
      cell: () => null,
      width: 192,
    },
    {
      id: 'proxy',
      header: t('table.headers.proxy'),
      cell: () => null,
      width: 64,
    },
    {
      id: 'account',
      header: t('table.headers.account'),
      cell: () => null,
      width: 160,
    },
    {
      id: 'group',
      header: <GroupHeader />,
      cell: () => null,
      width: 112,
    },
    {
      id: 'tag',
      header: <TagHeader />,
      cell: () => null,
      width: 112,
    },
    {
      id: 'lastAction',
      header: t('table.headers.lastAction'),
      cell: () => null,
      width: 160,
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
    // 同步到 selectionStore
    const currentIds = selectionStore.selectedIds;

    // 找出新增和移除的 ID
    environments.forEach((env) => {
      const wasSelected = currentIds.has(env.uuid);
      const isNowSelected = newSelectedIds.has(env.uuid);

      if (wasSelected !== isNowSelected) {
        selectionStore.select(env.uuid, isNowSelected);
      }
    });
  };

  return (
    <DataTable
      data={environments}
      columns={columns}
      getRowKey={(env) => env.uuid}
      loading={loading}
      skeletonRows={8}
      emptyText={<EmptyState t={t} viewType={filtersStore.viewType} />}
      selectable
      selectedIds={selectionStore.selectedIds}
      onSelectionChange={handleSelectionChange}
      stickyLeftColumns={['index']}
      stickyRightColumns={['actions']}
      startIndex={startIndex}
      renderRow={({ row, rowIndex, rowKey, isSelected, onSelect }) => (
        <EnvironmentTableRow
          key={rowKey}
          environment={row}
          index={startIndex + rowIndex + 1}
          isSelected={isSelected}
          onSelect={(id, selected) => onSelect(selected)}
          onEdit={(env) => {
            // 跳转到创建环境页面，传递编辑参数
            navigate(`/create-window?edit=${env.uuid}`);
          }}
          availableTags={availableTags}
          onComplete={onComplete}
          viewType={filtersStore.viewType}
        />
      )}
    />
  );
}
