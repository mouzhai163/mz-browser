import { useState, useEffect, useCallback } from 'react';
import { listAccounts, type Account } from '../api';

interface UseAccountsParams {
  page: number;
  pageSize: number;
  searchQuery: string;
}

export function useAccounts(params: UseAccountsParams) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAccounts({
        page: params.page,
        page_size: params.pageSize,
        filters: {
          keyword: params.searchQuery.trim() || undefined,
        },
      });
      setAccounts(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载账号列表失败');
    } finally {
      setLoading(false);
    }
  }, [params.page, params.pageSize, params.searchQuery]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    loading,
    error,
    refresh: fetchAccounts,
  };
}
