import { useMemo } from 'react';
import type { Proxy } from '../types';
import { ITEMS_PER_PAGE } from '../constants';

interface UseProxyPaginationReturn {
  paginatedProxies: Proxy[];
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

/**
 * 代理分页 Hook
 */
export function useProxyPagination(
  proxies: Proxy[],
  currentPage: number
): UseProxyPaginationReturn {
  const { paginatedProxies, totalPages, startIndex, endIndex } = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(proxies.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedProxies = proxies.slice(startIndex, endIndex);

    return {
      paginatedProxies,
      totalPages,
      startIndex,
      endIndex,
    };
  }, [proxies, currentPage]);

  return {
    paginatedProxies,
    totalPages,
    startIndex,
    endIndex,
  };
}
