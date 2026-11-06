import { Skeleton } from '@/components/ui/skeleton';

interface RpaTableSkeletonProps {
  rows?: number;
}

export function RpaTableSkeleton({ rows = 8 }: RpaTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} className="group hover:bg-secondary/50 transition-colors">
          {/* 复选框列 */}
          <td className="sticky left-0 bg-background group-hover:bg-secondary/50 z-5 px-4 py-3 border-b border-border text-center transition-colors">
            <div className="flex items-center justify-center">
              <Skeleton className="h-4 w-4" />
            </div>
          </td>
          {/* 任务名称列 */}
          <td className="px-4 py-3 border-b border-border">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-48" />
          </td>
          {/* 触发方式列 */}
          <td className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5" />
              <Skeleton className="h-4 w-16" />
            </div>
          </td>
          {/* 环境数列 */}
          <td className="px-4 py-3 border-b border-border">
            <Skeleton className="h-4 w-8" />
          </td>
          {/* 状态列 */}
          <td className="px-4 py-3 border-b border-border">
            <Skeleton className="h-5 w-16" />
          </td>
          {/* 运行次数列 */}
          <td className="px-4 py-3 border-b border-border">
            <Skeleton className="h-4 w-12" />
          </td>
          {/* 最后运行列 */}
          <td className="px-4 py-3 border-b border-border">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* 下次运行列 */}
          <td className="px-4 py-3 border-b border-border">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* 操作列 */}
          <td className="sticky right-0 bg-background group-hover:bg-secondary/50 z-5 px-4 py-3 border-b border-border transition-colors">
            <div className="flex items-center gap-1">
              <Skeleton className="h-7 w-7" />
              <Skeleton className="h-7 w-7" />
              <Skeleton className="h-7 w-7" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
