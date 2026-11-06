import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';
import { cn } from '@/lib/utils';
import { DataTableRow } from './data-table-row';
import { DataTableSkeleton } from './data-table-skeleton';
import type { DataTableProps } from './types';

export function DataTable<T>({
  data,
  columns,
  getRowKey,
  loading = false,
  skeletonRows = 8,
  emptyText = '暂无数据',
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  onRowClick,
  stickyLeftColumns = [],
  stickyRightColumns = [],
  className,
  tableClassName,
  startIndex = 0,
  renderRow,
}: DataTableProps<T>) {
  // 转换为 Set 便于查找
  const stickyLeftSet = new Set(stickyLeftColumns);
  const stickyRightSet = new Set(stickyRightColumns);
  const selectColumnWidth = 48; // 选择列宽度
  // 计算全选状态
  const allSelected = data.length > 0 && data.every((row) => selectedIds.has(getRowKey(row)));
  const someSelected = data.some((row) => selectedIds.has(getRowKey(row)));

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;

    if (checked) {
      const newSelectedIds = new Set(selectedIds);
      data.forEach((row) => newSelectedIds.add(getRowKey(row)));
      onSelectionChange(newSelectedIds);
    } else {
      const newSelectedIds = new Set(selectedIds);
      data.forEach((row) => newSelectedIds.delete(getRowKey(row)));
      onSelectionChange(newSelectedIds);
    }
  };

  // 处理单行选择
  const handleSelectRow = (rowKey: string, selected: boolean) => {
    if (!onSelectionChange) return;

    const newSelectedIds = new Set(selectedIds);
    if (selected) {
      newSelectedIds.add(rowKey);
    } else {
      newSelectedIds.delete(rowKey);
    }
    onSelectionChange(newSelectedIds);
  };

  // 计算列数（用于空状态的 colSpan）
  const totalColumns = selectable ? columns.length + 1 : columns.length;

  return (
    <div
      className={cn(
        'flex-1 flex flex-col bg-background/10 backdrop-blur-2xl m-4 border border-border min-h-0 rounded-lg overflow-auto',
        className
      )}
    >
      <table
        className={cn('w-full border-collapse table-auto', tableClassName)}
        style={{ minWidth: 'max-content' }}
      >
        <thead>
          <tr className="border-b">
            {/* 选择列表头 */}
            {selectable && (
              <th className="sticky top-0 left-0 bg-muted z-10 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b w-12">
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={allSelected}
                    ref={(input) => {
                      if (input && 'indeterminate' in input) {
                        (input as HTMLInputElement).indeterminate = someSelected && !allSelected;
                      }
                    }}
                    onCheckedChange={(value) => handleSelectAll(!!value)}
                    className="h-4 w-4"
                  />
                </div>
              </th>
            )}

            {/* 数据列表头 */}
            {columns.map((column, colIndex) => {
              const isStickyLeft = stickyLeftSet.has(column.id);
              const isStickyRight = stickyRightSet.has(column.id);

              // 计算 sticky left 偏移量
              let stickyLeftOffset = selectable ? selectColumnWidth : 0;
              if (isStickyLeft) {
                // 累加前面所有 sticky left 列的宽度
                for (let i = 0; i < colIndex; i++) {
                  if (stickyLeftSet.has(columns[i].id)) {
                    const w = columns[i].width;
                    stickyLeftOffset += typeof w === 'number' ? w : 0;
                  }
                }
              }

              let headerClassName =
                'sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b';

              if (isStickyLeft) {
                headerClassName =
                  'sticky top-0 bg-muted z-10 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b';
              } else if (isStickyRight) {
                headerClassName =
                  "sticky top-0 right-0 bg-muted z-10 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:shadow-[1px_0_2px_rgba(0,0,0,0.05)]";
              }

              if (column.headerClassName) {
                headerClassName += ` ${column.headerClassName}`;
              }

              return (
                <th
                  key={column.id}
                  className={headerClassName}
                  style={{
                    ...(column.width && typeof column.width === 'number'
                      ? { width: `${column.width}px` }
                      : typeof column.width === 'string'
                        ? { width: column.width }
                        : {}),
                    ...(isStickyLeft ? { left: `${stickyLeftOffset}px` } : {}),
                  }}
                >
                  {typeof column.header === 'function' ? column.header({ column }) : column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <DataTableSkeleton
              rows={skeletonRows}
              columns={columns.length}
              hasSelectColumn={selectable}
            />
          ) : data.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-muted-foreground" colSpan={totalColumns}>
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const rowKey = getRowKey(row);
              const rowIndex = startIndex + index;
              const isSelected = selectedIds.has(rowKey);

              // 如果提供了自定义行渲染器，使用它
              if (renderRow) {
                return renderRow({
                  row,
                  rowIndex,
                  rowKey,
                  isSelected,
                  onSelect: (selected) => handleSelectRow(rowKey, selected),
                });
              }

              // 否则使用默认行渲染
              return (
                <DataTableRow
                  key={rowKey}
                  row={row}
                  rowIndex={rowIndex}
                  columns={columns}
                  rowKey={rowKey}
                  isSelected={isSelected}
                  onSelect={(selected) => handleSelectRow(rowKey, selected)}
                  selectable={selectable}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  stickyLeftColumns={stickyLeftSet}
                  stickyRightColumns={stickyRightSet}
                  selectColumnWidth={selectColumnWidth}
                />
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
