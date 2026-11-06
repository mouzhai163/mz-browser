import { post, isSuccess } from '@/lib/request';
import type {
  BrowserKernelVersion,
  ProxyConfig,
  EnvironmentLaunchDetail,
  EnvironmentProxyLike,
} from './types';

export const SIMPRINT_KERNEL_CHROMIUM = 'SIMPRINT_KERNEL_CHROMIUM';

export const systemToPlatform: Record<string, string> = {
  Windows: 'windows',
  macOS: 'darwin',
  Linux: 'linux',
};

export async function listBrowserKernels(
  platform?: string,
  typeCode?: string
): Promise<Record<string, BrowserKernelVersion[]>> {
  const result = await post<Record<string, BrowserKernelVersion[]>>(
    'browser-kernels/list',
    {
      platform: platform || undefined,
      type_code: typeCode || undefined,
    }
  );

  if (!isSuccess(result) || !result.data) {
    return {};
  }

  return result.data;
}

export async function getEnvironmentDetail(uuid: string): Promise<EnvironmentLaunchDetail> {
  const result = await post<EnvironmentLaunchDetail>('environments/detail', { uuid });

  if (!isSuccess(result) || !result.data) {
    throw new Error(result.message || '获取环境详情失败');
  }

  return result.data;
}

export function buildTauriProxyConfig(proxy?: EnvironmentProxyLike | null): ProxyConfig | null {
  if (!proxy?.host || !proxy.port) {
    return null;
  }

  return {
    host: proxy.host,
    port: proxy.port,
    proxy_type: proxy.proxy_type || 'http',
    username: proxy.username || undefined,
    password: proxy.password
      ? {
          value: proxy.password,
          encrypted: false,
        }
        : undefined,
  };
}
