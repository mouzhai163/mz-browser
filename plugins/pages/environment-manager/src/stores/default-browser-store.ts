import { create } from 'zustand';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri';

/** 后端 `DefaultBrowserState`（camelCase） */
export interface DefaultBrowserState {
  /** 当前系统是否支持（目前只有 Windows） */
  supported: boolean;
  /** 默认浏览器环境 UUID；没有设置为 null */
  environmentUuid: string | null;
  /** 已向系统登记为可选浏览器 */
  registered: boolean;
  /** 系统当前的默认浏览器就是 Simprint */
  isSystemDefault: boolean;
}

const EMPTY_STATE: DefaultBrowserState = {
  supported: false,
  environmentUuid: null,
  registered: false,
  isSystemDefault: false,
};

interface LinkResultPayload {
  ok: boolean;
  envUuid?: string;
  message?: string;
}

interface DefaultBrowserStore {
  state: DefaultBrowserState;
  loaded: boolean;
  /** 从后端读取最新状态 */
  refresh: () => Promise<DefaultBrowserState>;
  /** 把环境设为默认浏览器环境，返回设置后的状态 */
  setDefault: (envUuid: string) => Promise<DefaultBrowserState>;
  /** 取消默认浏览器，返回取消后的状态 */
  clear: () => Promise<DefaultBrowserState>;
  /** 打开系统"默认应用"设置页 */
  openSystemSettings: () => Promise<void>;
  /** 监听"外部链接处理结果"，失败时给出提示 */
  initListener: () => Promise<UnlistenFn>;
}

export const useDefaultBrowserStore = create<DefaultBrowserStore>((set) => ({
  state: EMPTY_STATE,
  loaded: false,

  refresh: async () => {
    const state = await invoke<DefaultBrowserState>('get_default_browser_state');
    set({ state, loaded: true });
    return state;
  },

  setDefault: async (envUuid) => {
    const state = await invoke<DefaultBrowserState>('set_default_browser_environment', {
      envUuid,
    });
    set({ state, loaded: true });
    return state;
  },

  clear: async () => {
    const state = await invoke<DefaultBrowserState>('clear_default_browser_environment');
    set({ state, loaded: true });
    return state;
  },

  openSystemSettings: async () => {
    await invoke<void>('open_default_apps_settings');
  },

  initListener: () =>
    listen<LinkResultPayload>('default-browser-link-result', (event) => {
      // 成功时浏览器窗口自己会出现，只在失败时提示；否则用户点了链接却什么都没发生。
      if (!event.payload.ok) {
        toast.error(event.payload.message || '外部链接未能打开');
      }
    }),
}));
