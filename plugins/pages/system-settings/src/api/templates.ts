/**
 * 模板管理 API
 */
import { post, isSuccess } from '@/lib/request';

// API 端点配置
const API_ENDPOINTS = {
  LIST_TEMPLATES: 'templates/list',
  GET_TEMPLATE: 'templates/detail',
  DELETE_TEMPLATE: 'templates/delete',
  UPDATE_TEMPLATE: 'templates/update',
  CREATE_FROM_TEMPLATE: 'templates/create-from',
} as const;

/**
 * 模板列表请求
 */
export interface ListTemplatesRequest {
  page?: number;
  page_size?: number;
  keyword?: string;
  is_public?: boolean;
}

/**
 * 模板 DTO
 */
export interface TemplateDto {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  is_public?: boolean;
  system_info?: string;
  kernel_info?: string;
  config_json: Record<string, unknown>;
  usage_count?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * 关联数据状态
 */
export interface AssociationsStatus {
  /** 分组是否存在 */
  group_exists: boolean;
  /** 标签是否存在（按 UUID 映射） */
  tags_exist: Record<string, boolean>;
  /** 账号是否存在（按 UUID 映射） */
  accounts_exist: Record<string, boolean>;
  /** 代理是否存在 */
  proxy_exists: boolean;
}

/**
 * 模板详情响应
 */
export interface TemplateDetailResponse {
  /** 模板数据 */
  id: number;
  uuid: string;
  name: string;
  description?: string;
  is_public?: boolean;
  system_info?: string;
  kernel_info?: string;
  config_json: Record<string, unknown>;
  usage_count?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  /** 关联数据状态（仅在 for_create=true 时返回） */
  associations_status?: AssociationsStatus;
}

/**
 * 模板列表响应
 */
export interface TemplateListResponse {
  items: TemplateDto[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 从模板创建环境请求
 */
export interface CreateFromTemplateRequest {
  template_uuid: string;
  name?: string;
  description?: string;
  group_uuid?: string;
}

/**
 * 创建环境响应
 */
export interface CreateEnvironmentResponse {
  uuid: string;
}

/**
 * 获取模板列表
 */
export async function listTemplates(
  request: ListTemplatesRequest = {}
): Promise<TemplateListResponse> {
  const result = await post<TemplateListResponse>(API_ENDPOINTS.LIST_TEMPLATES, {
    page: request.page || 1,
    page_size: request.page_size || 100,
    keyword: request.keyword,
    is_public: request.is_public,
  });

  if (!isSuccess(result)) {
    throw new Error(result.message || '获取模板列表失败');
  }

  return result.data!;
}

/**
 * 获取模板详情
 */
export async function getTemplate(
  uuid: string,
  forCreate?: boolean
): Promise<TemplateDetailResponse> {
  const result = await post<TemplateDetailResponse>(API_ENDPOINTS.GET_TEMPLATE, {
    uuid,
    for_create: forCreate,
  });

  if (!isSuccess(result)) {
    throw new Error(result.message || '获取模板详情失败');
  }

  return result.data!;
}

/**
 * 删除模板
 */
export async function deleteTemplate(uuid: string): Promise<void> {
  const result = await post(API_ENDPOINTS.DELETE_TEMPLATE, { uuid });

  if (!isSuccess(result)) {
    throw new Error(result.message || '删除模板失败');
  }
}

/**
 * 更新模板
 */
export interface UpdateTemplateRequest {
  uuid: string;
  name?: string;
  description?: string;
  is_public?: boolean;
  environment_data?: Record<string, unknown>;
}

export async function updateTemplate(request: UpdateTemplateRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.UPDATE_TEMPLATE, {
    uuid: request.uuid,
    name: request.name,
    description: request.description,
    is_public: request.is_public,
    config_json: request.environment_data, // 后端期望 config_json 字段
  });

  if (!isSuccess(result)) {
    throw new Error(result.message || '更新模板失败');
  }
}

/**
 * 从模板创建环境
 */
export async function createFromTemplate(
  request: CreateFromTemplateRequest
): Promise<CreateEnvironmentResponse> {
  const result = await post<CreateEnvironmentResponse>(API_ENDPOINTS.CREATE_FROM_TEMPLATE, request);

  if (!isSuccess(result)) {
    throw new Error(result.message || '从模板创建环境失败');
  }

  return result.data!;
}
