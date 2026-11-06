import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import type { Environment, TagItem } from '../types';
import { useRunningEnvsStore } from '../stores';
import {
  deleteEnvironment,
  updateEnvironment,
  batchDeleteEnvironments,
  batchMoveToGroup,
  batchAssignTags,
  batchRemoveTags,
  assignTags,
  removeTag,
  createTag,
  updateTag,
  deleteTag,
  refreshEnvironmentProxy,
  setEnvironmentProxy,
  createGroup,
  restoreEnvironment,
  batchRestoreEnvironments,
  permanentDeleteEnvironment,
  batchPermanentDeleteEnvironments,
} from '../api';
import { removeEnvironmentLocalProxyBinding } from '../../../../services/store/src';
import {
  type KernelPrepareStatusPayload,
  KERNEL_PREPARE_STATUS_EVENT,
  startEnvironmentRuntime,
  stopEnvironmentRuntime,
  batchStartEnvironmentsRuntime,
  batchStopEnvironmentsRuntime,
} from '../../../../services/environment/src';

interface BatchStartItem {
  envUuid: string;
  displayId: string;
}

interface UseEnvironmentOperationsReturn {
  submitting: boolean;
  loadingEnvUuid: string | null;
  kernelStatusMessage: string;
  startEnvironment: (id: string, displayId: string) => Promise<Environment>;
  stopEnvironment: (id: string) => Promise<void>;
  toggleEnvironment: (id: string, displayId: string) => Promise<Environment | void>;
  deleteEnvironment: (id: string) => Promise<void>;
  updateEnvironment: (id: string, data: Partial<Environment>) => Promise<Environment>;
  batchStart: (items: BatchStartItem[]) => Promise<Environment[]>;
  batchStop: (ids: string[]) => Promise<void>;
  batchUpdateProxy: (ids: string[], proxy: string) => Promise<Environment[]>;
  batchMoveToGroup: (ids: string[], groupId: string, groupName?: string, groupColor?: string) => Promise<Environment[]>;
  batchAssignTag: (ids: string[], tagId: string, tagName: string, tagColor: string) => Promise<Environment[]>;
  batchRemoveTag: (ids: string[], tagId?: string) => Promise<Environment[]>;
  batchDelete: (ids: string[]) => Promise<void>;
  assignTag: (environmentId: string, tagId: string, tagName: string, tagColor: string) => Promise<Environment[]>;
  removeTag: (environmentId: string, tagId?: string) => Promise<Environment[]>;
  removeProxy: (environmentId: string) => Promise<void>;
  createTag: (name: string, color: string) => Promise<TagItem>;
  updateTag: (uuid: string, name?: string, color?: string) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  createGroup: (name: string, description?: string) => Promise<string>;
  restoreEnvironment: (id: string) => Promise<void>;
  batchRestore: (ids: string[]) => Promise<void>;
  permanentDeleteEnvironment: (id: string) => Promise<void>;
  batchPermanentDelete: (ids: string[]) => Promise<void>;
}

export function useEnvironmentOperations(onComplete?: () => void): UseEnvironmentOperationsReturn {
  const [submitting, setSubmitting] = useState(false);
  const [loadingEnvUuid, setLoadingEnvUuid] = useState<string | null>(null);
  const [lastKernelStatus, setLastKernelStatus] = useState<{ envUuid: string | null; message: string }>({
    envUuid: null,
    message: '',
  });

  const { isRunning, refreshStatus, setStatus, triggerShake } = useRunningEnvsStore();

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;

    listen<KernelPrepareStatusPayload>(KERNEL_PREPARE_STATUS_EVENT, (event) => {
      if (!mounted) {
        return;
      }

      setLastKernelStatus({
        envUuid: event.payload.env_uuid ?? null,
        message: event.payload.message ?? event.payload.status ?? '',
      });
    }).then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  const kernelStatusMessage =
    loadingEnvUuid && lastKernelStatus.envUuid === loadingEnvUuid
      ? lastKernelStatus.message
      : loadingEnvUuid
        ? '准备中...'
        : '';

  const startEnvironment = async (id: string, displayId: string): Promise<Environment> => {
    setSubmitting(true);
    setLoadingEnvUuid(id);
    try {
      await startEnvironmentRuntime(id, displayId);
      await refreshStatus(id);
      return {} as Environment;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || '启动失败');
      await refreshStatus(id);
      throw error;
    } finally {
      setSubmitting(false);
      setLoadingEnvUuid(null);
    }
  };

  const stopEnvironment = async (id: string): Promise<void> => {
    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await stopEnvironmentRuntime(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || '停止失败');
      await refreshStatus(id);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEnvironment = async (id: string, displayId: string): Promise<Environment | void> => {
    if (isRunning(id)) {
      return stopEnvironment(id);
    }
    return startEnvironment(id, displayId);
  };

  const deleteEnvironmentOp = async (id: string): Promise<void> => {
    await deleteEnvironment({ uuid: id });
    onComplete?.();
  };

  const updateEnvironmentOp = async (id: string, data: Partial<Environment>): Promise<Environment> => {
    const payload: { uuid: string; name?: string; description?: string; group_uuid?: string } = {
      uuid: id,
    };

    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;

    await updateEnvironment(payload);
    onComplete?.();
    return {} as Environment;
  };

  const batchStart = async (items: BatchStartItem[]): Promise<Environment[]> => {
    setSubmitting(true);
    try {
      const ids = items.map((item) => item.envUuid);
      const notRunningIds = ids.filter((id) => !isRunning(id));
      const alreadyRunningIds = ids.filter((id) => isRunning(id));
      const displayIdsByEnvUuid = Object.fromEntries(
        items.map((item) => [item.envUuid, item.displayId])
      );

      alreadyRunningIds.forEach((id) => triggerShake(id));

      if (notRunningIds.length === 0) {
        return [];
      }

      notRunningIds.forEach((id) => setStatus(id, 'starting'));

      const results = await batchStartEnvironmentsRuntime(
        notRunningIds,
        displayIdsByEnvUuid
      );

      for (const result of results) {
        if (!result.success) {
          console.error(`Failed to start environment ${result.env_uuid}:`, result.error);
          toast.error(`启动环境失败: ${result.error}`);
          continue;
        }
        await refreshStatus(result.env_uuid);
      }

      return [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || '批量启动失败');
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const batchStop = async (ids: string[]): Promise<void> => {
    setSubmitting(true);
    try {
      const runningIds = ids.filter((id) => isRunning(id));
      const notRunningIds = ids.filter((id) => !isRunning(id));

      notRunningIds.forEach((id) => triggerShake(id));

      if (runningIds.length === 0) {
        return;
      }

      runningIds.forEach((id) => setStatus(id, 'stopping'));
      await new Promise((resolve) => setTimeout(resolve, 700));

      const results = await batchStopEnvironmentsRuntime(runningIds);
      for (const result of results) {
        if (!result.success) {
          console.error(`Failed to stop environment ${result.env_uuid}:`, result.error);
          toast.error(`停止环境失败: ${result.error}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || '批量停止失败');
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const batchUpdateProxy = async (ids: string[], proxy: string): Promise<Environment[]> => {
    void ids;
    void proxy;
    onComplete?.();
    return [];
  };

  const batchMoveToGroupOp = async (ids: string[], groupId: string): Promise<Environment[]> => {
    await batchMoveToGroup({ env_uuids: ids, group_uuid: groupId });
    onComplete?.();
    return [];
  };

  const batchAssignTagOp = async (ids: string[], tagId: string): Promise<Environment[]> => {
    await batchAssignTags({ env_uuids: ids, tag_uuid: tagId });
    onComplete?.();
    return [];
  };

  const batchRemoveTagOp = async (ids: string[], tagId?: string): Promise<Environment[]> => {
    await batchRemoveTags({ env_uuids: ids, tag_uuid: tagId });
    onComplete?.();
    return [];
  };

  const batchDeleteOp = async (ids: string[]): Promise<void> => {
    await batchDeleteEnvironments({ uuids: ids });
    onComplete?.();
  };

  const assignTagOp = async (environmentId: string, tagId: string): Promise<Environment[]> => {
    await assignTags({ uuid: environmentId, tag_uuids: [tagId] });
    onComplete?.();
    return [];
  };

  const removeTagOp = async (environmentId: string, tagId?: string): Promise<Environment[]> => {
    await removeTag({ uuid: environmentId, tag_uuid: tagId });
    onComplete?.();
    return [];
  };

  const removeProxyOp = async (environmentId: string): Promise<void> => {
    await removeEnvironmentLocalProxyBinding(environmentId);
    await setEnvironmentProxy({ uuid: environmentId, proxy_uuid: undefined });
    if (isRunning(environmentId)) {
      await refreshEnvironmentProxy(environmentId, null);
    }
    onComplete?.();
  };

  const createTagOp = async (name: string, color: string): Promise<TagItem> => {
    const result = await createTag({ name, color });
    onComplete?.();
    return result;
  };

  const updateTagOp = async (uuid: string, name?: string, color?: string): Promise<void> => {
    await updateTag({ uuid, name, color });
    onComplete?.();
  };

  const deleteTagOp = async (tagId: string): Promise<void> => {
    await deleteTag({ uuid: tagId });
    onComplete?.();
  };

  const createGroupOp = async (name: string, description?: string): Promise<string> => {
    const uuid = await createGroup({ name, description });
    onComplete?.();
    return uuid;
  };

  const restoreEnvironmentOp = async (id: string): Promise<void> => {
    await restoreEnvironment(id);
    toast.success('环境已恢复');
    onComplete?.();
  };

  const batchRestoreOp = async (ids: string[]): Promise<void> => {
    await batchRestoreEnvironments(ids);
    toast.success(`已恢复 ${ids.length} 个环境`);
    onComplete?.();
  };

  const permanentDeleteEnvironmentOp = async (id: string): Promise<void> => {
    await permanentDeleteEnvironment(id);
    toast.success('环境已永久删除');
    onComplete?.();
  };

  const batchPermanentDeleteOp = async (ids: string[]): Promise<void> => {
    await batchPermanentDeleteEnvironments(ids);
    toast.success(`已永久删除 ${ids.length} 个环境`);
    onComplete?.();
  };

  return {
    submitting,
    loadingEnvUuid,
    kernelStatusMessage,
    startEnvironment,
    stopEnvironment,
    toggleEnvironment,
    deleteEnvironment: deleteEnvironmentOp,
    updateEnvironment: updateEnvironmentOp,
    batchStart,
    batchStop,
    batchUpdateProxy,
    batchMoveToGroup: batchMoveToGroupOp,
    batchAssignTag: batchAssignTagOp,
    batchRemoveTag: batchRemoveTagOp,
    batchDelete: batchDeleteOp,
    assignTag: assignTagOp,
    removeTag: removeTagOp,
    removeProxy: removeProxyOp,
    createTag: createTagOp,
    updateTag: updateTagOp,
    deleteTag: deleteTagOp,
    createGroup: createGroupOp,
    restoreEnvironment: restoreEnvironmentOp,
    batchRestore: batchRestoreOp,
    permanentDeleteEnvironment: permanentDeleteEnvironmentOp,
    batchPermanentDelete: batchPermanentDeleteOp,
  };
}
