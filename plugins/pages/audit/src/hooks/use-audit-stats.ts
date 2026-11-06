import { useEffect, useState, useCallback } from 'react';
import type { AuditStatsResponse } from '../api';
import { getAuditStats } from '../api';

interface AuditStatsDisplay {
  total: number;
  todayCount: number;
  weekCount: number;
  monthCount: number;
}

interface UseAuditStatsReturn {
  stats: AuditStatsDisplay;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 获取审计统计的 Hook
 */
export function useAuditStats(): UseAuditStatsReturn {
  const [stats, setStats] = useState<AuditStatsDisplay>({
    total: 0,
    todayCount: 0,
    weekCount: 0,
    monthCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAuditStats();
      setStats({
        total: result.total_logs,
        todayCount: result.logs_today,
        weekCount: result.logs_this_week,
        monthCount: result.logs_this_month,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getAuditStats();
        if (!cancelled) {
          setStats({
            total: result.total_logs,
            todayCount: result.logs_today,
            weekCount: result.logs_this_week,
            monthCount: result.logs_this_month,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '未知错误');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}
