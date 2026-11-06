import { useMemo } from 'react';
import type { TeamMember } from '../types';

interface UseTeamFiltersParams {
  members: TeamMember[];
}

/**
 * 团队成员过滤 Hook
 * 注意：实际过滤已在后端完成，这里仅用于前端二次过滤（如果需要）
 */
export function useTeamFilters({ members }: UseTeamFiltersParams) {
  // 由于过滤已在后端完成，这里直接返回
  const filteredMembers = useMemo(() => {
    return members;
  }, [members]);

  return {
    filteredMembers,
  };
}
