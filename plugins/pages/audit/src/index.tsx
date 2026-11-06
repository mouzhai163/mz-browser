import { extensionRegistry } from '@slotkitjs/core';
import { auditResources } from './i18n/resources';
import { useState, useCallback, useMemo } from 'react';
import { AuditHeader } from './components/audit-header';
import { AuditStats } from './components/audit-stats';
import { AuditTable } from './components/audit-table';
import { AuditPagination } from './components/audit-pagination';
import { useAuditLogs } from './hooks/use-audit-logs';
import { useAuditStats } from './hooks/use-audit-stats';
import type { AuditLogFilters } from './api';

const AuditPage: React.FC = () => {
  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 构建筛选条件
  const filters = useMemo<AuditLogFilters>(() => {
    const f: AuditLogFilters = {};
    if (searchQuery) f.keyword = searchQuery;
    if (actionFilter) f.action = actionFilter;
    if (targetTypeFilter) f.target_type = targetTypeFilter;
    if (startDate) f.date_from = startDate;
    if (endDate) f.date_to = endDate;
    return f;
  }, [searchQuery, actionFilter, targetTypeFilter, startDate, endDate]);

  // 数据获取
  const {
    logs,
    total,
    loading,
    error,
    page,
    pageSize,
    setPage,
    setPageSize,
    setFilters,
    refresh: refreshLogs,
  } = useAuditLogs(20);

  // 统计数据
  const { stats, refresh: refreshStats } = useAuditStats();

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshLogs(), refreshStats()]);
  }, [refreshLogs, refreshStats]);

  // 计算总页数
  const totalPages = Math.ceil(total / pageSize);

  // 事件处理
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setFilters({ ...filters, keyword: value || undefined });
    },
    [filters, setFilters]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
    },
    [setPage]
  );

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSize(newSize);
    },
    [setPageSize]
  );

  const handleFilterChange = useCallback(
    (filterType: 'action' | 'targetType' | 'startDate' | 'endDate', value: string) => {
      const newFilters = { ...filters };

      switch (filterType) {
        case 'action':
          setActionFilter(value);
          if (value) newFilters.action = value;
          else delete newFilters.action;
          break;
        case 'targetType':
          setTargetTypeFilter(value);
          if (value) newFilters.target_type = value;
          else delete newFilters.target_type;
          break;
        case 'startDate':
          setStartDate(value);
          if (value) newFilters.date_from = value;
          else delete newFilters.date_from;
          break;
        case 'endDate':
          setEndDate(value);
          if (value) newFilters.date_to = value;
          else delete newFilters.date_to;
          break;
      }

      setFilters(newFilters);
    },
    [filters, setFilters]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-50px)] relative">
      <AuditHeader logs={logs} onSearchChange={handleSearchChange} />

      <AuditStats
        total={stats.total}
        todayCount={stats.todayCount}
        weekCount={stats.weekCount}
        onRefresh={handleRefresh}
      />

      {error && <div className="px-6 py-2 text-xs text-destructive">操作日志加载失败：{error}</div>}

      <AuditTable
        logs={logs}
        actionFilter={actionFilter}
        onActionFilterChange={(v) => handleFilterChange('action', v)}
        targetTypeFilter={targetTypeFilter}
        onTargetTypeFilterChange={(v) => handleFilterChange('targetType', v)}
        startDate={startDate}
        onStartDateChange={(v) => handleFilterChange('startDate', v)}
        endDate={endDate}
        onEndDateChange={(v) => handleFilterChange('endDate', v)}
        loading={loading}
      />

      <AuditPagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={total}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'audit',
    value: {
      path: '/audit',
      Component: AuditPage,
    },
    priority: 10,
  });
  console.log('[audit] Route contributed at module load: /audit');
} catch (error) {
  console.warn('[audit] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'audit',
    value: {
      namespace: 'audit',
      resources: auditResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[audit] Failed to contribute i18n resources:', error);
}

const auditPlugin = {
  id: 'audit',
  name: 'Audit',
  version: '1.0.0',
  component: AuditPage,
  slots: [],
};

export default auditPlugin;
