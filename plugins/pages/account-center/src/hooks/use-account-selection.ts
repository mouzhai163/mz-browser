import { useState, useCallback } from 'react';
import type { Account } from '../types';

export function useAccountSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const select = useCallback((uuid: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(uuid);
      } else {
        newSet.delete(uuid);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((accounts: Account[], selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(accounts.map((a) => a.uuid)));
    } else {
      setSelectedIds(new Set());
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useCallback(
    (accounts: Account[]) => accounts.length > 0 && accounts.every((a) => selectedIds.has(a.uuid)),
    [selectedIds]
  );

  return {
    selectedIds,
    select,
    selectAll,
    clearSelection,
    isAllSelected,
  };
}
