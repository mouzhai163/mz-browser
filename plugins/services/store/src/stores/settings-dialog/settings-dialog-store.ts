import { create } from 'zustand';

/**
 * 设置弹窗的 Tab 类型
 */
export type SettingsDialogTab = 'general' | 'browser' | 'network' | 'storage';

/**
 * 设置弹窗状态接口
 */
interface SettingsDialogState {
  /** 弹窗是否打开 */
  isOpen: boolean;
  /** 当前选中的 Tab */
  activeTab: SettingsDialogTab;
}

/**
 * 设置弹窗操作接口
 */
interface SettingsDialogActions {
  /** 打开弹窗 */
  open: (tab?: SettingsDialogTab) => void;
  /** 关闭弹窗 */
  close: () => void;
  /** 切换弹窗状态 */
  toggle: () => void;
  /** 设置当前 Tab */
  setActiveTab: (tab: SettingsDialogTab) => void;
}

/**
 * 设置弹窗 Store 类型
 */
export type SettingsDialogStore = SettingsDialogState & SettingsDialogActions;

/**
 * 设置弹窗状态管理 Store
 */
export const useSettingsDialogStore = create<SettingsDialogStore>((set) => ({
  // 状态
  isOpen: false,
  activeTab: 'general',

  // 操作
  open: (tab?: SettingsDialogTab) =>
    set({
      isOpen: true,
      ...(tab ? { activeTab: tab } : {}),
    }),

  close: () => set({ isOpen: false }),

  toggle: () => set((state) => ({ isOpen: !state.isOpen })),

  setActiveTab: (tab: SettingsDialogTab) => set({ activeTab: tab }),
}));
