import { invoke } from '@/lib/tauri';
import type { BatchLaunchResult } from './types';

export const KERNEL_PREPARE_STATUS_EVENT = 'kernel-prepare-status';

export async function startEnvironmentRuntime(
  envUuid: string,
  displayId?: string
): Promise<void> {
  await invoke('start_environment_by_uuid', { envUuid, displayId });
}

export async function stopEnvironmentRuntime(envUuid: string): Promise<void> {
  await invoke('stop_environment', { envUuid });
}

export async function batchStartEnvironmentsRuntime(
  envUuids: string[],
  displayIdsByEnvUuid?: Record<string, string>
): Promise<BatchLaunchResult[]> {
  return invoke<BatchLaunchResult[]>('batch_start_environments_by_uuid', {
    envUuids,
    displayIdsByEnvUuid,
  });
}

export async function batchStopEnvironmentsRuntime(
  envUuids: string[]
): Promise<BatchLaunchResult[]> {
  return invoke<BatchLaunchResult[]>('batch_stop_environments', {
    envUuids,
  });
}
