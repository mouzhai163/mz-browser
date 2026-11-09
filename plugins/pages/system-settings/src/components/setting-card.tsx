import type { ElementType, ReactNode } from 'react';

export interface SettingCardProps {
  title: string;
  icon?: ElementType;
  children: ReactNode;
}

/**
 * 设置卡片组件
 */
export const SettingCard: React.FC<SettingCardProps> = ({ title, icon: Icon, children }) => (
  <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
    <div className="flex items-center gap-2.5 mb-4">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
    <div className="space-y-1">{children}</div>
  </div>
);
