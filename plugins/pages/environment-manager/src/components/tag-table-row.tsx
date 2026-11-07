import { useTranslation } from 'react-i18next';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
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
import type { TagItem } from '../types';
import { getTagDotColorClasses } from '../utils';

export type { TagItem };

interface TagTableRowProps {
  tag: TagItem;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onEdit?: (tag: TagItem) => void;
  onDelete?: (id: string, name: string) => void;
}

export function TagTableRow({
  tag,
  isSelected = false,
  onSelect,
  onEdit,
  onDelete,
}: TagTableRowProps) {
  const { t } = useTranslation('environment');

  return (
    <DataTableRowContainer isSelected={isSelected}>
      {/* 选择框列 */}
      <DataTableCheckboxCell
        isSelected={isSelected}
        onSelect={(selected) => onSelect?.(tag.uuid, selected)}
      />

      {/* 标签名称列 */}
      <DataTableCell>
        <div className="flex items-center gap-2">
          <div
            className={`w-3.5 h-3.5 rounded border shrink-0 ${getTagDotColorClasses(tag.color)}`}
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{tag.name}</div>
          </div>
        </div>
      </DataTableCell>

      {/* 关联环境数量列 */}
      <DataTableCell>
        <span className="text-xs text-muted-foreground">
          {tag.environmentsCount !== undefined ? tag.environmentsCount : 0}
        </span>
      </DataTableCell>

      {/* 操作列 */}
      <DataTableActionsCell isSelected={isSelected}>
        {/* 更多操作 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              title={t('dialog.manageTags.moreActions')}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEdit?.(tag)} className="cursor-pointer">
              <Edit className="w-4 h-4 mr-2" />
              <span>{t('dialog.manageTags.edit')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete?.(tag.uuid, tag.name)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              <span>{t('dialog.manageTags.delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DataTableActionsCell>
    </DataTableRowContainer>
  );
}
