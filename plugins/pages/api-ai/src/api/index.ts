import { invoke } from '@/lib/tauri';
import { isSuccess, post } from '@/lib/request';
import type {
  LocalApiConfig,
  McpConfigSnapshot,
  ResetLocalApiKeyResponse,
  UpdateLocalApiConfigRequest,
  UpdateMcpConfigRequest,
} from '../types';

const API_ENDPOINTS = {
  GET_CONFIG: 'local-api/get',
  UPDATE_CONFIG: 'local-api/update',
  RESET_API_KEY: 'local-api/reset-api-key',
} as const;

export async function getLocalApiConfig(): Promise<LocalApiConfig> {
  const result = await post<LocalApiConfig>(API_ENDPOINTS.GET_CONFIG, {});
  if (!isSuccess(result) || !result.data) {
    throw new Error(result.message || '获取配置失败');
  }

  return result.data;
}

export async function getLocalApiRuntimeRunning(): Promise<boolean> {
  return invoke<boolean>('get_local_api_runtime_running');
}

export async function updateLocalApiConfig(
  payload: UpdateLocalApiConfigRequest
): Promise<LocalApiConfig> {
  const result = await post<LocalApiConfig>(API_ENDPOINTS.UPDATE_CONFIG, payload);
  if (!isSuccess(result) || !result.data) {
    throw new Error(result.message || '更新配置失败');
  }

  return result.data;
}

export async function resetLocalApiKey(): Promise<ResetLocalApiKeyResponse> {
  const result = await post<ResetLocalApiKeyResponse>(API_ENDPOINTS.RESET_API_KEY, {});
  if (!isSuccess(result) || !result.data) {
    throw new Error(result.message || '重置密钥失败');
  }

  return result.data;
}

export async function startLocalApiRuntime(): Promise<void> {
  await invoke('start_local_api_runtime');
}

export async function reloadLocalApiRuntime(): Promise<void> {
  await invoke('reload_local_api_runtime');
}

export async function stopLocalApiRuntime(): Promise<void> {
  await invoke('stop_local_api_runtime');
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
