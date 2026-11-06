import { useMemo } from 'react';
import type { Group } from '../types';
import { ITEMS_PER_PAGE } from '../constants';

interface UseGroupPaginationReturn {
  paginatedGroups: Group[];
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

/**
 * 分组分页 Hook
 */
export function useGroupPagination(groups: Group[], currentPage: number): UseGroupPaginationReturn {
  const { paginatedGroups, totalPages, startIndex, endIndex } = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(groups.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedGroups = groups.slice(startIndex, endIndex);

    return {
      paginatedGroups,
      totalPages,
      startIndex,
      endIndex,
    };
  }, [groups, currentPage]);

  return {
    paginatedGroups,
    totalPages,
    startIndex,
    endIndex,
  };
}
