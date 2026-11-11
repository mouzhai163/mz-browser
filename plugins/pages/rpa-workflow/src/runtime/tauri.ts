import { invoke } from '@/lib/tauri';

export interface CdpEndpoint {
  env_uuid: string;
  host: string;
  port: number;
  version_url: string;
  list_url: string;
  browser_ws_url?: string;
}

export interface RpaTabInfo {
  position: number;
  title: string;
  url: string;
  active: boolean;
  target_id: string;
}

export interface RpaTabsSnapshot {
  tabs: RpaTabInfo[];
  active_position?: number | null;
  total: number;
}

export interface RpaTabSelection {
  position: number;
  target_id: string;
}

export interface RpaTabCloseResult {
  closed_position: number;
  active_position: number;
  target_id: string;
}

export interface LocalRpaScriptExecutionResult {
  value: string;
}

export type EnvironmentStatus =
  | 'initializing'
  | 'verifying'
  | 'downloading'
  | 'extracting'
  | 'ready'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface EnvConnectionPayload {
  env_id: string;
  status: 'connected' | 'disconnected';
}

export const ENV_CONNECTION_STATUS_EVENT = 'env-connection-status';

export async function getEnvironmentCdpEndpoint(envUuid: string): Promise<CdpEndpoint | null> {
  return invoke<CdpEndpoint | null>('get_environment_cdp_endpoint', { envUuid });
}

export async function getEnvironmentStatus(envUuid: string): Promise<EnvironmentStatus | null> {
  return invoke<EnvironmentStatus | null>('get_environment_status', { envUuid });
}

export async function listEnvironmentRpaTabs(envUuid: string): Promise<RpaTabsSnapshot> {
  return invoke<RpaTabsSnapshot>('list_environment_rpa_tabs', { envUuid });
}

export async function selectEnvironmentRpaTab(
  envUuid: string,
  position: number
): Promise<RpaTabSelection> {
  return invoke<RpaTabSelection>('select_environment_rpa_tab', { envUuid, position });
}

export async function closeEnvironmentRpaTab(
  envUuid: string,
  position: number
): Promise<RpaTabCloseResult> {
  return invoke<RpaTabCloseResult>('close_environment_rpa_tab', { envUuid, position });
}

export async function executeLocalRpaScript(
  script: string,
  variables: Record<string, unknown>
): Promise<LocalRpaScriptExecutionResult> {
  return invoke<LocalRpaScriptExecutionResult>('execute_local_rpa_script', {
    script,
    variables,
  });
}

export async function saveRpaRunScreenshot(taskUuid: string, runUuid: string, imageBase64: string): Promise<string> {
  return invoke<string>('save_rpa_run_screenshot', { taskUuid, runUuid, imageBase64 });
}

export async function readRpaRunScreenshot(taskUuid: string, runUuid: string, file: string): Promise<string> {
  return invoke<string>('read_rpa_run_screenshot', { taskUuid, runUuid, file });
}

export async function deleteRpaRunFiles(taskUuid: string, runUuids: string[]): Promise<void> {
  await invoke('delete_rpa_run_files', { taskUuid, runUuids });
}

export async function deleteRpaTaskFiles(taskUuids: string[]): Promise<void> {
  await invoke('delete_rpa_task_files', { taskUuids });
}

export async function sendRpaNotification(title: string, body: string): Promise<void> {
  await invoke('send_rpa_notification', { title, body });
}
