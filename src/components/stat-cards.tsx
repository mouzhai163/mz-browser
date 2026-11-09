import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatTone = 'primary' | 'success' | 'danger' | 'warning';

export interface StatCardItem {
  key: string;
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
}

const toneClass: Record<StatTone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  danger: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
};

/** 列表页顶部的一排统计卡片 */
export function StatCards({ items, className }: { items: StatCardItem[]; className?: string }) {
  return (
    <div className={cn('grid gap-3', className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-xs"
          >
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                toneClass[item.tone ?? 'primary']
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="text-xl font-semibold leading-tight text-foreground">{item.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
