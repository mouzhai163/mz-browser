import { useEffect, useState, useCallback } from 'react';
import type { AuditLog, AuditLogFilters } from '../api';
import { getAuditLogs } from '../api';

interface UseAuditLogsReturn {
  logs: AuditLog[];
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setFilters: (filters: AuditLogFilters) => void;
  refresh: () => Promise<void>;
}

/**
 * 获取审计日志的 Hook
 */
export function useAuditLogs(initialPageSize = 20): UseAuditLogsReturn {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [filters, setFilters] = useState<AuditLogFilters>({});

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAuditLogs({
        page,
        page_size: pageSize,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });
      setLogs(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    let cancelled = false;

    const loadLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getAuditLogs({
          page,
          page_size: pageSize,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        });
        if (!cancelled) {
          setLogs(result.items);
          setTotal(result.total);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '未知错误');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, filters]);

  const handleSetFilters = useCallback((newFilters: AuditLogFilters) => {
    setFilters(newFilters);
    setPage(1); // 重置到第一页
  }, []);

  return {
    logs,
    total,
    loading,
    error,
    page,
    pageSize,
    setPage,
    setPageSize,
    setFilters: handleSetFilters,
    refresh: fetchLogs,
  };
}
