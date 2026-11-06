import { useState, useEffect, useCallback } from 'react';
import type { Group } from '../types';
import { listGroups } from '../api';

interface UseGroupsReturn {
    groups: Group[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

/**
 * 获取分组列表的 Hook
 */
export function useGroups(): UseGroupsReturn {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchGroups = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listGroups();
            setGroups(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : '未知错误');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await listGroups();
                if (!cancelled) {
                    setGroups(data);
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
    }, []);

    return {
        groups,
        loading,
        error,
        refresh: fetchGroups,
    };
}
