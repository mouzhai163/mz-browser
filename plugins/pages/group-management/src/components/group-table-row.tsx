import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { FolderTree, Eye, MoreVertical, Edit, Trash2 } from 'lucide-react';
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
import type { Group } from '../types';

export type { Group };

interface GroupTableRowProps {
  group: Group;
  isSelected?: boolean;
  onSelect?: (uuid: string, selected: boolean) => void;
  onEdit?: (group: Group) => void;
  onDelete?: (group: Group) => void;
}

export function GroupTableRow({
  group,
  isSelected = false,
  onSelect,
  onEdit,
  onDelete,
}: GroupTableRowProps) {
  const { t } = useTranslation('groups');
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
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

  const handleViewEnvironments = () => {
    navigate(`/?group=${group.uuid}`);
  };

  return (
    <DataTableRowContainer isSelected={isSelected}>
      {/* 选择框列 */}
      <DataTableCheckboxCell
        isSelected={isSelected}
        onSelect={(selected) => onSelect?.(group.uuid, selected)}
      />

      {/* 名称列 */}
      <DataTableCell>
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground">{group.name}</span>
        </div>
        <div className="text-xs text-muted-foreground font-mono mt-0.5">
          ID: {group.uuid.slice(0, 8)}
        </div>
      </DataTableCell>

      {/* 环境数量列 */}
      <DataTableCell>
        <span className="text-sm font-mono font-medium text-foreground">
          {group.environmentsCount}
        </span>
      </DataTableCell>

      {/* 创建时间列 */}
      <DataTableCell>
        <span className="text-sm text-muted-foreground">{formatDate(group.createdAt)}</span>
      </DataTableCell>

      {/* 描述列 */}
      <DataTableCell>
        <span className="text-sm text-muted-foreground max-w-[300px] truncate block">
          {group.description || '-'}
        </span>
      </DataTableCell>

      {/* 操作列 */}
      <DataTableActionsCell isSelected={isSelected}>
        {/* 第一个按钮：跳转到环境 */}
        <button
          onClick={handleViewEnvironments}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title={t('table.actions.viewEnvironments')}
        >
          <Eye className="h-4 w-4" />
        </button>
        {/* 第二个按钮：更多操作 */}
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
            <DropdownMenuItem onClick={() => onEdit?.(group)} className="cursor-pointer">
              <Edit className="w-4 h-4 mr-2" />
              <span>{t('table.actions.edit')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete?.(group)}
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
