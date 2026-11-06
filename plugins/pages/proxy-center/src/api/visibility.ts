/**
 * 代理可见性 API
 */
import { post, isSuccess } from '@/lib/request';

// API 端点配置
export const API_ENDPOINTS = {
  SET_VISIBLE: 'proxy-visibility/set',
  REMOVE_VISIBLE: 'proxy-visibility/remove',
  BATCH_SET_VISIBLE: 'proxy-visibility/batch-set',
  LIST_VISIBLE: 'proxy-visibility/list-visible',
  LIST_TEAMS: 'proxy-visibility/list-teams',
} as const;

/**
 * 设置代理对团队可见请求
 */
export interface SetProxyVisibleRequest {
  proxy_uuid: string;
  team_uuid: string;
}

/**
 * 移除代理对团队的可见性请求
 */
export interface RemoveProxyVisibleRequest {
  proxy_uuid: string;
  team_uuid: string;
}

/**
 * 批量设置代理可见性请求
 */
export interface BatchSetProxyVisibleRequest {
  proxy_uuid: string;
  team_uuids: string[];
}

/**
 * 获取可见的代理列表请求
 */
export interface ListVisibleProxiesRequest {
  workspace_uuid: string;
  team_uuid?: string;
}

/**
 * 获取代理的可见团队列表请求
 */
export interface ListProxyVisibleTeamsRequest {
  proxy_uuid: string;
}

/**
 * 代理可见团队响应
 */
export interface ProxyVisibleTeamResponse {
  proxy_uuid: string;
  team_uuid: string;
  team_name: string;
}

/**
 * 设置代理对团队可见
 */
export async function setProxyVisible(request: SetProxyVisibleRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.SET_VISIBLE, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '设置代理可见性失败');
  }
}

/**
 * 移除代理对团队的可见性
 */
export async function removeProxyVisible(request: RemoveProxyVisibleRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.REMOVE_VISIBLE, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '移除代理可见性失败');
  }
}

/**
 * 批量设置代理可见性
 */
export async function batchSetProxyVisible(request: BatchSetProxyVisibleRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.BATCH_SET_VISIBLE, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '批量设置代理可见性失败');
  }
}

/**
 * 获取可见的代理列表
 */
export async function listVisibleProxies(request: ListVisibleProxiesRequest): Promise<any[]> {
  const result = await post<{ items: any[] }>(API_ENDPOINTS.LIST_VISIBLE, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取可见代理列表失败');
  }
  return result.data?.items || [];
}

/**
 * 获取代理的可见团队列表
 */
export async function listProxyVisibleTeams(
  request: ListProxyVisibleTeamsRequest
): Promise<ProxyVisibleTeamResponse[]> {
  const result = await post<ProxyVisibleTeamResponse[]>(API_ENDPOINTS.LIST_TEAMS, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取代理可见团队列表失败');
  }
  return result.data || [];
}
