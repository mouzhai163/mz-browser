import { useMemo } from 'react';
import type { AuditLog } from '../types';

interface AuditFilters {
  searchQuery: string;
  actionFilter: string;
  targetTypeFilter: string;
  startDate: string;
  endDate: string;
}

/**
 * 审计日志过滤 Hook
 */
export function useAuditFilters(logs: AuditLog[], filters: AuditFilters): AuditLog[] {
  return useMemo(() => {
    let result = [...logs];

    // 搜索过滤
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (log) =>
          log.details.toLowerCase().includes(query) ||
          log.operator.toLowerCase().includes(query) ||
          (log.targetName && log.targetName.toLowerCase().includes(query))
      );
    }

    // 操作类型过滤
    if (filters.actionFilter) {
      result = result.filter((log) => log.action === filters.actionFilter);
    }

    // 对象类型过滤
    if (filters.targetTypeFilter) {
      result = result.filter((log) => log.targetType === filters.targetTypeFilter);
    }

    // 开始日期过滤
    if (filters.startDate) {
      result = result.filter((log) => log.timestamp >= filters.startDate);
    }

    // 结束日期过滤
    if (filters.endDate) {
      result = result.filter((log) => log.timestamp <= filters.endDate + ' 23:59:59');
    }

    return result;
  }, [
    logs,
    filters.searchQuery,
    filters.actionFilter,
    filters.targetTypeFilter,
    filters.startDate,
    filters.endDate,
  ]);
}
