import { useMemo } from 'react';
import type { RpaTask } from '../types';

interface UseRpaStatsParams {
  tasks: RpaTask[];
  total?: number;
}

interface UseRpaStatsReturn {
  total: number;
  running: number;
  completed: number;
  failed: number;
  scheduled: number;
}

export function useRpaStats(params: UseRpaStatsParams): UseRpaStatsReturn {
  const { tasks, total } = params;

  return useMemo(() => {
    return {
      total: total ?? tasks.length,
      running: tasks.filter((t) => t.status === 'running').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      scheduled: tasks.filter((t) => t.triggerType === 'scheduled').length,
    };
  }, [tasks, total]);
}
