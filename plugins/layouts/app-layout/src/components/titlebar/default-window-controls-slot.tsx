import { Minus, X, Square, GripVertical } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * 默认窗口控制按钮组件
 * 包含拖拽区域、最小化、最大化/还原、关闭按钮
 */
export function DefaultWindowControlsSlot() {
  const handleMinimize = () => {
    getCurrentWindow().minimize();
  };

  const handleToggleMaximize = () => {
    getCurrentWindow().toggleMaximize();
  };

  const handleClose = () => {
    getCurrentWindow().close();
  };

  return (
    <div className="flex items-center h-full">
      {/* 拖拽区域 */}
      <div
        data-tauri-drag-region
        className="w-12 h-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground/80 cursor-grab active:cursor-grabbing border-l border-border/80 z-9999"
        title="拖拽移动窗口"
      >
        <GripVertical className="w-4 h-4 pointer-events-none" />
      </div>

      {/* 窗口控制按钮 */}
      <div className="flex items-center h-full border-l border-border/80">
        {/* 最小化按钮 */}
        <button
          className="w-12 h-full flex items-center justify-center text-muted-foreground/80 hover:bg-accent/80 hover:text-foreground transition-all duration-200 ease-in-out"
          onClick={handleMinimize}
          title="最小化"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* 最大化/还原按钮 */}
        <button
          className="w-12 h-full flex items-center justify-center text-muted-foreground/80 hover:bg-accent/80 hover:text-foreground transition-all duration-200 ease-in-out"
          onClick={handleToggleMaximize}
          title="最大化"
        >
          <Square className="w-3.5 h-3.5" />
        </button>

        {/* 关闭按钮 */}
        <button
          className="w-12 h-full flex items-center justify-center text-muted-foreground/80 hover:bg-destructive/90 hover:text-destructive-foreground transition-all duration-200 ease-in-out"
          onClick={handleClose}
          title="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
