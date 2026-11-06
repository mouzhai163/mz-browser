import { Skeleton } from '@/components/ui/skeleton';

interface GroupTableSkeletonProps {
  rows?: number;
}

export function GroupTableSkeleton({ rows = 8 }: GroupTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} className="group hover:bg-secondary/50 transition-colors">
          {/* 复选框列 */}
          <td className="sticky left-0 bg-background group-hover:bg-secondary/50 z-5 px-4 py-2.5 border-b border-border text-center transition-colors">
            <div className="flex items-center justify-center">
              <Skeleton className="h-4 w-4" />
            </div>
          </td>
          {/* 名称列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <div className="flex items-center gap-2 mb-1">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-3 w-24" />
          </td>
          {/* 环境数列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-8" />
          </td>
          {/* 团队列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* 创建者列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-16" />
          </td>
          {/* 创建时间列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* 描述列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-48 max-w-[300px]" />
          </td>
          {/* 操作列 */}
          <td className="sticky right-0 bg-background group-hover:bg-secondary/50 z-5 px-4 py-2.5 border-b border-border text-[13px] transition-colors">
            <div className="flex items-center gap-2 justify-start">
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
