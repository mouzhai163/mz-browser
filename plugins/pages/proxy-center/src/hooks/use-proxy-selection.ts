import { useState, useMemo, useCallback } from 'react';
import type { Proxy } from '../types';

interface UseProxySelectionReturn {
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  select: (id: string, selected: boolean) => void;
  selectAll: (proxies: Proxy[], selected: boolean) => void;
  clearSelection: () => void;
}

/**
 * 代理选择逻辑 Hook
 */
export function useProxySelection(proxies: Proxy[]): UseProxySelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const select = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((proxiesToSelect: Proxy[], selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(proxiesToSelect.map((p) => p.uuid)));
    } else {
      setSelectedIds(new Set());
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected = useMemo(() => {
    return proxies.length > 0 && proxies.every((p) => selectedIds.has(p.uuid));
  }, [proxies, selectedIds]);

  const someSelected = useMemo(() => {
    return proxies.some((p) => selectedIds.has(p.uuid));
  }, [proxies, selectedIds]);

  return {
    selectedIds,
    allSelected,
    someSelected,
    select,
    selectAll,
    clearSelection,
  };
}
