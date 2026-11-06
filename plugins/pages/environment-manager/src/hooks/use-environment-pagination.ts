import { useMemo } from 'react';
import type { Environment } from '../types';
import { ITEMS_PER_PAGE } from '../constants';

interface UseEnvironmentPaginationReturn {
  paginatedEnvironments: Environment[];
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

/**
 * 环境分页 Hook
 */
export function useEnvironmentPagination(
  environments: Environment[],
  currentPage: number,
  pageSize: number = ITEMS_PER_PAGE
): UseEnvironmentPaginationReturn {
  const { paginatedEnvironments, totalPages, startIndex, endIndex } = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(environments.length / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedEnvironments = environments.slice(startIndex, endIndex);

    return {
      paginatedEnvironments,
      totalPages,
      startIndex,
      endIndex,
    };
  }, [environments, currentPage, pageSize]);

  return {
    paginatedEnvironments,
    totalPages,
    startIndex,
    endIndex,
  };
}
