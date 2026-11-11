import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { getRpaTaskStats, type RpaTaskStats } from '../api';
import { rpaExecutionStore } from '../runtime/execution-manager';

const EMPTY: RpaTaskStats = { total: 0, running: 0, completed: 0, failed: 0, scheduled: 0 };

/** 全部任务的统计，不受当前页和筛选影响。tasks 变化（增删、刷新）时重新读取 */
export function useRpaStats(refreshKey: unknown): RpaTaskStats {
  const revision = useStore(rpaExecutionStore, (state) => state.revision);
  const [stats, setStats] = useState(EMPTY);

  useEffect(() => {
    let cancelled = false;
    void getRpaTaskStats()
      .then((next) => {
        if (!cancelled) setStats(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [refreshKey, revision]);

  return stats;
}
