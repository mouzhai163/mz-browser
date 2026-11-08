import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@/lib/tauri';
import type { Environment, GroupItem, TagItem } from '../types';
import { listEnvironments, listRecycleBin, listGroups, listTags } from '../api';
import {
  getEnvironmentLocalProxyBindings,
  type EnvironmentLocalProxyBindingMap,
} from '../../../../services/store/src';
import type { EnvironmentViewType } from '../stores/filters-store';
import {
  buildMissingLocalProxySummary,
  getLocalMihomoProxyRecords,
  mapLocalMihomoProxyToProxySummary,
  type MihomoLocalProxyRecord,
} from '../utils';

interface UseEnvironmentsReturn {
  environments: Environment[];
  groups: GroupItem[];
  tags: TagItem[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UseEnvironmentsParams {
  page: number;
  pageSize: number;
  groupUuid?: string;
  keyword?: string;
  tagUuids?: string[];
  viewType?: EnvironmentViewType;
}

function applyLocalProxyBindings(
  environments: Environment[],
  bindings: EnvironmentLocalProxyBindingMap,
  localProxies: MihomoLocalProxyRecord[]
): Environment[] {
  if (environments.length === 0) {
    return environments;
  }

  const localProxyMap = new Map(localProxies.map((proxy) => [proxy.node_name, proxy]));

  return environments.map((environment) => {
    const binding = bindings[environment.uuid];
    if (!binding) {
      return environment;
    }

    const localProxy = localProxyMap.get(binding.node_name);
    return {
      ...environment,
      proxy: localProxy
        ? mapLocalMihomoProxyToProxySummary(localProxy)
        : buildMissingLocalProxySummary(binding.node_name),
    };
  });
}

/**
 * 获取环境列表的 Hook（支持服务端分页、回收站模式和已打开视图）
 */
export function useEnvironments({ page, pageSize, groupUuid, keyword, tagUuids, viewType = 'all' }: UseEnvironmentsParams): UseEnvironmentsReturn {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEnvironments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (groupUuid) filters.group_uuid = groupUuid;
      if (keyword) filters.keyword = keyword;
      if (tagUuids && tagUuids.length > 0) filters.tag_uuids = tagUuids;

      // 根据viewType选择不同的API
      const apiCall = viewType === 'trash' ? listRecycleBin : listEnvironments;
      const response = await apiCall({
        page,
        page_size: pageSize,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });
      const [bindings, localProxies] = await Promise.all([
        getEnvironmentLocalProxyBindings().catch(() => ({})),
        getLocalMihomoProxyRecords().catch(() => []),
      ]);
      setEnvironments(applyLocalProxyBindings(response.items ?? [], bindings, localProxies));
      setTotal(response.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, groupUuid, keyword, tagUuids, viewType]);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await listGroups();
      setGroups(data ?? []);
    } catch {
      // ignore
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const data = await listTags();
      setTags(data ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // 已打开视图：从 Tauri 获取运行中的环境 ID，然后在客户端过滤
        if (viewType === 'opened') {
          const [connectedEnvIds, allEnvsData, groupsData, tagsData, bindings, localProxies] =
            await Promise.all([
            invoke<string[]>('get_connected_environments').catch(() => []),
            listEnvironments({
              page: 1,
              page_size: 9999, // 获取所有环境用于客户端过滤
              filters: undefined,
            }),
            listGroups().catch(() => []),
            listTags().catch(() => []),
            getEnvironmentLocalProxyBindings().catch(() => ({})),
            getLocalMihomoProxyRecords().catch(() => []),
          ]);

          if (!cancelled) {
            // 过滤出运行中的环境
            const connectedEnvs = applyLocalProxyBindings(
              (allEnvsData.items ?? []).filter((env) =>
              connectedEnvIds.includes(env.uuid)
              ),
              bindings,
              localProxies
            );

            // 客户端分页
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedEnvs = connectedEnvs.slice(startIndex, endIndex);

            setEnvironments(paginatedEnvs);
            setTotal(connectedEnvs.length);
            setGroups(groupsData ?? []);
            setTags(tagsData ?? []);
          }
          return;
        }

        // 回收站或正常视图：使用服务端分页
        const filters: any = {};
        if (groupUuid) filters.group_uuid = groupUuid;
        if (keyword) filters.keyword = keyword;
        if (tagUuids && tagUuids.length > 0) filters.tag_uuids = tagUuids;

        const apiCall = viewType === 'trash' ? listRecycleBin : listEnvironments;
        const [envsData, groupsData, tagsData, bindings, localProxies] = await Promise.all([
          apiCall({
            page,
            page_size: pageSize,
            filters: Object.keys(filters).length > 0 ? filters : undefined,
          }),
          listGroups().catch(() => []),
          listTags().catch(() => []),
          getEnvironmentLocalProxyBindings().catch(() => ({})),
          getLocalMihomoProxyRecords().catch(() => []),
        ]);

        if (!cancelled) {
          setEnvironments(applyLocalProxyBindings(envsData.items ?? [], bindings, localProxies));
          setTotal(envsData.total ?? 0);
          setGroups(groupsData ?? []);
          setTags(tagsData ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '未知错误');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, groupUuid, keyword, tagUuids, viewType]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchEnvironments(), fetchGroups(), fetchTags()]);
  }, [fetchEnvironments, fetchGroups, fetchTags]);

  return {
    environments,
    groups,
    tags,
    total,
    loading,
    error,
    refresh,
  };
}
