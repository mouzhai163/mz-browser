import { useState, useMemo } from 'react';
import type { Group } from '../types';

interface UseGroupSelectionReturn {
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  select: (id: string, selected: boolean) => void;
  selectAll: (groups: Group[], selected: boolean) => void;
  clearSelection: () => void;
}

/**
 * 分组选择逻辑 Hook
 */
export function useGroupSelection(groups: Group[]): UseGroupSelectionReturn {
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

  const selectAll = (groupsToSelect: Group[], selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(groupsToSelect.map((g) => g.uuid)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const allSelected = useMemo(() => {
    return groups.length > 0 && groups.every((g) => selectedIds.has(g.uuid));
  }, [groups, selectedIds]);

  const someSelected = useMemo(() => {
    return groups.some((g) => selectedIds.has(g.uuid));
  }, [groups, selectedIds]);

  return {
    selectedIds,
    allSelected,
    someSelected,
    select,
    selectAll,
    clearSelection,
  };
}
