import { create } from 'zustand';
import { ITEMS_PER_PAGE } from '../constants';

export type EnvironmentViewType = 'all' | 'opened' | 'trash';

interface FiltersState {
  searchQuery: string;
  filterTagId: string;
  filterGroupId: string;
  currentPage: number;
  pageSize: number;
  viewType: EnvironmentViewType;
  // 每个视图独立的分页状态
  pageByViewType: Record<EnvironmentViewType, number>;
}

interface FiltersActions {
  setSearchQuery: (query: string) => void;
  setFilterTagId: (tagId: string) => void;
  setFilterGroupId: (groupId: string) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setViewType: (viewType: EnvironmentViewType) => void;
  resetPagination: () => void; // 搜索或过滤时重置到第一页
}

/**
 * 环境过滤和搜索状态 Store
 */
export const useEnvironmentFiltersStore = create<FiltersState & FiltersActions>((set) => ({
  // 初始状态
  searchQuery: '',
  filterTagId: '',
  filterGroupId: '',
  currentPage: 1,
  pageSize: ITEMS_PER_PAGE,
  viewType: 'all' as EnvironmentViewType,
  pageByViewType: {
    all: 1,
    opened: 1,
    trash: 1,
  },

  // Actions
  setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
  setFilterTagId: (tagId) => set({ filterTagId: tagId, currentPage: 1 }),
  setFilterGroupId: (groupId) => set({ filterGroupId: groupId, currentPage: 1 }),
  setCurrentPage: (page) =>
    set((state) => ({
      currentPage: page,
      pageByViewType: {
        ...state.pageByViewType,
        [state.viewType]: page,
      },
    })),
  setPageSize: (size) => set({ pageSize: size, currentPage: 1 }),
  setViewType: (viewType) =>
    set((state) => ({
      viewType,
      currentPage: state.pageByViewType[viewType],
    })),
  resetPagination: () => set({ currentPage: 1 }),
}));
