import { invoke as rawInvoke } from '@tauri-apps/api/core';

/** 调用 Tauri 命令。 */
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return rawInvoke<T>(command, args);
}
