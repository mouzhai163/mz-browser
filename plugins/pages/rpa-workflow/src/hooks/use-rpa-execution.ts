import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useStore } from 'zustand';
import { getRpaTaskDetail, type RpaTaskDetailDto } from '../api';
import {
  rpaExecutionStore,
  startRpaExecution,
  stopRpaExecution,
  type RpaExecution,
} from '../runtime/execution-manager';
import type { RpaTask } from '../types';

interface PendingExecution {
  task: RpaTask;
  detail: RpaTaskDetailDto;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** 列表页的运行界面状态：运行确认框和运行进度抽屉。运行本身在执行管理器里 */
export function useRpaExecution(params: { tasks: RpaTask[]; onChange: () => void }) {
  const { tasks, onChange } = params;
  const executions = useStore(rpaExecutionStore, (state) => state.executions);
  const revision = useStore(rpaExecutionStore, (state) => state.revision);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runDialogLoading, setRunDialogLoading] = useState(false);
  const [pending, setPending] = useState<PendingExecution | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);

  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  useEffect(() => {
    if (revision > 0) onChange();
    // onChange 变化不需要重新刷新，只跟着运行状态走
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  const openDialog = useCallback(
    async (id: string) => {
      const task = taskMap.get(id);
      if (!task) return;
      setRunDialogLoading(true);
      try {
        setPending({ task, detail: await getRpaTaskDetail(id) });
        setRunDialogOpen(true);
      } catch (error) {
        toast.error(errorText(error));
      } finally {
        setRunDialogLoading(false);
      }
    },
    [taskMap]
  );

  const closeDialog = useCallback(() => {
    setRunDialogOpen(false);
    window.setTimeout(() => setPending(null), 0);
  }, []);

  const confirmRun = useCallback(
    async (variables: Record<string, string> = {}) => {
      if (!pending) return;
      try {
        await startRpaExecution(pending.task.id, { variables });
        setViewingTaskId(pending.task.id);
        closeDialog();
      } catch (error) {
        toast.error(errorText(error));
      }
    },
    [closeDialog, pending]
  );

  const isTaskExecuting = useCallback(
    (id: string) => executions[id]?.status === 'running' || executions[id]?.status === 'stopping',
    [executions]
  );
  const isTaskStopping = useCallback((id: string) => executions[id]?.status === 'stopping', [executions]);
  const canViewExecution = useCallback((id: string) => Boolean(executions[id]), [executions]);

  const viewing: RpaExecution | null = viewingTaskId ? (executions[viewingTaskId] ?? null) : null;

  return {
    runDialog: {
      open: runDialogOpen,
      loading: runDialogLoading,
      pending,
      closeDialog,
      confirmRun,
    },
    executionDrawer: {
      open: viewing !== null,
      execution: viewing,
      openDrawerForTask: setViewingTaskId,
      closeDrawer: () => setViewingTaskId(null),
      stopExecution: () => {
        if (viewingTaskId) stopRpaExecution(viewingTaskId);
      },
    },
    handleRun: openDialog,
    handleStop: async (id: string) => stopRpaExecution(id),
    isTaskExecuting,
    isTaskStopping,
    canViewExecution,
  };
}
