import { useState, useEffect, useCallback } from 'react';
import { listTeamMembers } from '../api';
import { useTeamFiltersStore } from '../stores';
import { useAuthStore } from '../../../../services/store/src/stores/auth';
import type { TeamMember } from '../types';

interface UseTeamMembersReturn {
  members: TeamMember[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 团队成员数据获取 Hook
 */
export function useTeamMembers(): UseTeamMembersReturn {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtersStore = useTeamFiltersStore();
  const { currentWorkspaceUuid } = useAuthStore();

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspaceUuid) {
      setMembers([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await listTeamMembers({
        workspace_uuid: currentWorkspaceUuid,
        page: filtersStore.currentPage,
        page_size: filtersStore.pageSize,
        filters: {
          keyword: filtersStore.searchQuery || undefined,
          role: filtersStore.roleFilter !== 'all' ? filtersStore.roleFilter : undefined,
        },
      });
      setMembers(response.items ?? []);
      setTotal(response.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [
    currentWorkspaceUuid,
    filtersStore.currentPage,
    filtersStore.pageSize,
    filtersStore.searchQuery,
    filtersStore.roleFilter,
  ]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!currentWorkspaceUuid) {
        setMembers([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await listTeamMembers({
          workspace_uuid: currentWorkspaceUuid,
          page: filtersStore.currentPage,
          page_size: filtersStore.pageSize,
          filters: {
            keyword: filtersStore.searchQuery || undefined,
            role: filtersStore.roleFilter !== 'all' ? filtersStore.roleFilter : undefined,
          },
        });

        if (!cancelled) {
          setMembers(response.items ?? []);
          setTotal(response.total ?? 0);
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

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    currentWorkspaceUuid,
    filtersStore.currentPage,
    filtersStore.pageSize,
    filtersStore.searchQuery,
    filtersStore.roleFilter,
  ]);

  const refresh = useCallback(async () => {
    await fetchMembers();
  }, [fetchMembers]);

  return {
    members,
    total,
    loading,
    error,
    refresh,
  };
}
