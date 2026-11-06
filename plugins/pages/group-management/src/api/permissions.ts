/**
 * 分组权限 API
 */
import { post, isSuccess } from '@/lib/request';

// API 端点配置
export const API_ENDPOINTS = {
  GRANT_PERMISSION: 'group-permissions/grant',
  REVOKE_PERMISSION: 'group-permissions/revoke',
  CHECK_PERMISSION: 'group-permissions/check',
  LIST_PERMISSIONS: 'group-permissions/list',
} as const;

/**
 * 授予分组权限请求
 */
export interface GrantGroupPermissionRequest {
  group_uuid: string;
  user_uuid: string;
  permission_type: 'read' | 'write' | 'manage';
}

/**
 * 撤销分组权限请求
 */
export interface RevokeGroupPermissionRequest {
  group_uuid: string;
  user_uuid: string;
}

/**
 * 检查分组权限请求
 */
export interface CheckGroupPermissionRequest {
  group_uuid: string;
  user_uuid: string;
  permission_type: 'read' | 'write' | 'manage';
}

/**
 * 列出用户的分组权限请求
 */
export interface ListUserGroupPermissionsRequest {
  user_uuid: string;
  group_uuid?: string;
  page?: number;
  page_size?: number;
}

/**
 * 分组权限详情
 */
export interface GroupPermissionDetail {
  group_uuid: string;
  workspace_uuid: string;
  team_uuid: string;
  user_uuid: string;
  permission_type: 'read' | 'write' | 'manage';
  granted_by: string;
  user_name?: string;
  user_email?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 分组权限列表响应
 */
export interface GroupPermissionListResponse {
  items: GroupPermissionDetail[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 检查权限响应
 */
export interface CheckPermissionResponse {
  has_permission: boolean;
  permission_type?: string;
}

/**
 * 授予分组权限
 */
export async function grantGroupPermission(request: GrantGroupPermissionRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.GRANT_PERMISSION, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '授予分组权限失败');
  }
}

/**
 * 撤销分组权限
 */
export async function revokeGroupPermission(request: RevokeGroupPermissionRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.REVOKE_PERMISSION, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '撤销分组权限失败');
  }
}

/**
 * 检查分组权限
 */
export async function checkGroupPermission(
  request: CheckGroupPermissionRequest
): Promise<CheckPermissionResponse> {
  const result = await post<CheckPermissionResponse>(API_ENDPOINTS.CHECK_PERMISSION, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '检查分组权限失败');
  }
  return result.data!;
}

/**
 * 列出用户的分组权限
 */
export async function listUserGroupPermissions(
  request: ListUserGroupPermissionsRequest
): Promise<GroupPermissionListResponse> {
  const result = await post<GroupPermissionListResponse>(API_ENDPOINTS.LIST_PERMISSIONS, {
    user_uuid: request.user_uuid,
    group_uuid: request.group_uuid,
    page: request.page || 1,
    page_size: request.page_size || 10,
  });
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取分组权限列表失败');
  }
  return result.data!;
}
