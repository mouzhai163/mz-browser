import { useState } from 'react';
import type { TeamMember } from '../types';

interface UseTeamSelectionReturn {
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  select: (id: string, selected: boolean) => void;
  selectAll: (members: TeamMember[], selected: boolean) => void;
  clearSelection: () => void;
}

/**
 * 团队成员选择 Hook
 */
export function useTeamSelection(): UseTeamSelectionReturn {
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

  const selectAll = (members: TeamMember[], selected: boolean) => {
    if (selected) {
      // 排除 owner
      const selectableIds = members.filter((m) => m.role !== 'owner').map((m) => m.id);
      setSelectedIds(new Set(selectableIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  return {
    selectedIds,
    setSelectedIds,
    select,
    selectAll,
    clearSelection,
  };
}
