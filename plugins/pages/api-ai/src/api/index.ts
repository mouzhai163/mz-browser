import { invoke } from '@/lib/tauri';
import { isSuccess, post } from '@/lib/request';
import type { McpConfigSnapshot, UpdateMcpConfigRequest } from '../types';

export interface EnvironmentChoice {
  uuid: string;
  name: string;
  status: string;
}

/** Every existing environment (name + uuid), for choosing what MCP may access. */
export async function listEnvironmentChoices(): Promise<EnvironmentChoice[]> {
  const pageSize = 100;
  const choices: EnvironmentChoice[] = [];
  for (let page = 1; page <= 50; page++) {
    const result = await post<{
      items: Array<{ environment?: { uuid?: string; name?: string; status?: string } }>;
      total: number;
    }>('environments/list', { page, page_size: pageSize });
    if (!isSuccess(result) || !result.data) {
      throw new Error(result.message || 'list environments failed');
    }
    for (const item of result.data.items ?? []) {
      const env = item.environment;
      if (env?.uuid) {
        choices.push({ uuid: env.uuid, name: env.name || env.uuid, status: env.status || '' });
      }
    }
    if (choices.length >= (result.data.total ?? 0) || (result.data.items ?? []).length < pageSize) break;
  }
  return choices;
}

export async function getMcpConfig(): Promise<McpConfigSnapshot> {
  return invoke<McpConfigSnapshot>('get_mcp_config');
}

export async function getMcpAccessToken(): Promise<string> {
  return invoke<string>('get_mcp_access_token');
}

export async function rotateMcpAccessToken(): Promise<void> {
  await invoke('rotate_mcp_access_token');
}

export async function updateMcpConfig(payload: UpdateMcpConfigRequest): Promise<McpConfigSnapshot> {
  return invoke<McpConfigSnapshot>('update_mcp_config', { payload });
}

export async function startMcpRuntime(): Promise<void> {
  await invoke('start_mcp_runtime');
}

export async function reloadMcpRuntime(): Promise<void> {
  await invoke('reload_mcp_runtime');
}

export async function stopMcpRuntime(): Promise<void> {
  await invoke('stop_mcp_runtime');
}
