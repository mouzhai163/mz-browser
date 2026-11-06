import { useMemo } from 'react';
import type { Proxy } from '../types';

interface ProxyStats {
  total: number;
  healthy: number;
  unreachable: number;
}

/**
 * 代理统计数据 Hook
 */
export function useProxyStats(proxies: Proxy[]): ProxyStats {
  return useMemo(() => {
    const healthy = proxies.filter((p) => p.status === 'healthy').length;
    const unreachable = proxies.filter((p) => p.status === 'unreachable').length;
    return {
      total: proxies.length,
      healthy,
      unreachable,
    };
  }, [proxies]);
}
