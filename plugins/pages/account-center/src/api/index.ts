/**
 * 账号中心 API
 */
import { post, isSuccess } from '@/lib/request';

// API 端点配置
export const API_ENDPOINTS = {
  LIST_ACCOUNTS: 'accounts/list',
  CREATE_ACCOUNT: 'accounts/create',
  UPDATE_ACCOUNT: 'accounts/update',
  DELETE_ACCOUNT: 'accounts/delete',
  BATCH_DELETE_ACCOUNTS: 'accounts/batch-delete',
  BATCH_IMPORT_ACCOUNTS: 'accounts/batch-import',
} as const;

/**
 * 账号 DTO（后端返回格式）
 */
export interface AccountDto {
  id: number;
  uuid: string;
  platform_url: string;
  platform_name?: string;
  account: string;
  password?: string;
  status: string;
  remark?: string;
  usage_count?: number;
  environments_count?: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 账号（前端格式）
 */
export interface Account {
  id: number;
  uuid: string;
  platform: string;
  platformName: string;
  account: string;
  password: string;
  status: 'active' | 'inactive' | 'expired';
  remark?: string;
  usageCount: number;
  environmentsCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListAccountsRequest {
  page?: number;
  page_size?: number;
  filters?: {
    keyword?: string;
    platform_name?: string;
    status?: string;
  };
}

export interface ListAccountsResponse {
  items: Account[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 账号表单数据
 */
export interface AccountFormData {
  platform: string;
  account: string;
  password: string;
  remark: string;
}

/**
 * 从 URL 提取平台名称
 */
function getPlatformNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * 转换 DTO 到前端格式
 */
function transformAccountDto(dto: AccountDto): Account {
  return {
    id: dto.id,
    uuid: dto.uuid,
    platform: dto.platform_url,
    platformName: dto.platform_name || getPlatformNameFromUrl(dto.platform_url),
    account: dto.account,
    password: dto.password || '',
    status: (dto.status as Account['status']) || 'active',
    remark: dto.remark,
    usageCount: dto.usage_count || 0,
    environmentsCount: dto.environments_count || 0,
    lastUsedAt: dto.last_used_at,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

/**
 * 获取账号列表
 */
export async function listAccounts(request?: ListAccountsRequest): Promise<ListAccountsResponse> {
  const result = await post<{ items: AccountDto[]; total: number; page: number; page_size: number }>(
    API_ENDPOINTS.LIST_ACCOUNTS,
    {
    page: request?.page || 1,
    page_size: request?.page_size || 10,
    filters: request?.filters,
  });
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取账号列表失败');
  }
  return {
    items: (result.data?.items || []).map(transformAccountDto),
    total: result.data?.total || 0,
    page: result.data?.page || request?.page || 1,
    page_size: result.data?.page_size || request?.page_size || 10,
  };
}

/**
 * 创建账号
 */
export async function createAccount(data: {
  platform_url: string;
  platform_name?: string;
  account: string;
  password?: string;
  remark?: string;
}): Promise<string> {
  const result = await post<{ uuid: string }>(API_ENDPOINTS.CREATE_ACCOUNT, data);
  if (!isSuccess(result)) {
    throw new Error(result.message || '创建账号失败');
  }
  return result.data!.uuid;
}

/**
 * 更新账号
 */
export async function updateAccount(data: {
  uuid: string;
  platform_url?: string;
  platform_name?: string;
  account?: string;
  password?: string;
  remark?: string;
  status?: string;
}): Promise<void> {
  const result = await post(API_ENDPOINTS.UPDATE_ACCOUNT, data);
  if (!isSuccess(result)) {
    throw new Error(result.message || '更新账号失败');
  }
}

/**
 * 删除账号
 */
export async function deleteAccount(uuid: string): Promise<void> {
  const result = await post(API_ENDPOINTS.DELETE_ACCOUNT, { uuid });
  if (!isSuccess(result)) {
    throw new Error(result.message || '删除账号失败');
  }
}

/**
 * 批量删除账号
 */
export async function batchDeleteAccounts(uuids: string[]): Promise<void> {
  const result = await post(API_ENDPOINTS.BATCH_DELETE_ACCOUNTS, { uuids });
  if (!isSuccess(result)) {
    throw new Error(result.message || '批量删除账号失败');
  }
}

/**
 * 批量导入账号
 */
export async function batchImportAccounts(
  accounts: {
    platform_url: string;
    platform_name?: string;
    account: string;
    password?: string;
    remark?: string;
  }[]
): Promise<{ success_count: number; failed_count: number }> {
  const result = await post<{ success_count: number; failed_count: number }>(
    API_ENDPOINTS.BATCH_IMPORT_ACCOUNTS,
    { accounts }
  );
  if (!isSuccess(result)) {
    throw new Error(result.message || '批量导入账号失败');
  }
  return result.data!;
}
