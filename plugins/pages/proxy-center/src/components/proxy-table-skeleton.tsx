import { Skeleton } from '@/components/ui/skeleton';

interface ProxyTableSkeletonProps {
  rows?: number;
}

export function ProxyTableSkeleton({ rows = 8 }: ProxyTableSkeletonProps) {
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
            <Skeleton className="h-4 w-32" />
          </td>
          {/* 地址列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-36" />
          </td>
          {/* 类型列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-5 w-16" />
          </td>
          {/* 国家列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-4" />
              <Skeleton className="h-4 w-8" />
            </div>
          </td>
          {/* 延迟列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-12" />
          </td>
          {/* 状态列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-5 w-20" />
          </td>
          {/* 关联环境数列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-8" />
          </td>
          {/* 使用次数列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-8" />
          </td>
          {/* 创建时间列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* 操作列 */}
          <td className="sticky right-0 bg-background group-hover:bg-secondary/50 z-5 px-4 py-2.5 border-b border-border text-[13px] transition-colors">
            <div className="flex items-center gap-1">
              <Skeleton className="h-7 w-7" />
              <Skeleton className="h-7 w-7" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
