/**
 * 工作空间配额 API
 */
import { post, isSuccess } from '@/lib/request';

// API 端点配置
export const API_ENDPOINTS = {
  GET_WORKSPACE_QUOTA: 'workspace-quotas/get',
  UPDATE_QUOTA_USAGE: 'workspace-quotas/update',
} as const;

/**
 * 工作空间配额 DTO
 */
export interface WorkspaceQuotaDto {
  workspace_uuid: string;
  max_environments: number;
  used_environments: number;
  max_team_members: number;
  used_team_members: number;
  max_proxies: number;
  used_proxies: number;
  max_rpa_tasks: number;
  used_rpa_tasks: number;
  created_at: string;
  updated_at: string;
}

/**
 * 获取工作空间配额请求
 */
export interface GetWorkspaceQuotaRequest {
  workspace_uuid?: string; // 可选参数，后端会自动识别当前工作空间
}

/**
 * 更新配额使用情况请求
 */
export interface UpdateQuotaUsageRequest {
  workspace_uuid: string;
  quota_type: string; // 'environments', 'proxies', 'team_members', 'rpa_tasks'
  increment: boolean; // true 为增加，false 为减少
  amount: number; // 增加或减少的数量
}

/**
 * 获取工作空间配额
 */
export async function getWorkspaceQuota(
  request: GetWorkspaceQuotaRequest
): Promise<WorkspaceQuotaDto> {
  const result = await post<WorkspaceQuotaDto>(API_ENDPOINTS.GET_WORKSPACE_QUOTA, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取工作空间配额失败');
  }
  return result.data!;
}

/**
 * 更新配额使用情况
 */
export async function updateQuotaUsage(request: UpdateQuotaUsageRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.UPDATE_QUOTA_USAGE, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '更新配额使用情况失败');
  }
}
