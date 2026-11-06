/**
 * 工作空间 API 类型定义
 */

/**
 * 工作空间类型
 */
export type WorkspaceType = 'personal' | 'team' | 'enterprise';

/**
 * 工作空间 DTO（后端返回格式）
 */
export interface WorkspaceDto {
  uuid: string;
  name: string;
  owner_uuid: string;
  workspace_type: WorkspaceType;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * 工作空间项（前端格式）
 */
export interface WorkspaceItem {
  uuid: string;
  name: string;
  workspace_type: WorkspaceType;
  is_current: boolean;
  role: string; // 用户在该工作空间的角色
}

/**
 * 工作空间列表响应
 */
export interface WorkspaceListResponse {
  current_workspace_uuid: string | null;
  workspaces: WorkspaceItem[];
}

/**
 * 创建工作空间请求
 */
export interface CreateWorkspaceRequest {
  name: string;
  workspace_type?: WorkspaceType;
}

/**
 * 更新工作空间请求
 */
export interface UpdateWorkspaceRequest {
  uuid: string;
  name?: string;
}

/**
 * 切换工作空间请求
 */
export interface SwitchWorkspaceRequest {
  workspace_uuid: string;
}

/**
 * 获取工作空间请求
 */
export interface GetWorkspaceRequest {
  uuid: string;
}

/**
 * 删除工作空间请求
 */
export interface DeleteWorkspaceRequest {
  uuid: string;
}

/**
 * 创建响应
 */
export interface CreateResponse {
  uuid: string;
}
