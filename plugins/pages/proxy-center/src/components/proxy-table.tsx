import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Network, PlugZap, X } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProxyTableRow } from './proxy-table-row';
import type { Proxy } from '../types';

export type { Proxy };

/**
 * 空状态组件
 */
const EmptyState: React.FC<{
  t: (key: string, options?: Record<string, unknown>) => string;
  title?: string;
  description?: string;
  icon?: ReactNode;
}> = ({ t, title, description, icon }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      {icon || <Network className="h-8 w-8 text-blue-500/60" />}
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">
      {title || t('table.empty')}
    </h4>
    <p className="text-xs text-muted-foreground text-center max-w-[240px]">
      {description || t('table.emptyDescription', { defaultValue: '添加第一个代理，开始管理您的代理服务器' })}
    </p>
  </div>
);

const EmptyStateAlertIcon = () => <PlugZap className="h-8 w-8 text-amber-500/70" />;

interface ProxyTableProps {
  proxies: Proxy[];
  proxyTypeFilter?: string;
  onProxyTypeFilterChange?: (value: string) => void;
  selectedIds?: Set<string>;
  testingIds?: Set<string>;
  onSelect?: (uuid: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onTest?: (proxy: Proxy) => void;
  onEdit?: (proxy: Proxy) => void;
  onDelete?: (proxy: Proxy) => void;
  loading?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateVariant?: 'default' | 'warning';
}

export function ProxyTable({
  proxies,
  proxyTypeFilter = 'all',
  onProxyTypeFilterChange,
  selectedIds = new Set(),
  testingIds = new Set(),
  onSelect,
  onSelectAll,
  onTest,
  onEdit,
  onDelete,
  loading = false,
  emptyStateTitle,
  emptyStateDescription,
  emptyStateVariant = 'default',
}: ProxyTableProps) {
  const { t } = useTranslation('proxy');
  const selectable = !!(onSelect || onSelectAll);

  const getProxyTypeLabel = () => {
    switch (proxyTypeFilter) {
      case 'http':
        return 'HTTP';
      case 'https':
        return 'HTTPS';
      case 'socks5':
        return 'SOCKS5';
      default:
        return '';
    }
  };

  const TypeHeader = () => (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span className="shrink-0">{t('table.headers.type')}</span>
      <>
        {proxyTypeFilter === 'all' ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors shrink-0">
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuItem
                onClick={() => onProxyTypeFilterChange?.('all')}
                className="text-xs cursor-pointer"
              >
                {t('header.typeAll')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onProxyTypeFilterChange?.('http')}
                className="text-xs cursor-pointer"
              >
                HTTP
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onProxyTypeFilterChange?.('https')}
                className="text-xs cursor-pointer"
              >
                HTTPS
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onProxyTypeFilterChange?.('socks5')}
                className="text-xs cursor-pointer"
              >
                SOCKS5
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <span
              className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded max-w-[80px] truncate"
              title={getProxyTypeLabel()}
            >
              {getProxyTypeLabel()}
            </span>
            <button
              onClick={() => onProxyTypeFilterChange?.('all')}
              className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-destructive/20 text-destructive transition-colors shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        )}
      </>
    </div>
  );

  // 定义列
  const columns: ColumnDef<Proxy>[] = [
    {
      id: 'name',
      header: t('table.headers.name'),
      cell: () => null,
      width: 200,
    },
    {
      id: 'address',
      header: t('table.headers.address'),
      cell: () => null,
      width: 180,
    },
    {
      id: 'type',
      header: <TypeHeader />,
      cell: () => null,
      width: 96,
    },
    {
      id: 'country',
      header: t('table.headers.country'),
      cell: () => null,
      width: 96,
    },
    {
      id: 'latency',
      header: t('table.headers.latency'),
      cell: () => null,
      width: 96,
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
    const allSelected = proxies.length > 0 && proxies.every((p) => newSelectedIds.has(p.uuid));
    const noneSelected = proxies.every((p) => !newSelectedIds.has(p.uuid));

    if (allSelected && onSelectAll) {
      onSelectAll(true);
    } else if (noneSelected && onSelectAll) {
      onSelectAll(false);
    } else if (onSelect) {
      proxies.forEach((proxy) => {
        const wasSelected = selectedIds.has(proxy.uuid);
        const isNowSelected = newSelectedIds.has(proxy.uuid);
        if (wasSelected !== isNowSelected) {
          onSelect(proxy.uuid, isNowSelected);
        }
      });
    }
  };

  return (
    <DataTable
      data={proxies}
      columns={columns}
      getRowKey={(proxy) => proxy.uuid}
      loading={loading}
      skeletonRows={8}
      emptyText={
        <EmptyState
          t={t}
          title={emptyStateTitle}
          description={emptyStateDescription}
          icon={emptyStateVariant === 'warning' ? <EmptyStateAlertIcon /> : undefined}
        />
      }
      selectable={selectable}
      selectedIds={selectedIds}
      onSelectionChange={handleSelectionChange}
      renderRow={({ row, rowKey, isSelected, onSelect: handleSelect }) => (
        <ProxyTableRow
          key={rowKey}
          proxy={row}
          selectable={selectable}
          isSelected={isSelected}
          isTesting={testingIds.has(row.uuid)}
          onSelect={(uuid, selected) => handleSelect(selected)}
          onTest={onTest}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    />
  );
}
