import { Skeleton } from '@/components/ui/skeleton';

interface AccountTableSkeletonProps {
  rows?: number;
}

export function AccountTableSkeleton({ rows = 8 }: AccountTableSkeletonProps) {
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
          {/* 平台列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
            </div>
          </td>
          {/* 账号列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-36" />
          </td>
          {/* 密码列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* 状态列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-5 w-16" />
          </td>
          {/* 关联环境数列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-8" />
          </td>
          {/* 上次使用列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-20" />
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
