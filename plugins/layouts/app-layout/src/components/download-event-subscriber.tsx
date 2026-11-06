import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useDownloadStore } from '../stores/download-store';

const KERNEL_PREPARE_STATUS_EVENT = 'kernel-prepare-status';

interface KernelPrepareStatusPayload {
  env_uuid: string | null;
  kernel_value: string;
  status: string;
  message?: string;
  progress_percent?: number;
  downloaded?: number;
  total?: number;
}

/**
 * 在布局根挂载，只负责订阅 kernel-prepare-status 并写入 store。
 * 不随 DownloadMenu 的挂载/卸载而注销，保证下载过程中所有进度事件都能收到。
 */
export function DownloadEventSubscriber() {
  useEffect(() => {
    void useDownloadStore.getState().loadPersistedRecords();

    let unlistenFn: (() => void) | null = null;
    const unlisten = listen<KernelPrepareStatusPayload>(
      KERNEL_PREPARE_STATUS_EVENT,
      (event) => {
        useDownloadStore.getState().upsertKernelPrepare(event.payload);
      }
    );
    unlisten.then((fn) => {
      unlistenFn = fn;
    });
    return () => {
      if (unlistenFn) unlistenFn();
      else unlisten.then((fn) => fn());
    };
  }, []);
  return null;
}
