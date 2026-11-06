import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';
import type { DataTableRowProps } from './types';

export function DataTableRow<T>({
  row,
  rowIndex,
  columns,
  rowKey,
  isSelected = false,
  onSelect,
  selectable = false,
  onClick,
  stickyLeftColumns = new Set(),
  stickyRightColumns = new Set(),
  selectColumnWidth = 48,
}: DataTableRowProps<T>) {
  return (
    <tr
      className={`group border-b hover:bg-muted/50 ${isSelected ? 'bg-muted' : ''
        } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* 选择列 */}
      {selectable && (
        <td className={`sticky left-0 z-5 px-4 py-2.5 border-b text-center}`}>
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(value) => onSelect?.(!!value)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4"
            />
          </div>
        </td>
      )}

      {/* 数据列 */}
      {columns.map((column, colIndex) => {
        const isStickyLeft = stickyLeftColumns.has(column.id);
        const isStickyRight = stickyRightColumns.has(column.id);

        // 计算 sticky left 偏移量
        let stickyLeftOffset = selectable ? selectColumnWidth : 0;
        if (isStickyLeft) {
          for (let i = 0; i < colIndex; i++) {
            if (stickyLeftColumns.has(columns[i].id)) {
              const w = columns[i].width;
              stickyLeftOffset += typeof w === 'number' ? w : 0;
            }
          }
        }

        let cellClassName = 'px-4 py-2.5 border-b text-[13px]';

        if (isStickyLeft) {
          cellClassName = `sticky z-5 px-4 py-2.5 border-b text-left ${isSelected ? 'bg-muted' : 'group-hover:bg-muted/50'
            }`;
        } else if (isStickyRight) {
          cellClassName = `sticky right-0 z-5 px-4 py-2.5 border-b before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:shadow-[1px_0_2px_rgba(0,0,0,0.05)] ${isSelected ? 'bg-muted' : 'group-hover:bg-muted/50'
            }`;
        }

        if (column.cellClassName) {
          cellClassName += ` ${column.cellClassName}`;
        }

        return (
          <td
            key={column.id}
            className={cellClassName}
            style={isStickyLeft ? { left: `${stickyLeftOffset}px` } : undefined}
          >
            {column.cell({ row, rowIndex })}
          </td>
        );
      })}
    </tr>
  );
}
