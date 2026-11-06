import { useMemo } from 'react';
import type { Account } from '../types';

export function useAccountFilters(accounts: Account[], searchQuery: string): Account[] {
  return useMemo(() => {
    if (!searchQuery.trim()) {
      return accounts;
    }

    const query = searchQuery.toLowerCase().trim();
    return accounts.filter(
      (account) =>
        account.platform.toLowerCase().includes(query) ||
        account.platformName.toLowerCase().includes(query) ||
        account.account.toLowerCase().includes(query) ||
        (account.remark && account.remark.toLowerCase().includes(query))
    );
  }, [accounts, searchQuery]);
}
