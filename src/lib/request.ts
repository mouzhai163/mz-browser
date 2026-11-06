/**
 * HTTP 请求封装
 * 基于 Tauri invoke 实现
 */
import { invoke } from '@/lib/tauri';

/**
 * API 响应格式
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

/**
 * 请求配置
 */
export interface RequestOptions {
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 自定义请求头 */
  headers?: Record<string, string>;
}

/**
 * 发送 POST 请求
 *
 * @param url - API 路径（不需要完整 URL，如 'environments/create'）
 * @param data - 请求数据
 * @param options - 请求配置
 * @returns API 响应
 *
 * @example
 * ```ts
 * const result = await post<{ uuid: string }>('environments/create', {
 *   name: '新窗口',
 *   config: { ... }
 * });
 * if (result.code === 1) {
 *   console.log('创建成功', result.data?.uuid);
 * }
 * ```
 */
export async function post<T = unknown>(
  url: string,
  data?: unknown,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  try {
    const result = await invoke('http_post', {
      url,
      data: data || {},
      ...(options?.timeout && { timeout: options.timeout }),
      ...(options?.headers && { headers: options.headers }),
    });

    return result as ApiResponse<T>;
  } catch (error) {
    console.error(`[Request] POST ${url} failed:`, error);
    return {
      code: -1,
      message: error instanceof Error ? error.message : '请求失败',
    };
  }
}

/**
 * 发送 GET 请求
 *
 * @param url - API 路径
 * @param params - 查询参数
 * @param options - 请求配置
 * @returns API 响应
 */
export async function get<T = unknown>(
  url: string,
  params?: Record<string, string | number | boolean>,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  try {
    const result = await invoke('http_get', {
      url,
      params: params || {},
      ...(options?.timeout && { timeout: options.timeout }),
      ...(options?.headers && { headers: options.headers }),
    });

    return result as ApiResponse<T>;
  } catch (error) {
    console.error(`[Request] GET ${url} failed:`, error);
    return {
      code: -1,
      message: error instanceof Error ? error.message : '请求失败',
    };
  }
}

/**
 * 检查响应是否成功
 */
export function isSuccess(response: ApiResponse): boolean {
  return response.code === 1;
}

/**
 * 请求封装类
 * 提供链式调用和更灵活的配置
 */
export const request = {
  post,
  get,
  isSuccess,
};

export default request;
