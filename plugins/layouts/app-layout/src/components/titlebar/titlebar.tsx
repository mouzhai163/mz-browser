import type { ReactNode } from 'react';
import { DefaultBrandSlot } from './default-brand-slot';
import { DefaultNavigationSlot } from './default-navigation-slot';
import { DefaultStatusSlot } from './default-status-slot';
import { DefaultWindowControlsSlot } from './default-window-controls-slot';

export interface TitlebarProps {
  /** 左侧插槽：品牌区域（LOGO、应用信息等） */
  brandSlot?: ReactNode;
  /** 中间插槽：导航区域（面包屑等） */
  navigationSlot?: ReactNode;
  /** 右侧插槽：状态信息区域（用户信息、状态等） */
  statusSlot?: ReactNode;
  /** 是否显示窗口控制按钮（最小化、关闭） */
  showWindowControls?: boolean;
  /** 窗口控制按钮插槽：自定义窗口控制按钮 */
  windowControlsSlot?: ReactNode;
}

export default function AppTitlebar({
  brandSlot,
  navigationSlot,
  statusSlot,
  showWindowControls = true,
  windowControlsSlot,
}: TitlebarProps = {}) {
  return (
    <div
      data-tauri-drag-region
      className="h-12 bg-background border-b border-border/80 flex items-center justify-between select-none shrink-0 pointer-events-auto"
    >
      <div className="flex items-center h-full">
        {/* 品牌区域 */}
        {brandSlot !== undefined ? brandSlot : <DefaultBrandSlot />}

        {/* 导航区域 */}
        {navigationSlot !== undefined ? navigationSlot : <DefaultNavigationSlot />}
      </div>

      {/* 右侧状态信息和窗口控制按钮 */}
      <div className="flex items-center h-full">
        {/* 状态信息区域 */}
        {statusSlot !== undefined ? statusSlot : <DefaultStatusSlot />}

        {/* 窗口控制按钮 */}
        {showWindowControls &&
          (windowControlsSlot !== undefined ? windowControlsSlot : <DefaultWindowControlsSlot />)}
      </div>
    </div>
  );
}
