import { Skeleton } from '@/components/ui/skeleton';

interface EnvironmentTableSkeletonProps {
  rows?: number;
}

export function EnvironmentTableSkeleton({ rows = 8 }: EnvironmentTableSkeletonProps) {
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
          {/* 序号列 */}
          <td className="sticky bg-background group-hover:bg-secondary/50 z-5 px-4 py-2.5 border-b border-border text-left transition-colors">
            <Skeleton className="h-4 w-8" />
          </td>
          {/* 名称列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-32" />
          </td>
          {/* 代理列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3 w-4" />
              <Skeleton className="h-4 w-32" />
            </div>
          </td>
          {/* 账号列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-28" />
          </td>
          {/* 分组列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-5 w-16" />
          </td>
          {/* 标签列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-5 w-16" />
          </td>
          {/* 最后操作列 */}
          <td className="px-4 py-2.5 border-b border-border text-xs text-muted-foreground font-mono">
            <Skeleton className="h-4 w-24" />
          </td>
          {/* 操作列 */}
          <td className="sticky right-0 bg-background z-5 px-4 py-2.5 border-b text-right transition-colors">
            <Skeleton className="h-7 w-20" />
          </td>
        </tr>
      ))}
    </>
  );
}
