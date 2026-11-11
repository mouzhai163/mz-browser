import i18n from 'i18next';
import { recoverRpaRuns, takeDueRpaTasks } from '../api';
import { startRpaExecution } from './execution-manager';
import { sendRpaNotification } from './tauri';

const POLL_INTERVAL_MS = 30_000;

let started = false;

async function tick(): Promise<void> {
  const due = await takeDueRpaTasks();
  for (const taskId of due) {
    try {
      await startRpaExecution(taskId, { trigger: 'scheduled' });
    } catch (error) {
      // 没人看着的时候启动失败，用系统通知告诉用户
      const message = error instanceof Error ? error.message : String(error);
      const title = i18n.getFixedT(null, 'rpa')('execution.scheduledFailed') as string;
      void sendRpaNotification(title, message).catch(() => undefined);
    }
  }
}

/** 启动定时调度。整个软件只会启动一次，软件没开时错过的不补跑 */
export function startRpaScheduler(): void {
  if (started) return;
  started = true;
  void recoverRpaRuns()
    .catch((error) => console.warn('[rpa] Failed to recover runs:', error))
    .finally(() => {
      const timer = window.setInterval(() => {
        void tick().catch((error) => console.warn('[rpa] Scheduler tick failed:', error));
      }, POLL_INTERVAL_MS);
      // 开发时热更新会重新执行这个模块，旧的定时器要停掉
      import.meta.hot?.dispose(() => window.clearInterval(timer));
    });
}
