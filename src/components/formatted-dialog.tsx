import * as React from 'react';
import { type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/animate-ui/components/radix/dialog';

/**
 * 渐变头部配置
 */
interface GradientHeaderConfig {
  /** 渐变颜色，默认 'from-blue-500/10 via-indigo-500/10 to-blue-500/10' */
  gradient?: string;
  /** 头部图标 */
  icon?: LucideIcon | React.ReactNode;
  /** 图标颜色，默认 'text-blue-500' */
  iconColor?: string;
  /** 头部标题 */
  title: string | React.ReactNode;
  /** 头部描述 */
  description?: string | React.ReactNode;
  /** 头部自定义样式 */
  className?: string;
}

/**
 * 格式化 Dialog 组件属性
 */
interface FormattedDialogProps extends React.ComponentProps<typeof Dialog> {
  /** 渐变头部配置 */
  header?: GradientHeaderConfig;
  /** 内容区域自定义样式 */
  contentClassName?: string;
  /** 内容区域 padding，默认 'p-4' */
  contentPadding?: string;
  /** 底部操作栏自定义样式 */
  footerClassName?: string;
  /** 底部操作栏 padding，默认 'px-5 py-3' */
  footerPadding?: string;
  /** 是否显示底部操作栏背景，默认 true */
  showFooterBackground?: boolean;
  /** DialogContent 的最小宽度，默认 'min-w-[520px]' */
  minWidth?: string;
  /** 是否点击遮罩可以关闭 */
  overlayClose?: boolean;
  /** 子元素 */
  children: React.ReactNode;
}

/**
 * 格式化 Dialog 组件
 *
 * 提供统一的布局结构：
 * - 渐变头部（可选）
 * - 内容区域
 * - 底部操作栏
 */
function FormattedDialog({
  header,
  contentClassName,
  contentPadding = 'p-4',
  footerClassName,
  footerPadding = 'px-5 py-3',
  showFooterBackground = true,
  minWidth = 'min-w-[520px]',
  overlayClose = true,
  children,
  ...dialogProps
}: FormattedDialogProps) {
  // 渲染头部图标
  const renderHeaderIcon = () => {
    if (!header?.icon) return null;

    // 如果已经是 React 元素，直接返回
    if (React.isValidElement(header.icon)) {
      return header.icon;
    }

    // 如果是函数组件（LucideIcon），渲染它
    if (typeof header.icon === 'function') {
      const IconComponent = header.icon as LucideIcon;
      return <IconComponent className={cn('h-5 w-5', header.iconColor || 'text-blue-500')} />;
    }

    // 如果是对象但不是有效的 React 元素，返回 null
    if (typeof header.icon === 'object' && header.icon !== null) {
      return null;
    }

    // 其他情况（字符串、数字等）直接返回
    return header.icon;
  };

  // 分离 children 中的 footer 和其他内容
  let footer: React.ReactNode = null;
  const content: React.ReactNode[] = [];

  React.Children.forEach(children, (child) => {
    if (
      React.isValidElement(child) &&
      typeof child.type !== 'string' &&
      (child.type as any)?.displayName === 'FormattedDialogFooter'
    ) {
      // 提取 FormattedDialogFooter 的 children
      const footerChildren = (child.props as { children?: React.ReactNode }).children;
      if (footerChildren != null) {
        // 使用 React.Children.toArray 规范化 children，确保它们都是有效的 React 节点
        const normalized = React.Children.toArray(footerChildren);
        // 如果只有一个元素，直接返回；否则返回数组
        footer = normalized.length === 1 ? normalized[0] : normalized;
      }
    } else if (child != null && child !== false && child !== true) {
      // 只添加有效的 React 节点
      content.push(child);
    }
  });

  return (
    <Dialog {...dialogProps}>
      <DialogContent onInteractOutside={(e) => { if (overlayClose) e.preventDefault() }} className={cn('gap-0 p-0 overflow-hidden', minWidth)} showCloseButton={false} from="right">
        {/* 渐变头部 */}
        {header && (
          <div
            className={cn(
              'px-5 py-4 border-b border-border/50',
              header.gradient ||
              'bg-linear-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
              header.className
            )}
          >
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                {renderHeaderIcon()}
                {header.title}
              </DialogTitle>
              {header.description && (
                <DialogDescription className="text-xs">{header.description}</DialogDescription>
              )}
            </DialogHeader>
          </div>
        )}

        {/* 内容区域 */}
        {content.length > 0 && (
          <div className={cn(contentPadding, contentClassName)}>{content}</div>
        )}

        {/* 底部操作栏 */}
        {footer != null && (
          <DialogFooter
            className={cn(
              footerPadding,
              'gap-2',
              showFooterBackground && 'bg-muted/30 border-t border-border/50',
              footerClassName
            )}
          >
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * 格式化 Dialog Footer 组件
 * 用于标识 footer 内容，会被自动提取到 DialogFooter 中
 * 注意：此组件不渲染任何内容，仅作为标识符使用
 */
function FormattedDialogFooter({ children: _children }: { children: React.ReactNode }) {
  // 不渲染任何内容，仅作为标识符
  // children 会被 FormattedDialog 提取并渲染到 DialogFooter 中
  return null;
}

FormattedDialogFooter.displayName = 'FormattedDialogFooter';

export { FormattedDialog, FormattedDialogFooter };
export type { FormattedDialogProps, GradientHeaderConfig };
