import { useMemo } from 'react';
import type { Proxy } from '../types';

/**
 * 代理过滤 Hook
 */
export function useProxyFilters(proxies: Proxy[], searchQuery: string): Proxy[] {
  return useMemo(() => {
    if (!searchQuery.trim()) return proxies;

    const query = searchQuery.toLowerCase();
    return proxies.filter(
      (proxy) =>
        proxy.name.toLowerCase().includes(query) ||
        proxy.host.toLowerCase().includes(query) ||
        proxy.uuid.toLowerCase().includes(query)
    );
  }, [proxies, searchQuery]);
}
