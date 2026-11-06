import { create } from 'zustand';
import { ITEMS_PER_PAGE } from '../constants';
import type { RoleFilter } from '../types';

interface FiltersState {
  searchQuery: string;
  roleFilter: RoleFilter;
  currentPage: number;
  pageSize: number;
}

interface FiltersActions {
  setSearchQuery: (query: string) => void;
  setRoleFilter: (filter: RoleFilter) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  resetPagination: () => void;
}

/**
 * 团队过滤和搜索状态 Store
 */
export const useTeamFiltersStore = create<FiltersState & FiltersActions>((set) => ({
  // 初始状态
  searchQuery: '',
  roleFilter: 'all',
  currentPage: 1,
  pageSize: ITEMS_PER_PAGE,

  // Actions
  setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
  setRoleFilter: (filter) => set({ roleFilter: filter, currentPage: 1 }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size, currentPage: 1 }),
  resetPagination: () => set({ currentPage: 1 }),
}));
