import { Skeleton } from '@/components/ui/skeleton';

/**
 * 创建环境页面 Skeleton 组件
 */
export function CreateWindowSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-50px)] relative">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-2 border-b border-border">
        {/* 导航栏 */}
        <nav className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-7 w-20" />
          ))}
        </nav>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex flex-1 overflow-hidden w-5/6 mx-auto">
        {/* 左侧：创建数量选择器 */}
        <div className="shrink-0 pt-4 pr-4">
          <Skeleton className="h-32 w-16" />
        </div>

        {/* 中间：表单区域 */}
        <div className="flex-1 py-4 space-y-4 pb-24 pr-4">
          {/* 基本信息区域 */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-24" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>

          {/* 网络与定位区域 */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>

          {/* 指纹伪装区域 */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-28" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>

          {/* 屏幕硬件区域 */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-28" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>

          {/* 浏览器行为区域 */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>

        {/* 右侧：概要区域 */}
        <div className="w-[420px] border-l border-border overflow-y-auto">
          <div className="p-4 space-y-4">
            <Skeleton className="h-6 w-24" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="absolute -bottom-2 left-0 -right-0 bg-background border-t border-border py-3 z-10">
        <div className="w-5/6 mx-auto flex items-center justify-between">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
    </div>
  );
}
