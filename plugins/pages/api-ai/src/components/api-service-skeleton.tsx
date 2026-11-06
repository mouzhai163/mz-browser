import { Skeleton } from '@/components/ui/skeleton';

export function ApiServiceSkeleton() {
  return (
    <div className="space-y-4">
      {/* 控制开关区域 */}
      <div className="bg-background border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      </div>

      {/* 配置表单和卡片区域 */}
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        {/* 配置表单 */}
        <div className="bg-background border border-border rounded-lg p-4 space-y-4">
          <Skeleton className="h-6 w-24" />
          <div className="space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* 信息卡片 */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="bg-background border border-border rounded-lg p-4 space-y-2"
            >
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
