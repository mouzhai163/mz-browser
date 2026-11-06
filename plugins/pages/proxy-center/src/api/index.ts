/**
 * 代理中心 API
 */
import { post, isSuccess } from '@/lib/request';

// API 端点配置
export const API_ENDPOINTS = {
  LIST_PROXIES: 'proxies/list',
  CREATE_PROXY: 'proxies/create',
  UPDATE_PROXY: 'proxies/update',
  DELETE_PROXY: 'proxies/delete',
  BATCH_DELETE_PROXIES: 'proxies/batch-delete',
} as const;

/**
 * 代理 DTO（后端返回格式）
 */
export interface ProxyDto {
  id: number;
  uuid: string;
  name: string;
  host: string;
  port: number;
  proxy_type: string;
  username?: string;
  password?: string; // 后端返回的密码
  country?: string;
  city?: string;
  remark?: string;
  status: string;
  latency?: number;
  environments_count?: number;
  created_at: string;
  updated_at: string;
}

/**
 * 代理（前端格式）
 */
export interface Proxy {
  id: number;
  uuid: string;
  name: string;
  host: string;
  port: number;
  type: 'http' | 'https' | 'socks5';
  username?: string;
  password?: string; // 密码
  country?: string;
  city?: string;
  remark?: string;
  status: 'healthy' | 'unreachable' | 'unknown';
  latency?: number;
  environmentsCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 代理表单数据
 */
export interface ProxyFormData {
  name: string;
  host: string;
  port: string;
  type: 'http' | 'https' | 'socks5';
  username: string;
  password: string;
  country: string;
  remark: string;
}

/**
 * 转换 DTO 到前端格式
 * 
 * 注意：password 字段直接为明文。
 */
function transformProxyDto(dto: ProxyDto): Proxy {
  return {
    id: dto.id,
    uuid: dto.uuid,
    name: dto.name,
    host: dto.host,
    port: dto.port,
    type: (dto.proxy_type as Proxy['type']) || 'http',
    username: dto.username,
    password: dto.password,
    country: dto.country,
    city: dto.city,
    remark: dto.remark,
    status: (dto.status as Proxy['status']) || 'unknown',
    latency: dto.latency,
    environmentsCount: dto.environments_count || 0,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

/**
 * 获取代理列表请求
 */
export interface ListProxiesRequest {
  page?: number;
  page_size?: number;
  filters?: {
    keyword?: string;
    proxy_type?: string;
    status?: string;
    country?: string;
  };
}

/**
 * 获取代理列表
 */
export interface ListProxiesResponse {
  items: Proxy[];
  total: number;
  page: number;
  page_size: number;
}

export async function listProxies(request?: ListProxiesRequest): Promise<ListProxiesResponse> {
  const result = await post<{ items: ProxyDto[]; total: number; page: number; page_size: number }>(
    API_ENDPOINTS.LIST_PROXIES,
    {
      page: request?.page || 1,
      page_size: request?.page_size || 20,
      filters: request?.filters,
    }
  );
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取代理列表失败');
  }
  return {
    items: (result.data?.items || []).map(transformProxyDto),
    total: result.data?.total || 0,
    page: result.data?.page || request?.page || 1,
    page_size: result.data?.page_size || request?.page_size || 20,
  };
}

/**
 * 创建代理请求
 */
export interface CreateProxyRequest {
  name: string;
  host: string;
  port: number;
  proxy_type: string;
  username?: string;
  password?: string;
  country?: string;
  city?: string;
}

/**
 * 创建代理
 */
export async function createProxy(data: CreateProxyRequest): Promise<string> {
  const result = await post<{ uuid: string }>(API_ENDPOINTS.CREATE_PROXY, data);
  if (!isSuccess(result)) {
    throw new Error(result.message || '创建代理失败');
  }
  return result.data!.uuid;
}

/**
 * 更新代理
 */
export async function updateProxy(data: {
  uuid: string;
  name?: string;
  host?: string;
  port?: number;
  proxy_type?: string;
  username?: string;
  password?: string;
  country?: string;
  city?: string;
}): Promise<void> {
  const result = await post(API_ENDPOINTS.UPDATE_PROXY, data);
  if (!isSuccess(result)) {
    throw new Error(result.message || '更新代理失败');
  }
}

/**
 * 删除代理
 */
export async function deleteProxy(uuid: string): Promise<void> {
  const result = await post(API_ENDPOINTS.DELETE_PROXY, { uuid });
  if (!isSuccess(result)) {
    throw new Error(result.message || '删除代理失败');
  }
}

/**
 * 批量删除代理
 */
export async function batchDeleteProxies(uuids: string[]): Promise<void> {
  const result = await post(API_ENDPOINTS.BATCH_DELETE_PROXIES, { uuids });
  if (!isSuccess(result)) {
    throw new Error(result.message || '批量删除代理失败');
  }
}
