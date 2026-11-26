import { load } from '@tauri-apps/plugin-store';
import { create } from 'zustand';
import { invoke } from '@/lib/tauri';

export type DownloadStatus =
  | 'pending'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadTask {
  id: string;
  name: string;
  progress: number;
  status: DownloadStatus;
  /** 当前步骤文案，如 校验中…、下载中…、解压中… */
  message?: string;
  /** 完成或失败时间戳，用于排序或后续清理 */
  updatedAt: number;
  /** 后端下载控制使用的内核标识（目录名） */
  controlId?: string;
  /** 当前处于网络下载还是解压阶段；暂停/取消只作用于网络下载 */
  phase?: 'downloading' | 'extracting';
}

const PERSIST_STORE_PATH = 'download-records.json';
const PERSIST_KEY = 'tasks';
const PERSIST_MAX = 100; // 最多保留条数

let persistStorePromise: ReturnType<typeof load> | null = null;

async function getPersistStore() {
  if (!persistStorePromise) {
    persistStorePromise = invoke<{ app_base: string }>('get_storage_default_paths')
      .then(({ app_base }) =>
        load(`${app_base}/config/${PERSIST_STORE_PATH}`, {
          autoSave: true,
          defaults: { [PERSIST_KEY]: [] },
        })
      )
      .catch((error: unknown) => {
        persistStorePromise = null;
        throw error;
      });
  }
  return persistStorePromise;
}

interface DownloadState {
  tasks: DownloadTask[];
}

interface DownloadActions {
  upsertKernelPrepare: (payload: {
    env_uuid: string | null;
    kernel_value: string;
    status: string;
    message?: string;
    progress_percent?: number;
    downloaded?: number;
    total?: number;
    download_state?: 'paused' | 'cancelled';
  }) => void;
  pauseTask: (task: DownloadTask) => Promise<void>;
  resumeTask: (task: DownloadTask) => Promise<void>;
  cancelTask: (task: DownloadTask) => Promise<void>;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  /** 从持久化存储加载记录（布局挂载时调用） */
  loadPersistedRecords: () => Promise<void>;
}

function statusFromEvent(status: string, downloadState?: string): DownloadStatus | null {
  if (downloadState === 'paused') return 'paused';
  switch (status) {
    case 'downloading':
      return 'downloading';
    case 'extracting':
      return 'downloading';
    // 只有下载和解压阶段才显示在下载菜单中
    // 校验、就绪、错误等状态不应该创建下载任务
    default:
      return null;
  }
}

export const useDownloadStore = create<DownloadState & DownloadActions>((set, get) => {
  function scheduleSavePersistedRecords() {
    // Zustand 的 set updater 尚未提交时不能立即读 get()；延后到当前更新落进 store 后再持久化。
    setTimeout(() => {
      void savePersistedRecords();
    }, 0);
  }

  async function savePersistedRecords() {
    const tasks = get().tasks;
    const toSave = tasks
      .filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, PERSIST_MAX);
    try {
      const store = await getPersistStore();
      await store.set(PERSIST_KEY, toSave);
      await store.save();
    } catch (e) {
      console.warn('[download-store] persist failed:', e);
    }
  }

  return {
    tasks: [],

    upsertKernelPrepare: (payload) => {
      const status = statusFromEvent(payload.status, payload.download_state);
      // 下载是内核级任务；即使由不同环境触发，也按安装目录聚合，避免同一内核出现多个任务
      const id = payload.kernel_value;

      // 如果是非下载阶段（校验、就绪等），检查是否有正在进行的下载任务
      if (status === null) {
        set((state) => {
          const existing = state.tasks.findIndex((t) => t.id === id);
          // 如果存在正在下载的任务，且当前状态是 ready，标记为完成
          if (existing >= 0 && payload.status === 'ready') {
            const next = state.tasks.slice();
            next[existing] = {
              ...next[existing],
              status: 'completed',
              progress: 100,
              message: '下载完成',
              updatedAt: Date.now(),
            };
            scheduleSavePersistedRecords();
            return { tasks: next };
          }
          // 取消是用户主动结束，不按失败记录
          if (
            existing >= 0 &&
            payload.status === 'error' &&
            payload.download_state === 'cancelled'
          ) {
            const next = state.tasks.slice();
            next[existing] = {
              ...next[existing],
              status: 'cancelled',
              message: payload.message ?? '下载已取消',
              updatedAt: Date.now(),
            };
            scheduleSavePersistedRecords();
            return { tasks: next };
          }
          // 如果存在正在下载的任务，且当前状态是 error，标记为失败
          if (existing >= 0 && payload.status === 'error') {
            const next = state.tasks.slice();
            next[existing] = {
              ...next[existing],
              status: 'failed',
              message: payload.message ?? '下载失败',
              updatedAt: Date.now(),
            };
            scheduleSavePersistedRecords();
            return { tasks: next };
          }
          return state;
        });
        return;
      }

      // 下载/解压阶段：创建或更新任务
      set((state) => {
        const name = `内核 ${payload.kernel_value}`;
        const existing = state.tasks.findIndex((t) => t.id === id);
        const previous = existing >= 0 ? state.tasks[existing] : undefined;
        const progress =
          payload.progress_percent != null
            ? Math.min(100, Math.max(0, payload.progress_percent))
            : (previous?.progress ?? 0);
        const message = payload.message ?? previous?.message;
        const updatedAt = Date.now();

        const newTask: DownloadTask = {
          id,
          name,
          progress,
          status,
          message,
          updatedAt,
          controlId: payload.kernel_value,
          phase: payload.status === 'extracting' ? 'extracting' : 'downloading',
        };
        let next: DownloadTask[];
        if (existing >= 0) {
          next = state.tasks.slice();
          next[existing] = { ...next[existing], ...newTask };
        } else {
          next = [...state.tasks, newTask];
        }
        return { tasks: next };
      });
    },

    pauseTask: async (task) => {
      await invoke('pause_kernel_download', { kernelValue: task.controlId ?? task.id });
    },

    resumeTask: async (task) => {
      await invoke('resume_kernel_download', { kernelValue: task.controlId ?? task.id });
    },

    cancelTask: async (task) => {
      await invoke('cancel_kernel_download', { kernelValue: task.controlId ?? task.id });
    },

    removeTask: (id) =>
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      })),

    clearCompleted: () => {
      set((state) => ({
        tasks: state.tasks.filter(
          (t) => t.status === 'downloading' || t.status === 'pending' || t.status === 'paused'
        ),
      }));
      void savePersistedRecords();
    },

    loadPersistedRecords: async () => {
      try {
        const store = await getPersistStore();
        const loaded = (await store.get<DownloadTask[]>(PERSIST_KEY)) ?? [];
        set({ tasks: loaded });
      } catch (e) {
        console.warn('[download-store] load persisted failed:', e);
      }
    },
  };
});
