import { Skeleton } from '@/components/ui/skeleton';

interface EnvironmentSelectorSkeletonProps {
  rows?: number;
}

export function EnvironmentSelectorSkeleton({ rows = 5 }: EnvironmentSelectorSkeletonProps) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-2 border-b border-border">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
