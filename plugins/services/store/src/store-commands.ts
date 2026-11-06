/**
 * 配置统一通过 Tauri command 读写 store，不再直接使用 plugin-store
 */
import { invoke } from '@/lib/tauri';

export async function getStoreKey<T = unknown>(key: string): Promise<T | undefined> {
  const value = await invoke<unknown>('get_store_key', { key });
  return value as T | undefined;
}

export async function setStoreKey(key: string, value: unknown): Promise<void> {
  await invoke('set_store_key', { key, value });
}
