import { Skeleton } from '@/components/ui/skeleton';

interface AuditTableSkeletonProps {
  rows?: number;
}

export function AuditTableSkeleton({ rows = 8 }: AuditTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} className="group hover:bg-secondary/50 transition-colors">
          {/* 操作类型列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5" />
              <Skeleton className="h-4 w-16" />
            </div>
          </td>
          {/* 目标列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5" />
              <Skeleton className="h-4 w-20" />
            </div>
          </td>
          {/* 详情列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-48" />
          </td>
          {/* 时间列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-32" />
          </td>
          {/* 操作者列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* IP 地址列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-24" />
          </td>
        </tr>
      ))}
    </>
  );
}
