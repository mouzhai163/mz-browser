import { useState } from 'react';
import type { RpaStatusFilter } from '../types';

interface UseRpaFiltersStateReturn {
  statusFilter: RpaStatusFilter;
  setStatusFilter: (filter: RpaStatusFilter) => void;
}

/**
 * RPA 状态过滤器状态管理 Hook
 */
export function useRpaFiltersState(): UseRpaFiltersStateReturn {
  const [statusFilter, setStatusFilter] = useState<RpaStatusFilter>('all');

  return {
    statusFilter,
    setStatusFilter,
  };
}
