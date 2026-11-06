import { useCallback } from 'react';
import { batchDeleteRpaTasks, deleteRpaTask, duplicateRpaTask, getRpaTaskDetail } from '../api';
import {
  buildPortableRpaTask,
  buildPortableRpaTaskFilename,
  savePortableRpaTask,
  serializePortableRpaTask,
} from '../lib/rpa-transfer';

interface UseRpaOperationsParams {
  onSuccess?: () => void;
}

interface UseRpaOperationsReturn {
  deleteTask: (id: string) => Promise<void>;
  duplicateTask: (id: string) => Promise<void>;
  exportTask: (id: string) => Promise<boolean>;
  batchDelete: (ids: string[]) => Promise<void>;
}

export function useRpaOperations(params: UseRpaOperationsParams = {}): UseRpaOperationsReturn {
  const { onSuccess } = params;

  const deleteTask = useCallback(
    async (id: string) => {
      await deleteRpaTask(id);
      onSuccess?.();
    },
    [onSuccess]
  );

  const duplicateTask = useCallback(
    async (id: string) => {
      await duplicateRpaTask(id);
      onSuccess?.();
    },
    [onSuccess]
  );

  const exportTask = useCallback(async (id: string) => {
    const detail = await getRpaTaskDetail(id);
    const document = buildPortableRpaTask(detail);
    const content = serializePortableRpaTask(document);
    const filename = buildPortableRpaTaskFilename(detail);
    return savePortableRpaTask(filename, content);
  }, []);

  const batchDelete = useCallback(
    async (ids: string[]) => {
      await batchDeleteRpaTasks(ids);
      onSuccess?.();
    },
    [onSuccess]
  );

  return {
    deleteTask,
    duplicateTask,
    exportTask,
    batchDelete,
  };
}
