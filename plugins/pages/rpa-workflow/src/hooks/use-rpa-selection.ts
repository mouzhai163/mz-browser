import { useState, useCallback } from 'react';
import type { RpaTask } from '../types';

interface UseRpaSelectionParams {
  paginatedTasks: RpaTask[];
}

interface UseRpaSelectionReturn {
  selectedIds: Set<string>;
  select: (id: string) => void;
  selectAll: (selected: boolean) => void;
  clearSelection: () => void;
  allSelected: boolean;
  someSelected: boolean;
}

/**
 * RPA 任务选择管理 Hook
 */
export function useRpaSelection(params: UseRpaSelectionParams): UseRpaSelectionReturn {
  const { paginatedTasks } = params;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const select = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedIds(new Set(paginatedTasks.map((t) => t.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [paginatedTasks]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected =
    paginatedTasks.length > 0 && paginatedTasks.every((task) => selectedIds.has(task.id));
  const someSelected = paginatedTasks.some((task) => selectedIds.has(task.id));

  return {
    selectedIds,
    select,
    selectAll,
    clearSelection,
    allSelected,
    someSelected,
  };
}
