import { useMemo } from 'react';
import type { AuditLog } from '../types';
import { ITEMS_PER_PAGE } from '../constants';

interface UseAuditPaginationReturn {
  paginatedLogs: AuditLog[];
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

/**
 * 审计日志分页 Hook
 */
export function useAuditPagination(
  logs: AuditLog[],
  currentPage: number
): UseAuditPaginationReturn {
  const { paginatedLogs, totalPages, startIndex, endIndex } = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(logs.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedLogs = logs.slice(startIndex, endIndex);

    return {
      paginatedLogs,
      totalPages,
      startIndex,
      endIndex,
    };
  }, [logs, currentPage]);

  return {
    paginatedLogs,
    totalPages,
    startIndex,
    endIndex,
  };
}
