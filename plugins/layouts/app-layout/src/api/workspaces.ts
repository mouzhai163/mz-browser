/**
 * 工作空间 API
 */
import { post, isSuccess } from '@/lib/request';
import type {
  WorkspaceListResponse,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  SwitchWorkspaceRequest,
  GetWorkspaceRequest,
  DeleteWorkspaceRequest,
  CreateResponse,
  WorkspaceDto,
} from './workspaces.types';

// API 端点配置
export const API_ENDPOINTS = {
  CREATE_WORKSPACE: 'workspaces/create',
  LIST_WORKSPACES: 'workspaces/list',
  GET_WORKSPACE: 'workspaces/get',
  UPDATE_WORKSPACE: 'workspaces/update',
  DELETE_WORKSPACE: 'workspaces/delete',
  SWITCH_WORKSPACE: 'workspaces/switch',
} as const;

/**
 * 获取用户的工作空间列表
 */
export async function getMyWorkspaces(): Promise<WorkspaceListResponse> {
  const result = await post<WorkspaceListResponse>(API_ENDPOINTS.LIST_WORKSPACES, {});
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取工作空间列表失败');
  }
  return result.data!;
}

/**
 * 获取工作空间详情
 */
export async function getWorkspace(request: GetWorkspaceRequest): Promise<WorkspaceDto> {
  const result = await post<WorkspaceDto>(API_ENDPOINTS.GET_WORKSPACE, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取工作空间详情失败');
  }
  return result.data!;
}

/**
 * 创建工作空间
 */
export async function createWorkspace(request: CreateWorkspaceRequest): Promise<CreateResponse> {
  const result = await post<CreateResponse>(API_ENDPOINTS.CREATE_WORKSPACE, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '创建工作空间失败');
  }
  return result.data!;
}

/**
 * 更新工作空间
 */
export async function updateWorkspace(request: UpdateWorkspaceRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.UPDATE_WORKSPACE, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '更新工作空间失败');
  }
}

/**
 * 删除工作空间
 */
export async function deleteWorkspace(request: DeleteWorkspaceRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.DELETE_WORKSPACE, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '删除工作空间失败');
  }
}

/**
 * 切换工作空间
 */
export async function switchWorkspace(request: SwitchWorkspaceRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.SWITCH_WORKSPACE, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '切换工作空间失败');
  }
}
