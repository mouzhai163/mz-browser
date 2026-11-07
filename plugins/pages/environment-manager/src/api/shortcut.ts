/**
 * 环境桌面快捷方式 API
 *
 * 快捷方式指向 `Simprint.exe --open-env=<环境 ID>`：双击后应用直接打开该环境，不显示工作台界面。
 */
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri';

export interface ShortcutRequest {
  envUuid: string;
  envName: string;
}

export interface ShortcutResult {
  envUuid: string;
  ok: boolean;
  /** 创建成功时的快捷方式完整路径 */
  path?: string | null;
  /** 失败原因 */
  message?: string | null;
}

/** 在桌面上为一个或多个环境创建快捷方式；单个失败不影响其他。 */
export async function createEnvironmentShortcuts(
  items: ShortcutRequest[]
): Promise<ShortcutResult[]> {
  return invoke<ShortcutResult[]>('create_environment_shortcuts', { items });
}

interface OpenResultPayload {
  ok: boolean;
  envUuid?: string;
  message?: string;
}

/**
 * 监听"从快捷方式打开环境"的结果。成功时浏览器窗口自己会出现，只在失败时提示——
 * 此时后端会同时显示主窗口，否则用户双击了快捷方式却什么都没发生。
 */
export function listenShortcutOpenResult(): Promise<UnlistenFn> {
  return listen<OpenResultPayload>('environment-shortcut-result', (event) => {
    if (!event.payload.ok) {
      toast.error(event.payload.message || '从快捷方式打开环境失败');
    }
  });
}
