import { load } from '@tauri-apps/plugin-store';
import { create } from 'zustand';
import { invoke } from '@/lib/tauri';

export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'failed';

export interface DownloadTask {
  id: string;
  name: string;
  progress: number;
  status: DownloadStatus;
  /** 当前步骤文案，如 校验中…、下载中…、解压中… */
  message?: string;
  /** 完成或失败时间戳，用于排序或后续清理 */
  updatedAt: number;
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
  }) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  /** 从持久化存储加载记录（布局挂载时调用） */
  loadPersistedRecords: () => Promise<void>;
}

function statusFromEvent(status: string): DownloadStatus | null {
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
  async function savePersistedRecords() {
    const tasks = get().tasks;
    const toSave = tasks
      .filter((t) => t.status === 'completed' || t.status === 'failed')
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
      const status = statusFromEvent(payload.status);
      const id = payload.env_uuid || payload.kernel_value;

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
            void savePersistedRecords();
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
            void savePersistedRecords();
            return { tasks: next };
          }
          return state;
        });
        return;
      }

      // 下载/解压阶段：创建或更新任务
      set((state) => {
        const name = `内核 ${payload.kernel_value}`;
        const progress =
          payload.progress_percent != null
            ? Math.min(100, Math.max(0, payload.progress_percent))
            : 0;
        const message = payload.message ?? undefined;
        const updatedAt = Date.now();

        const existing = state.tasks.findIndex((t) => t.id === id);
        const newTask: DownloadTask = {
          id,
          name,
          progress,
          status,
          message,
          updatedAt,
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

    removeTask: (id) =>
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      })),

    clearCompleted: () => {
      set((state) => ({
        tasks: state.tasks.filter((t) => t.status === 'downloading' || t.status === 'pending'),
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
