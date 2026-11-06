import type { ElementType, ReactNode } from 'react';

export interface SettingRowProps {
  icon?: ElementType;
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * 设置项行组件
 */
export const SettingRow: React.FC<SettingRowProps> = ({
  icon: Icon,
  title,
  description,
  children,
}) => (
  <div className="flex items-center justify-between p-3 hover:bg-accent/30 rounded-lg transition-colors">
    <div className="flex items-center gap-3">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);
