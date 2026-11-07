import type { ReactNode } from 'react';
import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';
import { cn } from '@/lib/utils';

// ============================================================================
// 行容器组件
// ============================================================================

export interface DataTableRowContainerProps {
  /** 子元素（单元格） */
  children: ReactNode;
  /** 是否选中 */
  isSelected?: boolean;
  /** 行点击回调 */
  onClick?: () => void;
  /** 鼠标移出回调 */
  onMouseLeave?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 统一的表格行容器组件
 *
 * 样式说明：
 * - 默认状态：透明背景
 * - 悬停状态：bg-muted/50
 * - 选中状态：bg-muted
 */
export function DataTableRowContainer({
  children,
  isSelected = false,
  onClick,
  onMouseLeave,
  className,
}: DataTableRowContainerProps) {
  return (
    <tr
      className={cn(
        'group border-b',
        isSelected ? 'bg-muted' : 'hover:bg-muted/50',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </tr>
  );
}

// ============================================================================
// 单元格组件
// ============================================================================

export interface DataTableCellProps {
  /** 子元素 */
  children: ReactNode;
  /** 是否选中（用于 sticky 单元格背景） */
  isSelected?: boolean;
  /** 是否固定在左侧 */
  stickyLeft?: boolean;
  /** 左侧偏移量（px，默认为 0） */
  stickyLeftOffset?: number;
  /** 是否固定在右侧 */
  stickyRight?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 文本对齐方式 */
  align?: 'left' | 'center' | 'right';
}

/**
 * 统一的表格单元格组件
 *
 * 样式说明：
 * - 基础：px-4 py-2.5 border-b
 * - 普通单元格：text-[13px]
 * - Sticky 单元格：
 *   - 默认：透明背景
 *   - 悬停：group-hover:bg-muted/50
 *   - 选中：bg-muted
 * - 右侧 Sticky：带左边框阴影
 */
export function DataTableCell({
  children,
  stickyLeft = false,
  stickyLeftOffset = 0,
  stickyRight = false,
  className,
  align = 'left',
}: DataTableCellProps) {
  // 基础样式
  const baseStyles = 'px-4 py-2.5 border-b';

  // 文本对齐
  const alignStyles = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  // 选中/悬停背景样式（仅用于 sticky 单元格）
  const stickyBgStyles = ''; // 移除选中背景，避免遮挡进度条

  // 左侧固定单元格
  if (stickyLeft) {
    return (
      <td
        className={cn(baseStyles, 'sticky z-5', alignStyles[align], stickyBgStyles, className)}
        style={{ left: `${stickyLeftOffset}px` }}
      >
        {children}
      </td>
    );
  }

  // 右侧固定单元格
  if (stickyRight) {
    return (
      <td
        className={cn(
          baseStyles,
          'sticky right-0 z-5',
          // 左边框阴影效果
          "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:shadow-[1px_0_2px_rgba(0,0,0,0.05)]",
          stickyBgStyles,
          className
        )}
      >
        {children}
      </td>
    );
  }

  // 普通单元格
  return <td className={cn(baseStyles, 'text-[13px]', className)}>{children}</td>;
}

// ============================================================================
// 选择框单元格组件
// ============================================================================

export interface DataTableCheckboxCellProps {
  /** 是否选中 */
  isSelected?: boolean;
  /** 选择回调 */
  onSelect?: (selected: boolean) => void;
  /** 左侧偏移量（px，默认为 0） */
  stickyLeftOffset?: number;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 选择框单元格组件
 *
 * 固定在左侧，带选中/悬停背景效果
 */
export function DataTableCheckboxCell({
  isSelected = false,
  onSelect,
  stickyLeftOffset = 0,
  disabled = false,
}: DataTableCheckboxCellProps) {
  return (
    <DataTableCell
      isSelected={isSelected}
      stickyLeft
      stickyLeftOffset={stickyLeftOffset}
      align="center"
    >
      <div className="flex items-center justify-center">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(value) => onSelect?.(!!value)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4"
          disabled={disabled}
        />
      </div>
    </DataTableCell>
  );
}

// ============================================================================
// 操作列单元格组件
// ============================================================================

export interface DataTableActionsCellProps {
  /** 子元素（操作按钮） */
  children: ReactNode;
  /** 是否选中 */
  isSelected?: boolean;
  /** 是否固定在右侧（默认 false） */
  sticky?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 操作列单元格组件
 *
 * 可选固定在右侧，固定时带左边框阴影和选中/悬停背景效果
 */
export function DataTableActionsCell({
  children,
  isSelected = false,
  sticky = false,
  className,
}: DataTableActionsCellProps) {
  // 如果需要固定，使用 stickyRight
  if (sticky) {
    return (
      <DataTableCell isSelected={isSelected} stickyRight className={className}>
        <div className="flex items-center gap-2 justify-start">{children}</div>
      </DataTableCell>
    );
  }

  // 普通单元格
  return (
    <td className="px-4 py-2.5 border-b">
      <div className="flex items-center gap-2 justify-start">{children}</div>
    </td>
  );
}

// ============================================================================
// 索引单元格组件（序号 + 可选的图标）
// ============================================================================

export interface DataTableIndexCellProps {
  /** 序号 */
  index: number;
  /** 额外内容（如图标） */
  children?: ReactNode;
  /** 是否选中 */
  isSelected?: boolean;
  /** 左侧偏移量（px，默认为 48，即选择框列宽度） */
  stickyLeftOffset?: number;
}

/**
 * 索引单元格组件
 *
 * 固定在左侧（选择框列之后），显示序号和可选的额外内容
 */
export function DataTableIndexCell({
  index,
  children,
  isSelected = false,
  stickyLeftOffset = 48,
}: DataTableIndexCellProps) {
  return (
    <DataTableCell isSelected={isSelected} stickyLeft stickyLeftOffset={stickyLeftOffset}>
      <div className="flex items-center gap-6">
        <span className="text-xs text-muted-foreground font-mono">{index}</span>
        {children}
      </div>
    </DataTableCell>
  );
}
