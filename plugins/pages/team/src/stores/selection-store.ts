import { create } from 'zustand';

interface SelectionState {
  selectedIds: Set<string>;
}

interface SelectionActions {
  setSelectedIds: (ids: Set<string>) => void;
  select: (id: string, selected: boolean) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
}

/**
 * 团队成员选择状态 Store
 * 用于在组件间共享选中的成员 ID
 */
export const useTeamSelectionStore = create<SelectionState & SelectionActions>((set) => ({
  // 初始状态
  selectedIds: new Set<string>(),

  // Actions
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  select: (id, selected) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return { selectedIds: next };
    }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),
}));
