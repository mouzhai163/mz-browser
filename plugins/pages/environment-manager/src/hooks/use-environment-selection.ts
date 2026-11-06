import { useState, useMemo } from 'react';
import type { Environment } from '../types';

interface UseEnvironmentSelectionReturn {
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  select: (id: string, selected: boolean) => void;
  selectAll: (environments: Environment[], selected: boolean) => void;
  clearSelection: () => void;
}

/**
 * 环境选择逻辑 Hook
 */
export function useEnvironmentSelection(
  environments: Environment[]
): UseEnvironmentSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const select = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const selectAll = (environmentsToSelect: Environment[], selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(environmentsToSelect.map((e) => e.uuid)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const allSelected = useMemo(() => {
    return environments.length > 0 && environments.every((e) => selectedIds.has(e.uuid));
  }, [environments, selectedIds]);

  const someSelected = useMemo(() => {
    return environments.some((e) => selectedIds.has(e.uuid));
  }, [environments, selectedIds]);

  return {
    selectedIds,
    allSelected,
    someSelected,
    select,
    selectAll,
    clearSelection,
  };
}
