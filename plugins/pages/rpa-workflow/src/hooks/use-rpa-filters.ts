import { useMemo } from 'react';
import type { RpaTask, RpaStatusFilter } from '../types';

interface UseRpaFiltersParams {
  tasks: RpaTask[];
  searchQuery: string;
  statusFilter: RpaStatusFilter;
}

/**
 * RPA 任务过滤 Hook
 */
export function useRpaFilters(params: UseRpaFiltersParams): RpaTask[] {
  const { tasks, searchQuery, statusFilter } = params;

  return useMemo(() => {
    let result = [...tasks];

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (task) =>
          task.name.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query)
      );
    }

    // 状态过滤
    if (statusFilter !== 'all') {
      if (statusFilter === 'scheduled') {
        result = result.filter((task) => task.triggerType === 'scheduled');
      } else {
        result = result.filter((task) => task.status === statusFilter);
      }
    }

    return result;
  }, [tasks, searchQuery, statusFilter]);
}
