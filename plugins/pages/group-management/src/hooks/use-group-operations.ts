import { useState } from 'react';
import type { GroupFormData } from '../types';
import {
  createGroup as apiCreateGroup,
  updateGroup as apiUpdateGroup,
  deleteGroup as apiDeleteGroup,
  batchDeleteGroups as apiBatchDeleteGroups,
} from '../api';

interface UseGroupOperationsReturn {
  submitting: boolean;
  createGroup: (data: GroupFormData) => Promise<string>;
  updateGroup: (uuid: string, data: GroupFormData) => Promise<void>;
  deleteGroup: (uuid: string) => Promise<void>;
  batchDeleteGroups: (uuids: string[]) => Promise<void>;
  assignToTeam: (uuid: string, teamUuid: string) => Promise<void>;
}

/**
 * 分组操作逻辑 Hook
 */
export function useGroupOperations(onComplete?: () => void): UseGroupOperationsReturn {
  const [submitting, setSubmitting] = useState(false);

  const createGroup = async (data: GroupFormData): Promise<string> => {
    setSubmitting(true);
    try {
      const uuid = await apiCreateGroup({
        name: data.name,
        description: data.description || undefined,
      });
      onComplete?.();
      return uuid;
    } finally {
      setSubmitting(false);
    }
  };

  const updateGroup = async (uuid: string, data: GroupFormData): Promise<void> => {
    setSubmitting(true);
    try {
      await apiUpdateGroup({
        uuid,
        name: data.name,
        description: data.description || undefined,
      });
      onComplete?.();
    } finally {
      setSubmitting(false);
    }
  };

  const deleteGroup = async (uuid: string): Promise<void> => {
    await apiDeleteGroup({ uuid });
    onComplete?.();
  };

  const batchDeleteGroups = async (uuids: string[]): Promise<void> => {
    await apiBatchDeleteGroups({ uuids });
    onComplete?.();
  };

  const assignToTeam = async (): Promise<void> => {
    // TODO: 实现划分到团队的 API
    onComplete?.();
  };

  return {
    submitting,
    createGroup,
    updateGroup,
    deleteGroup,
    batchDeleteGroups,
    assignToTeam,
  };
}
