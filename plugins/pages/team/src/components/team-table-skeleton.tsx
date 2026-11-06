import { Skeleton } from '@/components/ui/skeleton';

interface TeamTableSkeletonProps {
  rows?: number;
}

export function TeamTableSkeleton({ rows = 8 }: TeamTableSkeletonProps) {
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
          {/* 成员列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <div className="flex items-center gap-2 mb-1">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </td>
          {/* 角色列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-16" />
            </div>
          </td>
          {/* 状态列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-5 w-16" />
          </td>
          {/* 环境数列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-8" />
          </td>
          {/* 分组数列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-8" />
          </td>
          {/* 加入时间列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* 操作列 */}
          <td className="sticky right-0 bg-background group-hover:bg-secondary/50 z-5 px-4 py-2.5 border-b border-border text-[13px] transition-colors">
            <Skeleton className="h-7 w-7" />
          </td>
        </tr>
      ))}
    </>
  );
}
