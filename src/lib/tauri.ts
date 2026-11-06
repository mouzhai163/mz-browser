import { invoke as rawInvoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../../plugins/services/store/src/stores/auth/auth-store';

const ACTIVITY_REPORT_THROTTLE_MS = 10_000;
const ACTIVITY_EXCLUDED_COMMANDS = new Set([
  'report_user_activity',
  'get_session_lock_state',
  'unlock_session',
  'get_auto_start_state',
  'set_auto_start_enabled',
]);

let lastActivityReportedAt = 0;

function shouldReportActivity(command?: string): boolean {
  if (!useAuthStore.getState().isAuthenticated) {
    return false;
  }

  return !command || !ACTIVITY_EXCLUDED_COMMANDS.has(command);
}

export async function reportUserActivity(source: 'ui' | 'command' = 'ui'): Promise<void> {
  if (!shouldReportActivity()) {
    return;
  }

  const now = Date.now();
  if (now - lastActivityReportedAt < ACTIVITY_REPORT_THROTTLE_MS) {
    return;
  }

  lastActivityReportedAt = now;

  try {
    await rawInvoke('report_user_activity', { source });
  } catch (error) {
    console.warn('[Tauri] report_user_activity failed:', error);
  }
}

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (shouldReportActivity(command)) {
    void reportUserActivity('command');
  }

  return rawInvoke<T>(command, args);
}
