import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { RpaTask } from '../types';
import { useRpaOperations } from './use-rpa-operations';
import { useRpaSelection } from './use-rpa-selection';
import { useRpaExecution } from './use-rpa-execution';

interface UseRpaHandlersParams {
  tasks: RpaTask[];
  paginatedTasks: RpaTask[];
  onRefresh: () => Promise<void>;
}

interface UseRpaHandlersReturn {
  selection: ReturnType<typeof useRpaSelection>;
  operations: ReturnType<typeof useRpaOperations>;
  execution: ReturnType<typeof useRpaExecution>;
  handleCreateTask: () => void;
  handleEdit: (task: RpaTask) => void;
  handleRun: (id: string) => Promise<void>;
  handleStop: (id: string) => Promise<void>;
  handleViewExecution: (id: string) => void;
  handleDelete: (id: string, name: string) => void;
  handleDuplicate: (id: string) => Promise<void>;
  handleExport: (id: string, name: string) => void;
  handleViewLogs: (id: string) => void;
  handleBatchRun: () => Promise<void>;
  handleBatchDelete: () => void;
  deleteDialog: {
    open: boolean;
    task: { id: string; name: string } | null;
    openDialog: (id: string, name: string) => void;
    closeDialog: () => void;
  };
  exportDialog: {
    open: boolean;
    task: { id: string; name: string } | null;
    openDialog: (id: string, name: string) => void;
    closeDialog: () => void;
  };
  batchDeleteDialog: {
    open: boolean;
    openDialog: () => void;
    closeDialog: () => void;
  };
  handleConfirmDelete: () => Promise<void>;
  handleConfirmExport: () => Promise<boolean>;
  handleConfirmBatchDelete: () => Promise<void>;
}

export function useRpaHandlers(params: UseRpaHandlersParams): UseRpaHandlersReturn {
  const { tasks, paginatedTasks, onRefresh } = params;
  const navigate = useNavigate();

  const operations = useRpaOperations({
    onSuccess: () => {
      void onRefresh();
    },
  });

  const execution = useRpaExecution({ tasks });
  const selection = useRpaSelection({ paginatedTasks });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<{ id: string; name: string } | null>(null);
  const [exportingTask, setExportingTask] = useState<{ id: string; name: string } | null>(null);

  const handleCreateTask = useCallback(() => {
    navigate('/rpa/create');
  }, [navigate]);

  const handleEdit = useCallback(
    (task: RpaTask) => {
      navigate(`/rpa/edit/${task.id}`);
    },
    [navigate]
  );

  const handleDelete = useCallback((id: string, name: string) => {
    setDeletingTask({ id, name });
    setDeleteDialogOpen(true);
  }, []);

  const handleExport = useCallback((id: string, name: string) => {
    setExportingTask({ id, name });
    setExportDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingTask) {
      return;
    }

    try {
      await operations.deleteTask(deletingTask.id);
      setDeleteDialogOpen(false);
      setDeletingTask(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }, [deletingTask, operations]);

  const handleConfirmExport = useCallback(async () => {
    if (!exportingTask) {
      return false;
    }

    try {
      const success = await operations.exportTask(exportingTask.id);
      if (success) {
        setExportDialogOpen(false);
        setExportingTask(null);
      }
      return success;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
      return false;
    }
  }, [exportingTask, operations]);

  const handleDuplicate = useCallback(
    async (id: string) => {
      try {
        await operations.duplicateTask(id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Duplicate failed');
      }
    },
    [operations]
  );

  const handleViewLogs = useCallback((id: string) => {
    if (execution.isTaskExecuting(id)) {
      execution.executionDrawer.openDrawer();
      return;
    }
    toast.info(`View execution logs for task ${id}`);
  }, [execution]);

  const handleViewExecution = useCallback(
    (id: string) => {
      execution.executionDrawer.openDrawerForTask(id);
    },
    [execution]
  );

  const handleBatchRun = useCallback(async () => {
    toast.info('批量执行将在正式执行抽屉完成后再接入');
  }, []);

  const handleBatchDelete = useCallback(() => {
    setBatchDeleteDialogOpen(true);
  }, []);

  const handleConfirmBatchDelete = useCallback(async () => {
    try {
      await operations.batchDelete(Array.from(selection.selectedIds));
      setBatchDeleteDialogOpen(false);
      selection.clearSelection();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Batch delete failed');
    }
  }, [operations, selection]);

  return {
    selection,
    operations,
    execution,
    handleCreateTask,
    handleEdit,
    handleRun: execution.handleRun,
    handleStop: execution.handleStop,
    handleViewExecution,
    handleDelete,
    handleDuplicate,
    handleExport,
    handleViewLogs,
    handleBatchRun,
    handleBatchDelete,
    deleteDialog: {
      open: deleteDialogOpen,
      task: deletingTask,
      openDialog: handleDelete,
      closeDialog: () => {
        setDeleteDialogOpen(false);
        setDeletingTask(null);
      },
    },
    exportDialog: {
      open: exportDialogOpen,
      task: exportingTask,
      openDialog: handleExport,
      closeDialog: () => {
        setExportDialogOpen(false);
        setExportingTask(null);
      },
    },
    batchDeleteDialog: {
      open: batchDeleteDialogOpen,
      openDialog: handleBatchDelete,
      closeDialog: () => setBatchDeleteDialogOpen(false),
    },
    handleConfirmDelete,
    handleConfirmExport,
    handleConfirmBatchDelete,
  };
}
