import { useMemo } from 'react';
import type { Group } from '../types';

/**
 * 分组过滤 Hook
 */
export function useGroupFilters(groups: Group[], searchQuery: string): Group[] {
  return useMemo(() => {
    if (!searchQuery.trim()) return groups;

    const query = searchQuery.toLowerCase();
    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(query) ||
        group.id.toLowerCase().includes(query) ||
        (group.description && group.description.toLowerCase().includes(query))
    );
  }, [groups, searchQuery]);
}
