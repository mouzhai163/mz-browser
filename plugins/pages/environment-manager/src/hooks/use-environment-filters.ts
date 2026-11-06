import { useMemo } from 'react';
import type { Environment, TagItem, GroupItem } from '../types';

interface UseEnvironmentFiltersProps {
  environments: Environment[];
  searchQuery: string;
  filterTagId: string;
  filterGroupId: string;
  availableTags: TagItem[];
  availableGroups: GroupItem[];
}

/**
 * 环境过滤 Hook
 */
export function useEnvironmentFilters({
  environments,
  searchQuery,
  filterTagId,
  filterGroupId,
  availableTags,
  availableGroups,
}: UseEnvironmentFiltersProps): Environment[] {
  return useMemo(() => {
    let filtered = environments;

    // 标签筛选
    if (filterTagId) {
      const selectedTag = availableTags.find((t) => t.uuid === filterTagId);
      if (selectedTag) {
        filtered = filtered.filter((env) =>
          env.tags?.some(tag => tag.name === selectedTag.name)
        );
      }
    }

    // 分组筛选
    if (filterGroupId) {
      const selectedGroup = availableGroups.find((g) => g.uuid === filterGroupId);
      if (selectedGroup) {
        filtered = filtered.filter((env) => env.group?.name === selectedGroup.name);
      }
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((env) => {
        // 基本字段搜索
        const nameMatch = env.name?.toLowerCase().includes(query);
        const uuidMatch = env.uuid?.toLowerCase().includes(query);

        // 代理搜索（ProxySummary 对象）
        const proxyMatch = env.proxy?.name?.toLowerCase().includes(query) ||
                          env.proxy?.host?.toLowerCase().includes(query);

        // 账号搜索（AccountSummary 数组）
        const accountMatch = env.accounts?.some(acc =>
          acc.account?.toLowerCase().includes(query) ||
          acc.platform_name?.toLowerCase().includes(query)
        );

        // 分组搜索（GroupSummary 对象）
        const groupMatch = env.group?.name?.toLowerCase().includes(query);

        // 标签搜索（TagSummary 数组）
        const tagMatch = env.tags?.some(tag =>
          tag.name?.toLowerCase().includes(query)
        );

        return nameMatch || uuidMatch || proxyMatch || accountMatch || groupMatch || tagMatch;
      });
    }

    return filtered;
  }, [environments, searchQuery, filterTagId, filterGroupId, availableTags, availableGroups]);
}
