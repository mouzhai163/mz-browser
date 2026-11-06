import { useMemo } from 'react';
import type { RpaTask } from '../types';
import { ITEMS_PER_PAGE } from '../constants';

interface UseRpaPaginationParams {
  tasks: RpaTask[];
  currentPage: number;
}

interface UseRpaPaginationReturn {
  paginatedTasks: RpaTask[];
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

/**
 * RPA 任务分页 Hook
 */
export function useRpaPagination(params: UseRpaPaginationParams): UseRpaPaginationReturn {
  const { tasks, currentPage } = params;

  return useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(tasks.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedTasks = tasks.slice(startIndex, endIndex);

    return {
      paginatedTasks,
      totalPages,
      startIndex,
      endIndex,
    };
  }, [tasks, currentPage]);
}
