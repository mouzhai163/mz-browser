import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * 关闭按钮配置
 */
interface CloseButtonConfig {
  /** 是否显示关闭按钮，默认 true */
  show?: boolean;
  /** 自定义关闭按钮图标 */
  icon?: LucideIcon | React.ReactNode;
  /** 自定义关闭按钮样式 */
  className?: string;
  /** 图标大小，默认 16 */
  iconSize?: number;
  /** 关闭按钮位置 */
  position?: 'top-right' | 'top-left';
}

function ExtendedDialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="extended-dialog" {...props} />;
}

function ExtendedDialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="extended-dialog-trigger" {...props} />;
}

function ExtendedDialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="extended-dialog-portal" {...props} />;
}

function ExtendedDialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="extended-dialog-close" {...props} />;
}

function ExtendedDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="extended-dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className
      )}
      {...props}
    />
  );
}

interface ExtendedDialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /** 关闭按钮配置，传入 false 则不显示关闭按钮 */
  closeButton?: CloseButtonConfig | false;
}

function ExtendedDialogContent({
  className,
  children,
  closeButton = {},
  ...props
}: ExtendedDialogContentProps) {
  // 处理关闭按钮配置
  const showCloseButton = closeButton !== false && (closeButton?.show ?? true);
  const closeConfig: CloseButtonConfig = closeButton === false ? {} : closeButton;
  const {
    icon: CustomIcon,
    className: closeClassName,
    iconSize = 16,
    position = 'top-right',
  } = closeConfig;

  // 渲染关闭按钮图标
  const renderCloseIcon = () => {
    if (!CustomIcon) {
      return <XIcon style={{ width: iconSize, height: iconSize }} />;
    }

    // 如果是 React 组件（LucideIcon）
    if (typeof CustomIcon === 'function') {
      const IconComponent = CustomIcon as LucideIcon;
      return <IconComponent style={{ width: iconSize, height: iconSize }} />;
    }

    // 如果是 ReactNode
    return CustomIcon;
  };

  // 关闭按钮位置样式
  const positionClass = position === 'top-left' ? 'top-4 left-4' : 'top-4 right-4';

  return (
    <ExtendedDialogPortal data-slot="extended-dialog-portal">
      <ExtendedDialogOverlay />
      <DialogPrimitive.Content
        data-slot="extended-dialog-content"
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="extended-dialog-close"
            className={cn(
              'ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
              positionClass,
              closeClassName
            )}
          >
            {renderCloseIcon()}
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </ExtendedDialogPortal>
  );
}

function ExtendedDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="extended-dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function ExtendedDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="extended-dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

function ExtendedDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="extended-dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  );
}

function ExtendedDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="extended-dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  ExtendedDialog,
  ExtendedDialogClose,
  ExtendedDialogContent,
  ExtendedDialogDescription,
  ExtendedDialogFooter,
  ExtendedDialogHeader,
  ExtendedDialogOverlay,
  ExtendedDialogPortal,
  ExtendedDialogTitle,
  ExtendedDialogTrigger,
  type CloseButtonConfig,
  type ExtendedDialogContentProps,
};
