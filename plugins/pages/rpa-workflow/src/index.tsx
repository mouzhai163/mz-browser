/* eslint-disable react-refresh/only-export-components */
import { extensionRegistry } from '@slotkitjs/core';
import { invoke } from '@/lib/tauri';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import { rpaResources } from './i18n/resources';
import { RpaHeader } from './components/rpa-header';
import { RpaStats } from './components/rpa-stats';
import { RpaTable } from './components/rpa-table';
import { RpaBatchActions } from './components/rpa-batch-actions';
import { RpaPagination } from './components/rpa-pagination';
import { RpaDeleteDialog } from './components/rpa-delete-dialog';
import { RpaBatchDeleteDialog } from './components/rpa-batch-delete-dialog';
import { RpaExportDialog } from './components/rpa-export-dialog';
import { RpaImportDialog } from './components/rpa-import-dialog';
import { RpaRunDialog } from './components/rpa-run-dialog';
import { RpaExecutionDrawer } from './components/rpa-execution-drawer';
import { TaskEditor } from './components/task-editor';
import { useRpaTasks } from './hooks/use-rpa-tasks';
import { useRpaStats } from './hooks/use-rpa-stats';
import { useRpaHandlers } from './hooks/use-rpa-handlers';
import { useSearchPagination } from './hooks/use-search-pagination';
import { useDebouncedValue } from './hooks/use-debounced-value';
import { useRpaFiltersState } from './hooks/use-rpa-filters-state';
import type { RpaStatusFilter } from './types';
import {
  buildPortableRpaTaskSummary,
  parsePortableRpaTask,
  type PortableRpaTaskDocument,
} from './lib/rpa-transfer';
import { useNavigate } from 'react-router';

const RPAWorkflowPage: React.FC = () => {
  const { t } = useTranslation('rpa');
  const navigate = useNavigate();
  const { searchQuery, currentPage, handleSearchChange, handlePageChange } = useSearchPagination();
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const { statusFilter, setStatusFilter } = useRpaFiltersState();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importedDocument, setImportedDocument] = useState<PortableRpaTaskDocument | null>(null);

  const {
    tasks,
    loading,
    error,
    refresh,
    total,
    currentPage: resolvedPage,
    totalPages,
  } = useRpaTasks({
    page: currentPage,
    pageSize: 20,
    searchQuery: debouncedSearchQuery,
    statusFilter,
  });

  const stats = useRpaStats({ tasks, total });

  const handlers = useRpaHandlers({
    tasks,
    paginatedTasks: tasks,
    onRefresh: refresh,
  });

  const handleSearchChangeWithReset = (value: string) => {
    handleSearchChange(value);
    handlers.selection.clearSelection();
  };

  const handleStatusFilterChange = (filter: string) => {
    setStatusFilter(filter as RpaStatusFilter);
    handlePageChange(1);
    handlers.selection.clearSelection();
  };

  const handlePageChangeWithClearSelection = (page: number) => {
    handlePageChange(page);
    handlers.selection.clearSelection();
  };

  const importSummary = useMemo(
    () => (importedDocument ? buildPortableRpaTaskSummary(importedDocument) : null),
    [importedDocument]
  );

  const handleImportTask = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'JSON 文件', extensions: ['json'] }],
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const content = await invoke<string>('read_text_file', { path: selected });
      const document = parsePortableRpaTask(content);
      setImportedDocument(document);
      setImportDialogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入文件读取失败';
      window.alert(message);
    }
  };

  const handlePreviewImport = () => {
    if (!importedDocument) {
      return;
    }

    navigate('/rpa/create', {
      state: {
        importedRpaDocument: importedDocument,
      },
    });
    setImportDialogOpen(false);
    setImportedDocument(null);
  };

  return (
    <div className="relative flex h-[calc(100vh-50px)] flex-col">
      <RpaHeader
        searchQuery={searchQuery}
        onSearchChange={handleSearchChangeWithReset}
        onCreateTask={handlers.handleCreateTask}
        onImportTask={handleImportTask}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        onRefresh={refresh}
      >
        <RpaStats
          total={stats.total}
          running={stats.running}
          completed={stats.completed}
          failed={stats.failed}
          scheduled={stats.scheduled}
        />
      </RpaHeader>

      {error && (
        <div className="bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {t('error', { message: error })}
        </div>
      )}

      <RpaTable
        tasks={tasks}
        selectedIds={handlers.selection.selectedIds}
        onSelect={handlers.selection.select}
        onSelectAll={handlers.selection.selectAll}
        onRun={handlers.handleRun}
        onStop={handlers.handleStop}
        onViewExecution={handlers.handleViewExecution}
        onEdit={handlers.handleEdit}
        onDelete={handlers.handleDelete}
        onDuplicate={handlers.handleDuplicate}
        onExport={handlers.handleExport}
        onViewLogs={handlers.handleViewLogs}
        isTaskExecuting={handlers.execution.isTaskExecuting}
        isTaskStopping={handlers.execution.isTaskStopping}
        canViewExecution={handlers.execution.canViewExecution}
        loading={loading}
      />

      <RpaPagination
        currentPage={resolvedPage}
        totalPages={totalPages}
        onPageChange={handlePageChangeWithClearSelection}
      />

      <RpaBatchActions
        selectedCount={handlers.selection.selectedIds.size}
        onBatchRun={handlers.handleBatchRun}
        onBatchDelete={handlers.handleBatchDelete}
        onClearSelection={handlers.selection.clearSelection}
      />

      <RpaDeleteDialog
        open={handlers.deleteDialog.open}
        task={handlers.deleteDialog.task}
        onOpenChange={handlers.deleteDialog.closeDialog}
        onConfirm={handlers.handleConfirmDelete}
      />

      <RpaExportDialog
        open={handlers.exportDialog.open}
        task={handlers.exportDialog.task}
        onOpenChange={handlers.exportDialog.closeDialog}
        onConfirm={handlers.handleConfirmExport}
      />

      <RpaBatchDeleteDialog
        open={handlers.batchDeleteDialog.open}
        count={handlers.selection.selectedIds.size}
        onOpenChange={handlers.batchDeleteDialog.closeDialog}
        onConfirm={handlers.handleConfirmBatchDelete}
      />

      <RpaImportDialog
        open={importDialogOpen}
        summary={importSummary}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) {
            setImportedDocument(null);
          }
        }}
        onPreview={handlePreviewImport}
      />

      <RpaRunDialog
        open={handlers.execution.runDialog.open}
        loading={handlers.execution.runDialog.loading}
        pending={handlers.execution.runDialog.pending}
        onOpenChange={(open) => {
          if (!open) {
            handlers.execution.runDialog.closeDialog();
          }
        }}
        onConfirm={handlers.execution.runDialog.confirmRun}
      />

      <RpaExecutionDrawer
        open={handlers.execution.executionDrawer.open}
        execution={handlers.execution.executionDrawer.execution}
        onOpenChange={(open) => {
          if (!open) {
            handlers.execution.executionDrawer.closeDrawer();
          }
        }}
        onStop={handlers.execution.executionDrawer.stopExecution}
      />
    </div>
  );
};

try {
  extensionRegistry.contribute('routes', {
    contributorId: 'rpa-workflow',
    value: {
      path: '/rpa',
      Component: RPAWorkflowPage,
    },
    priority: 10,
  });

  extensionRegistry.contribute('routes', {
    contributorId: 'rpa-workflow-create',
    value: {
      path: '/rpa/create',
      Component: TaskEditor,
    },
    priority: 10,
  });

  extensionRegistry.contribute('routes', {
    contributorId: 'rpa-workflow-edit',
    value: {
      path: '/rpa/edit/:id',
      Component: TaskEditor,
    },
    priority: 10,
  });

  console.log('[rpa-workflow] Routes contributed at module load: /rpa, /rpa/create, /rpa/edit/:id');
} catch (error) {
  console.warn('[rpa-workflow] Failed to contribute routes at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'rpa-workflow',
    value: {
      namespace: 'rpa',
      resources: rpaResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[rpa-workflow] Failed to contribute i18n resources:', error);
}

const rpaWorkflowPlugin = {
  id: 'rpa-workflow',
  name: 'RPA Workflow',
  version: '1.0.0',
  component: RPAWorkflowPage,
  slots: [],
};

export default rpaWorkflowPlugin;
