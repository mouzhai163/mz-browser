import { useMemo } from 'react';
import type { Account } from '../types';
import { PAGE_SIZE } from '../constants';

export function useAccountPagination(accounts: Account[], currentPage: number) {
  return useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE));
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const paginatedAccounts = accounts.slice(startIndex, startIndex + PAGE_SIZE);

    return {
      paginatedAccounts,
      totalPages,
      startIndex,
    };
  }, [accounts, currentPage]);
}
