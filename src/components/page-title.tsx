import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageTitleProps {
  title: ReactNode;
  /** 右侧操作区（按钮等） */
  actions?: ReactNode;
  className?: string;
}

/** 各页面统一的页头：左边标题，右边操作。说明文字不放在这里。 */
export function PageTitle({ title, actions, className }: PageTitleProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
