import { useState, useEffect, useCallback } from 'react';
import type { RpaStatusFilter, RpaTask } from '../types';
import { listRpaTasksPage } from '../api';

interface UseRpaTasksParams {
  page: number;
  pageSize?: number;
  searchQuery?: string;
  statusFilter?: RpaStatusFilter;
}

interface UseRpaTasksReturn {
  tasks: RpaTask[];
  loading: boolean;
  error: string | null;
  total: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  refresh: () => Promise<void>;
}

export function useRpaTasks(params: UseRpaTasksParams): UseRpaTasksReturn {
  const { page, pageSize = 20, searchQuery = '', statusFilter = 'all' } = params;
  const [tasks, setTasks] = useState<RpaTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [resolvedPage, setResolvedPage] = useState(page);
  const [resolvedPageSize, setResolvedPageSize] = useState(pageSize);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRpaTasksPage({
        page,
        page_size: pageSize,
        filters: {
          ...(searchQuery.trim() ? { keyword: searchQuery.trim() } : {}),
          ...(statusFilter !== 'all'
            ? statusFilter === 'scheduled'
              ? { trigger_type: 'scheduled' }
              : { status: statusFilter }
            : {}),
        },
      });
      setTasks(data.items);
      setTotal(data.total);
      setResolvedPage(data.page);
      setResolvedPageSize(data.page_size);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listRpaTasksPage({
          page,
          page_size: pageSize,
          filters: {
            ...(searchQuery.trim() ? { keyword: searchQuery.trim() } : {}),
            ...(statusFilter !== 'all'
              ? statusFilter === 'scheduled'
                ? { trigger_type: 'scheduled' }
                : { status: statusFilter }
              : {}),
          },
        });
        if (!cancelled) {
          setTasks(data.items);
          setTotal(data.total);
          setResolvedPage(data.page);
          setResolvedPageSize(data.page_size);
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

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(Math.max(total, 0) / Math.max(resolvedPageSize, 1)));

  return {
    tasks,
    loading,
    error,
    total,
    currentPage: resolvedPage,
    pageSize: resolvedPageSize,
    totalPages,
    refresh: fetchTasks,
  };
}
