import { Skeleton } from '@/components/ui/skeleton';

export function StoragePanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-2 pb-2">
      <div className="p-4 bg-accent/30 rounded-lg mx-2 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex flex-wrap gap-3 mt-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-3 bg-accent/20 rounded-lg"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
