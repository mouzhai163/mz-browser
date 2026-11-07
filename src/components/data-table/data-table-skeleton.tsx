import type { DataTableSkeletonProps } from './types';

export function DataTableSkeleton({
  rows,
  columns,
  hasSelectColumn = false,
}: DataTableSkeletonProps) {

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
          {hasSelectColumn && (
            <td className="sticky left-0 z-5 px-4 py-2.5 border-b">
              <div className="flex items-center justify-center">
                <div className="h-4 w-4 bg-muted rounded" />
              </div>
            </td>
          )}
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td
              key={colIndex}
              className={`px-4 py-2.5 border-b ${
                colIndex === columns - 1
                  ? 'sticky right-0 z-5'
                  : colIndex === 0 && !hasSelectColumn
                    ? 'sticky left-0 z-5'
                    : ''
              }`}
            >
              <div
                className="h-4 bg-muted rounded"
                style={{ width: `${Math.random() * 40 + 60}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
