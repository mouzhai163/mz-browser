import { useMemo } from 'react';
import { useTeamFiltersStore } from '../stores';
import type { TeamMember } from '../types';

interface UseTeamPaginationParams {
  members: TeamMember[];
  total: number;
}

interface UseTeamPaginationReturn {
  paginatedMembers: TeamMember[];
  totalPages: number;
  startIndex: number;
}

/**
 * 团队成员分页 Hook
 * 注意：分页已在后端完成，这里仅用于计算总页数
 */
export function useTeamPagination({
  members,
  total,
}: UseTeamPaginationParams): UseTeamPaginationReturn {
  const filtersStore = useTeamFiltersStore();

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / filtersStore.pageSize));
  }, [total, filtersStore.pageSize]);

  const startIndex = useMemo(() => {
    return (filtersStore.currentPage - 1) * filtersStore.pageSize;
  }, [filtersStore.currentPage, filtersStore.pageSize]);

  // 由于分页已在后端完成，直接返回所有成员
  const paginatedMembers = useMemo(() => {
    return members;
  }, [members]);

  return {
    paginatedMembers,
    totalPages,
    startIndex,
  };
}
