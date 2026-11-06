import { useTranslation } from 'react-i18next';
import { Network, Zap, MoreVertical, Edit, Trash2, Play, Monitor, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DataTableRowContainer,
  DataTableCell,
  DataTableCheckboxCell,
  DataTableActionsCell,
} from '@/components/data-table';
import type { Proxy } from '../types';

export type { Proxy };

interface ProxyTableRowProps {
  proxy: Proxy;
  selectable?: boolean;
  isSelected?: boolean;
  isTesting?: boolean;
  onSelect?: (uuid: string, selected: boolean) => void;
  onTest?: (proxy: Proxy) => void;
  onEdit?: (proxy: Proxy) => void;
  onDelete?: (proxy: Proxy) => void;
}

export function ProxyTableRow({
  proxy,
  selectable = true,
  isSelected = false,
  isTesting = false,
  onSelect,
  onTest,
  onEdit,
  onDelete,
}: ProxyTableRowProps) {
  const { t } = useTranslation('proxy');

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === '-') return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = () => {
    switch (proxy.status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {t('status.healthy')}
          </span>
        );
      case 'unreachable':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive"></span>
            {t('status.unreachable')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground"></span>
            {t('status.unknown')}
          </span>
        );
    }
  };

  const getTypeBadge = () => {
    const colors: Record<string, string> = {
      http: 'bg-blue-500/10 text-blue-500',
      https: 'bg-green-500/10 text-green-500',
      socks5: 'bg-purple-500/10 text-purple-500',
      ssh: 'bg-orange-500/10 text-orange-500',
    };
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium uppercase ${colors[proxy.type] || 'bg-muted text-muted-foreground'}`}
      >
        {proxy.type}
      </span>
    );
  };

  return (
    <DataTableRowContainer isSelected={isSelected}>
      {/* 选择框列 */}
      {selectable && (
        <DataTableCheckboxCell
          isSelected={isSelected}
          onSelect={(selected) => onSelect?.(proxy.uuid, selected)}
        />
      )}

      {/* 名称列 */}
      <DataTableCell>
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs text-foreground">{proxy.name}</span>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
          ID: {proxy.uuid.slice(0, 8)}
        </div>
      </DataTableCell>

      {/* 地址列 */}
      <DataTableCell>
        <div className="font-mono text-xs text-foreground">
          {proxy.host}:{proxy.port}
        </div>
        {proxy.username && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {t('table.auth')}: {proxy.username}
          </div>
        )}
      </DataTableCell>

      {/* 类型列 */}
      <DataTableCell>{getTypeBadge()}</DataTableCell>

      {/* 国家列 */}
      <DataTableCell>
        <span className="text-xs text-foreground">{proxy.country || '-'}</span>
      </DataTableCell>

      {/* 延迟列 */}
      <DataTableCell>
        {proxy.status === 'healthy' && proxy.latency ? (
          <div className="flex items-center gap-1 text-xs">
            <Zap className="h-3 w-3 text-emerald-500" />
            <span className="font-mono">{proxy.latency} ms</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </DataTableCell>

      {/* 状态列 */}
      <DataTableCell>{getStatusBadge()}</DataTableCell>

      {/* 关联环境列 */}
      <DataTableCell>
        <div className="flex items-center gap-1.5">
          <Monitor className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-xs text-foreground">{proxy.environmentsCount}</span>
        </div>
      </DataTableCell>

      {/* 创建时间列 */}
      <DataTableCell>
        <span className="text-xs text-muted-foreground">{formatDate(proxy.createdAt)}</span>
      </DataTableCell>

      {/* 操作列 */}
      <DataTableActionsCell isSelected={isSelected}>
        {/* 测试按钮 */}
        <button
          onClick={() => onTest?.(proxy)}
          disabled={isTesting || !onTest}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          title={t('table.actions.test')}
        >
          {isTesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        {/* 更多操作 */}
        {(onEdit || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                title={t('table.actions.more')}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(proxy)} className="cursor-pointer">
                  <Edit className="w-4 h-4 mr-2" />
                  <span>{t('table.actions.edit')}</span>
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(proxy)}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  <span>{t('table.actions.delete')}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </DataTableActionsCell>
    </DataTableRowContainer>
  );
}
