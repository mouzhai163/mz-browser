import { useMemo } from 'react';
import type { Account } from '../types';

export function useAccountStats(accounts: Account[]) {
  return useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter((a) => a.status === 'active').length;
    const inactive = accounts.filter((a) => a.status === 'inactive').length;
    const expired = accounts.filter((a) => a.status === 'expired').length;

    return { total, active, inactive, expired };
  }, [accounts]);
}
