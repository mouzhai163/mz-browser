import { useState } from 'react';
import type { RoleFilter } from '../types';

interface UseRoleFilterReturn {
  roleFilter: RoleFilter;
  setRoleFilter: (filter: RoleFilter) => void;
  handleRoleFilterChange: (filter: RoleFilter) => void;
}

/**
 * 角色过滤器状态管理 Hook
 */
export function useRoleFilter(): UseRoleFilterReturn {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const handleRoleFilterChange = (filter: RoleFilter) => {
    setRoleFilter(filter);
  };

  return {
    roleFilter,
    setRoleFilter,
    handleRoleFilterChange,
  };
}
