/**
 * 分组管理 API
 */
import { post, isSuccess } from '@/lib/request';

// ============ API 端点 ============

export const API_ENDPOINTS = {
    LIST_GROUPS: 'groups/list',
    CREATE_GROUP: 'groups/create',
    UPDATE_GROUP: 'groups/update',
    DELETE_GROUP: 'groups/delete',
    BATCH_DELETE_GROUPS: 'groups/batch-delete',
} as const;

// ============ 类型定义 ============

export interface GroupDto {
    id: number;
    uuid: string;
    name: string;
    description?: string;
    environments_count: number;
    team_uuid?: string;
    team_name?: string;
    created_by?: string;
    created_by_name?: string;
    created_at: string;
    updated_at: string;
}

export interface Group {
    id: string;
    uuid: string;
    name: string;
    description?: string;
    environmentsCount: number;
    teamUuid?: string;
    teamName?: string;
    createdBy?: string;
    createdByName?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateGroupRequest {
    name: string;
    description?: string;
}

export interface UpdateGroupRequest {
    uuid: string;
    name?: string;
    description?: string;
}

export interface DeleteGroupRequest {
    uuid: string;
}

export interface BatchDeleteGroupsRequest {
    uuids: string[];
}

interface CreateResponse {
    uuid: string;
}

// ============ 转换函数 ============

/**
 * 将后端 GroupDto 转换为前端 Group 格式
 */
function transformGroupDto(dto: GroupDto): Group {
    return {
        id: String(dto.id || ''),
        uuid: dto.uuid || '',
        name: dto.name || '',
        description: dto.description,
        environmentsCount: dto.environments_count || 0,
        teamUuid: dto.team_uuid,
        teamName: dto.team_name,
        createdBy: dto.created_by,
        createdByName: dto.created_by_name,
        createdAt: dto.created_at || '',
        updatedAt: dto.updated_at || '',
    };
}

// ============ API 函数 ============

/**
 * 获取分组列表（后端从 context 获取 workspace_uuid 和 team_uuid，不需要参数）
 */
export async function listGroups(): Promise<Group[]> {
    const result = await post<GroupDto[]>(API_ENDPOINTS.LIST_GROUPS, {});
    if (!isSuccess(result)) {
        throw new Error(result.message || '获取分组列表失败');
    }
    return (result.data || []).map(transformGroupDto);
}

/**
 * 创建分组
 */
export async function createGroup(request: CreateGroupRequest): Promise<string> {
    const result = await post<CreateResponse>(API_ENDPOINTS.CREATE_GROUP, request);
    if (!isSuccess(result)) {
        throw new Error(result.message || '创建分组失败');
    }
    return result.data!.uuid;
}

/**
 * 更新分组
 */
export async function updateGroup(request: UpdateGroupRequest): Promise<void> {
    const result = await post(API_ENDPOINTS.UPDATE_GROUP, request);
    if (!isSuccess(result)) {
        throw new Error(result.message || '更新分组失败');
    }
}

/**
 * 删除分组
 */
export async function deleteGroup(request: DeleteGroupRequest): Promise<void> {
    const result = await post(API_ENDPOINTS.DELETE_GROUP, request);
    if (!isSuccess(result)) {
        throw new Error(result.message || '删除分组失败');
    }
}

/**
 * 批量删除分组
 */
export async function batchDeleteGroups(request: BatchDeleteGroupsRequest): Promise<void> {
    const result = await post(API_ENDPOINTS.BATCH_DELETE_GROUPS, request);
    if (!isSuccess(result)) {
        throw new Error(result.message || '批量删除分组失败');
    }
}
