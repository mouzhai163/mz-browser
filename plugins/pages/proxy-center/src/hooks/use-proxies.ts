import { useState, useEffect, useCallback } from 'react';
import type { Proxy } from '../types';
import { listProxies } from '../api';

interface UseProxiesParams {
  page: number;
  pageSize: number;
  searchQuery: string;
  proxyType: string;
  enabled?: boolean;
}

interface UseProxiesReturn {
  proxies: Proxy[];
  total: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 获取代理列表的 Hook
 */
export function useProxies(params: UseProxiesParams): UseProxiesReturn {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProxies = useCallback(async () => {
    if (params.enabled === false) {
      setProxies([]);
      setTotal(0);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listProxies({
        page: params.page,
        page_size: params.pageSize,
        filters: {
          keyword: params.searchQuery.trim() || undefined,
          proxy_type: params.proxyType === 'all' ? undefined : params.proxyType,
        },
      });
      setProxies(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取代理列表失败');
    } finally {
      setLoading(false);
    }
  }, [params.enabled, params.page, params.pageSize, params.proxyType, params.searchQuery]);

  useEffect(() => {
    void fetchProxies();
  }, [fetchProxies]);

  return {
    proxies,
    total,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    loading,
    error,
    refresh: fetchProxies,
  };
}
