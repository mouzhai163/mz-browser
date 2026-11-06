import { create } from 'zustand';
import { invoke } from '@/lib/tauri';

const MIHOMO_PROCESS_GROUPS = [
  ['clash-verge'],
  ['clash-verge-rev'],
  ['mihomo'],
];
const MIHOMO_PROCESS_POLL_INTERVAL_MS = 30_000;

interface ProcessInfo {
  process_name: string;
  pid: number;
  executable_path?: string | null;
}

interface FindProcessResult {
  running: boolean;
  process: ProcessInfo | null;
}

interface MihomoStatus {
  attached: boolean;
  controller: string | null;
  config_path?: string | null;
}

interface MihomoRuntimeState {
  running: boolean;
  attached: boolean;
  controller: string | null;
  configPath: string | null;
  processName: string | null;
  pid: number | null;
  executablePath: string | null;
  checkedAt: number | null;
  checking: boolean;
  polling: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollingTimer: number | null = null;

async function queryMihomoProcess(): Promise<FindProcessResult> {
  for (const names of MIHOMO_PROCESS_GROUPS) {
    const result = await invoke<FindProcessResult>('find_process', {
      names,
      matchAll: names.length > 1,
    });
    if (result.running) {
      return result;
    }
  }

  return {
    running: false,
    process: null,
  };
}

export const useMihomoRuntimeStore = create<MihomoRuntimeState>((set, get) => ({
  running: false,
  attached: false,
  controller: null,
  configPath: null,
  processName: null,
  pid: null,
  executablePath: null,
  checkedAt: null,
  checking: false,
  polling: false,
  error: null,
  refresh: async () => {
    set({ checking: true });
    try {
      const result = await queryMihomoProcess();

      if (!result.running) {
        set({
          running: false,
          attached: false,
          controller: null,
          configPath: null,
          processName: null,
          pid: null,
          executablePath: null,
          checkedAt: Date.now(),
          checking: false,
          error: null,
        });
        return;
      }

      let status: MihomoStatus | null = null;
      try {
        status = await invoke<MihomoStatus>('get_mihomo_status');
      } catch {
        status = null;
      }

      if (status?.attached) {
        try {
          await invoke<boolean>('ensure_mihomo_local_proxy_listeners');
        } catch {
          // Keep the runtime status refresh lightweight; listener self-heal failure
          // should not block the main Mihomo status update cycle.
        }
      }

      set({
        running: true,
        attached: status?.attached ?? false,
        controller: status?.controller ?? null,
        configPath: status?.config_path ?? null,
        processName: result.process?.process_name ?? null,
        pid: result.process?.pid ?? null,
        executablePath: result.process?.executable_path ?? null,
        checkedAt: Date.now(),
        checking: false,
        error: null,
      });
    } catch (error) {
      set({
        running: false,
        attached: false,
        controller: null,
        configPath: null,
        processName: null,
        pid: null,
        executablePath: null,
        checkedAt: Date.now(),
        checking: false,
        error: error instanceof Error ? error.message : '检测 Mihomo 进程失败',
      });
    }
  },
  startPolling: () => {
    if (pollingTimer != null) {
      return;
    }

    void get().refresh();
    pollingTimer = window.setInterval(() => {
      void get().refresh();
    }, MIHOMO_PROCESS_POLL_INTERVAL_MS);
    set({ polling: true });
  },
  stopPolling: () => {
    if (pollingTimer != null) {
      window.clearInterval(pollingTimer);
      pollingTimer = null;
    }
    set({ polling: false });
  },
}));
