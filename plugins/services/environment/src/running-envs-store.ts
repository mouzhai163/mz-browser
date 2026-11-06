import { create } from 'zustand';
import { invoke } from '@/lib/tauri';
import { listen } from '@tauri-apps/api/event';
import type { EnvConnectionPayload, EnvironmentStatus } from './types';

export const ENV_CONNECTION_STATUS_EVENT = 'env-connection-status';

interface RunningEnvsState {
  statusCache: Map<string, EnvironmentStatus>;
  shakeCache: Map<string, number>;
  isRunning: (envId: string) => boolean;
  isStarting: (envId: string) => boolean;
  isStopping: (envId: string) => boolean;
  getStatus: (envId: string) => EnvironmentStatus | undefined;
  setStatus: (envId: string, status: EnvironmentStatus) => void;
  triggerShake: (envId: string) => void;
  isShaking: (envId: string) => boolean;
  refreshStatus: (envId: string) => Promise<void>;
  refreshAllStatuses: () => Promise<void>;
  initListener: () => Promise<() => void>;
}

export const useRunningEnvsStore = create<RunningEnvsState>((set, get) => ({
  statusCache: new Map(),
  shakeCache: new Map(),

  isRunning: (envId) => get().statusCache.get(envId) === 'running',
  isStarting: (envId) => get().statusCache.get(envId) === 'starting',
  isStopping: (envId) => get().statusCache.get(envId) === 'stopping',
  getStatus: (envId) => get().statusCache.get(envId),

  setStatus: (envId, status) => {
    set((state) => {
      const next = new Map(state.statusCache);
      next.set(envId, status);
      return { statusCache: next };
    });
  },

  triggerShake: (envId) => {
    set((state) => {
      const next = new Map(state.shakeCache);
      next.set(envId, Date.now());
      return { shakeCache: next };
    });

    setTimeout(() => {
      set((state) => {
        const next = new Map(state.shakeCache);
        next.delete(envId);
        return { shakeCache: next };
      });
    }, 500);
  },

  isShaking: (envId) => {
    const timestamp = get().shakeCache.get(envId);
    return !!timestamp && Date.now() - timestamp < 500;
  },

  refreshStatus: async (envId) => {
    try {
      const status = await invoke<EnvironmentStatus | null>('get_environment_status', {
        envUuid: envId,
      });

      set((state) => {
        const next = new Map(state.statusCache);
        if (status) {
          next.set(envId, status);
        } else {
          next.delete(envId);
        }
        return { statusCache: next };
      });
    } catch (error) {
      console.error(`[EnvironmentService] Failed to refresh status for ${envId}:`, error);
    }
  },

  refreshAllStatuses: async () => {
    try {
      const statuses = await invoke<Record<string, EnvironmentStatus>>(
        'get_all_environment_statuses'
      );
      set({ statusCache: new Map(Object.entries(statuses)) });
    } catch (error) {
      console.error('[EnvironmentService] Failed to refresh all statuses:', error);
    }
  },

  initListener: async () => {
    await get().refreshAllStatuses();

    return listen<EnvConnectionPayload>(ENV_CONNECTION_STATUS_EVENT, async (event) => {
      await get().refreshStatus(event.payload.env_id);
    });
  },
}));
