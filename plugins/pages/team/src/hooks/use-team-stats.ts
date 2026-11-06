import { useMemo } from 'react';
import type { TeamMember } from '../types';

interface UseTeamStatsParams {
  members: TeamMember[];
}

/**
 * 团队成员统计 Hook
 */
export function useTeamStats({ members }: UseTeamStatsParams) {
  const stats = useMemo(() => {
    const active = members.filter((m) => m.status === 'active').length;
    const pending = members.filter((m) => m.status === 'pending').length;
    const totalEnvironments = members.reduce((sum, m) => sum + m.environmentCount, 0);
    return {
      total: members.length,
      active,
      pending,
      totalEnvironments,
    };
  }, [members]);

  return stats;
}
