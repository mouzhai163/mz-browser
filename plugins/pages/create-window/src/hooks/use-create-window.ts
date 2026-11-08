import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { WindowConfig } from '../types';
import { getDefaultWindowConfig } from '../utils/default-config';
import {
  batchCreateEnvironments,
  saveAsTemplate,
  updateTemplate,
  transformWindowConfigToRequest,
} from '../api';
import {
  updateEnvironment,
  setEnvironmentProxy,
  listProxies,
  listAccounts,
  type ProxyItem,
  type AccountItem,
} from '../../../environment-manager/src/api';
import type { GroupItem, TagItem } from '../../../environment-manager/src/api';
// @ts-ignore - Cross-plugin import
import {
  removeEnvironmentLocalProxyBinding,
  setEnvironmentLocalProxyBinding,
  useSettingsDialogStore,
} from '../../../../services/store/src';

export interface CreateWindowOptions {
  groupUuid?: string;
  tagUuids?: string[];
}

export interface UseCreateWindowReturn {
  windowConfig: WindowConfig;
  createCount: number;
  isSubmitting: boolean;
  selectedGroupUuid: string | undefined;
  selectedTagUuids: string[];
  setCreateCount: (count: number) => void;
  setSelectedGroupUuid: (uuid: string | undefined) => void;
  setSelectedTagUuids: (uuids: string[]) => void;
  handleConfigUpdate: <K extends keyof WindowConfig>(key: K, value: WindowConfig[K]) => void;
  handleFullConfigUpdate: (config: WindowConfig) => void;
  handleSaveAsTemplate: () => Promise<void>;
  handleUpdateTemplate: () => Promise<void>;
  handleCreateWindow: () => Promise<void>;
}

/**
 * 新建环境的名称。只创建一个时原样使用输入的名称（没填则叫"窗口"）；
 * 一次创建多个时才加 _1、_2… 序号来区分。
 */
export function buildEnvironmentName(name: string | undefined, index: number, total: number): string {
  const base = name?.trim() || '窗口';
  return total > 1 ? `${base}_${index + 1}` : base;
}

/**
 * 创建窗口 Hook
 * 管理窗口配置状态和创建逻辑
 */
export function useCreateWindow(
  initialConfig: WindowConfig | null,
  onConfigChange: (config: WindowConfig) => void,
  editUuid?: string,
  templateUuid?: string,
  initialGroupUuid?: string,
  initialTagUuids?: string[]
): UseCreateWindowReturn {
  const navigate = useNavigate();
  const { t } = useTranslation('create-window');
  const { open: openSettingsDialog } = useSettingsDialogStore();

  const [windowConfig, setWindowConfig] = useState<WindowConfig>(
    initialConfig || getDefaultWindowConfig()
  );
  const [createCount, setCreateCount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedGroupUuid, setSelectedGroupUuid] = useState<string | undefined>(initialGroupUuid);
  const [selectedTagUuids, setSelectedTagUuids] = useState<string[]>(initialTagUuids || []);

  const isLocalProxyMode = windowConfig.windowInfo.proxySourceMode === 'local';
  const selectedRemoteProxyUuids = isLocalProxyMode ? [] : windowConfig.windowInfo.proxyUuids;
  const selectedLocalProxyNodeNames = isLocalProxyMode
    ? windowConfig.windowInfo.localProxyNodeNames
    : [];

  // 当初始配置变化时更新窗口配置
  useEffect(() => {
    if (initialConfig) {
      setWindowConfig(initialConfig);
    }
  }, [initialConfig]);

  // 当初始分组和标签变化时更新（编辑模式）
  useEffect(() => {
    if (editUuid) {
      if (initialGroupUuid !== undefined) {
        setSelectedGroupUuid(initialGroupUuid);
      }
      if (initialTagUuids !== undefined) {
        setSelectedTagUuids(initialTagUuids);
      }
    }
  }, [editUuid, initialGroupUuid, initialTagUuids]);

  // 更新单个配置项
  const handleConfigUpdate = useCallback(
    <K extends keyof WindowConfig>(key: K, value: WindowConfig[K]) => {
      const updated = { ...windowConfig, [key]: value };
      setWindowConfig(updated);
      onConfigChange(updated);
    },
    [windowConfig, onConfigChange]
  );

  // 更新完整配置
  const handleFullConfigUpdate = useCallback(
    (config: WindowConfig) => {
      setWindowConfig(config);
      onConfigChange(config);
    },
    [onConfigChange]
  );

  // 保存为模板
  const handleSaveAsTemplate = useCallback(
    async (fullData?: {
      groups?: GroupItem[];
      tags?: TagItem[];
      proxies?: ProxyItem[];
      accounts?: AccountItem[];
    }) => {
      if (isSubmitting) return;

      setIsSubmitting(true);
      try {
        const templateName = windowConfig.windowInfo.name || t('actions.defaultTemplateName');

        // 获取完整的数据对象
        let group: GroupItem | undefined;
        let tags: TagItem[] = [];
        let proxy: ProxyItem | undefined;
        let accounts: AccountItem[] = [];

        // 从传入的完整数据中查找
        if (fullData) {
          if (selectedGroupUuid && fullData.groups) {
            group = fullData.groups.find((g) => g.uuid === selectedGroupUuid);
          }
          if (selectedTagUuids.length > 0 && fullData.tags) {
            tags = fullData.tags.filter((t) => selectedTagUuids.includes(t.uuid));
          }
          if (selectedRemoteProxyUuids.length > 0 && fullData.proxies) {
            proxy = fullData.proxies.find((p) => p.uuid === selectedRemoteProxyUuids[0]);
          }
          if (windowConfig.windowInfo.accountUuids.length > 0 && fullData.accounts) {
            accounts = fullData.accounts.filter((a) =>
              windowConfig.windowInfo.accountUuids.includes(a.uuid)
            );
          }
        } else {
          // 如果没有传入完整数据，则从 API 获取
          const [proxiesList, accountsList] = await Promise.all([
            selectedRemoteProxyUuids.length > 0 ? listProxies() : Promise.resolve([]),
            windowConfig.windowInfo.accountUuids.length > 0 ? listAccounts() : Promise.resolve([]),
          ]);
          if (selectedRemoteProxyUuids.length > 0) {
            proxy = proxiesList.find((p) => p.uuid === selectedRemoteProxyUuids[0]);
          }
          if (windowConfig.windowInfo.accountUuids.length > 0) {
            accounts = accountsList.filter((a) =>
              windowConfig.windowInfo.accountUuids.includes(a.uuid)
            );
          }
        }

        await saveAsTemplate(
          windowConfig,
          templateName,
          windowConfig.windowInfo.description,
          false, // isPublic
          {
            group: group
              ? {
                  id: parseInt(group.id) || 0,
                  uuid: group.uuid,
                  name: group.name,
                  description: group.description,
                  sort_order: undefined, // GroupItem 没有 sortOrder 属性
                }
              : undefined,
            tags: tags.map((tag) => ({
              id: parseInt(tag.id) || 0,
              uuid: tag.uuid,
              name: tag.name,
              color: tag.color,
              sort_order: undefined, // TagItem 没有 sortOrder 属性
            })),
            accounts: accounts.map((account) => ({
              id: account.id,
              uuid: account.uuid,
              platform_url: account.platform_url,
              platform_name: account.platform_name,
              account: account.account,
              status: account.status,
              remark: account.remark,
            })),
            proxy: proxy
              ? {
                  id: proxy.id,
                  uuid: proxy.uuid,
                  name: proxy.name,
                  host: proxy.host,
                  port: proxy.port,
                  proxy_type: proxy.proxy_type,
                  country: proxy.country,
                  city: proxy.city,
                  status: proxy.status,
                  latency: proxy.latency,
                }
              : undefined,
          }
        );

        toast.success(t('actions.saveTemplateSuccess') || '模板保存成功', {
          action: {
            label: t('actions.goToManage') || '前往管理',
            onClick: () => {
              // 打开设置弹窗并切换到 general 标签页（模板管理在 general 标签页中）
              openSettingsDialog('general');
            },
          },
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('actions.saveTemplateFailed'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      windowConfig,
      selectedGroupUuid,
      selectedTagUuids,
      selectedRemoteProxyUuids,
      t,
      navigate,
      openSettingsDialog,
    ]
  );

  // 更新模板
  const handleUpdateTemplate = useCallback(
    async (fullData?: {
      groups?: GroupItem[];
      tags?: TagItem[];
      proxies?: ProxyItem[];
      accounts?: AccountItem[];
    }) => {
      if (isSubmitting || !templateUuid) return;

      setIsSubmitting(true);
      try {
        const templateName = windowConfig.windowInfo.name || t('actions.defaultTemplateName');

        // 获取完整的数据对象
        let group: GroupItem | undefined;
        let tags: TagItem[] = [];
        let proxy: ProxyItem | undefined;
        let accounts: AccountItem[] = [];

        // 从传入的完整数据中查找
        if (fullData) {
          if (selectedGroupUuid && fullData.groups) {
            group = fullData.groups.find((g) => g.uuid === selectedGroupUuid);
          }
          if (selectedTagUuids.length > 0 && fullData.tags) {
            tags = fullData.tags.filter((t) => selectedTagUuids.includes(t.uuid));
          }
          if (selectedRemoteProxyUuids.length > 0 && fullData.proxies) {
            proxy = fullData.proxies.find((p) => p.uuid === selectedRemoteProxyUuids[0]);
          }
          if (windowConfig.windowInfo.accountUuids.length > 0 && fullData.accounts) {
            accounts = fullData.accounts.filter((a) =>
              windowConfig.windowInfo.accountUuids.includes(a.uuid)
            );
          }
        } else {
          // 如果没有传入完整数据，则从 API 获取
          const [proxiesList, accountsList] = await Promise.all([
            selectedRemoteProxyUuids.length > 0 ? listProxies() : Promise.resolve([]),
            windowConfig.windowInfo.accountUuids.length > 0 ? listAccounts() : Promise.resolve([]),
          ]);
          if (selectedRemoteProxyUuids.length > 0) {
            proxy = proxiesList.find((p) => p.uuid === selectedRemoteProxyUuids[0]);
          }
          if (windowConfig.windowInfo.accountUuids.length > 0) {
            accounts = accountsList.filter((a) =>
              windowConfig.windowInfo.accountUuids.includes(a.uuid)
            );
          }
        }

        await updateTemplate(
          templateUuid,
          windowConfig,
          templateName,
          windowConfig.windowInfo.description,
          false, // isPublic
          {
            group: group
              ? {
                  id: parseInt(group.id) || 0,
                  uuid: group.uuid,
                  name: group.name,
                  description: group.description,
                  sort_order: undefined,
                }
              : undefined,
            tags: tags.map((tag) => ({
              id: parseInt(tag.id) || 0,
              uuid: tag.uuid,
              name: tag.name,
              color: tag.color,
              sort_order: undefined,
            })),
            accounts: accounts.map((account) => ({
              id: account.id,
              uuid: account.uuid,
              platform_url: account.platform_url,
              platform_name: account.platform_name,
              account: account.account,
              status: account.status,
              remark: account.remark,
            })),
            proxy: proxy
              ? {
                  id: proxy.id,
                  uuid: proxy.uuid,
                  name: proxy.name,
                  host: proxy.host,
                  port: proxy.port,
                  proxy_type: proxy.proxy_type,
                  country: proxy.country,
                  city: proxy.city,
                  status: proxy.status,
                  latency: proxy.latency,
                }
              : undefined,
          }
        );

        toast.success(
          t('actions.updateTemplateSuccess') || '模板更新成功！是否前往设置界面管理模板？',
          {
            action: {
              label: t('actions.goToManage') || '前往管理',
              onClick: () => {
                openSettingsDialog('general');
              },
            },
          }
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('actions.updateTemplateFailed') || '更新模板失败'
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      templateUuid,
      windowConfig,
      selectedGroupUuid,
      selectedTagUuids,
      selectedRemoteProxyUuids,
      t,
      openSettingsDialog,
    ]
  );

  // 创建或更新窗口
  const handleCreateWindow = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // 编辑模式：更新环境
      if (editUuid) {
        const proxyUuid = selectedRemoteProxyUuids.length > 0 ? selectedRemoteProxyUuids[0] : undefined;
        const localProxyNodeName =
          selectedLocalProxyNodeNames.length > 0 ? selectedLocalProxyNodeNames[0] : undefined;

        const request = transformWindowConfigToRequest(windowConfig, {
          groupUuid: selectedGroupUuid,
          tagUuids: selectedTagUuids.length > 0 ? selectedTagUuids : undefined,
          accountUuids:
            windowConfig.windowInfo.accountUuids.length > 0
              ? windowConfig.windowInfo.accountUuids
              : undefined,
          proxyUuid, // 编辑模式使用第一个代理
        });
        await updateEnvironment({
          uuid: editUuid,
          name: request.name,
          description: request.description,
          group_uuid: request.group_uuid,
          cookies: request.cookies,
          urls: request.urls,
          config: request.config,
        });
        if (isLocalProxyMode) {
          if (localProxyNodeName) {
            await setEnvironmentLocalProxyBinding(editUuid, localProxyNodeName);
          } else {
            await removeEnvironmentLocalProxyBinding(editUuid);
          }
        } else {
          await removeEnvironmentLocalProxyBinding(editUuid);
          await setEnvironmentProxy({ uuid: editUuid, proxy_uuid: proxyUuid });
        }
        toast.success(t('actions.updateSuccess') || '窗口更新成功');
        navigate('/');
        return;
      }

      // 创建模式：统一使用批量创建接口
      const configs = Array.from({ length: createCount }, (_, index) => ({
        ...windowConfig,
        windowInfo: {
          ...windowConfig.windowInfo,
          // 只创建一个时直接用输入的名称；批量创建才加序号区分
          name: buildEnvironmentName(windowConfig.windowInfo.name, index, createCount),
          // 批量创建时，其他数据相同，但代理需要按顺序分配
          proxyUuids: [], // 代理将在 API 调用时单独处理
          localProxyNodeNames: [], // 本地代理将在创建后单独处理
        },
      }));

      // 获取代理 UUID 列表（用于按顺序分配）
      const proxyUuids = selectedRemoteProxyUuids;
      const localProxyNodeNames = selectedLocalProxyNodeNames;

      const results = await batchCreateEnvironments(configs, proxyUuids, {
        groupUuid: selectedGroupUuid,
        tagUuids: selectedTagUuids.length > 0 ? selectedTagUuids : undefined,
      });
      if (isLocalProxyMode && localProxyNodeNames.length > 0) {
        await Promise.all(
          results.map((result, index) => {
            const nodeName = localProxyNodeNames[index];
            if (!nodeName) {
              return Promise.resolve();
            }
            return setEnvironmentLocalProxyBinding(result.uuid, nodeName);
          })
        );
      }
      toast.success(
        (t('actions.batchCreateSuccess') || '成功创建 {count} 个窗口').replace(
          '{count}',
          String(results.length)
        )
      );

      navigate('/');
    } catch (error) {
      const errorMessage = editUuid
        ? t('actions.updateFailed') || '窗口更新失败'
        : t('actions.createFailed') || '创建窗口失败';
      toast.error(error instanceof Error ? error.message : errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    createCount,
    windowConfig,
    selectedGroupUuid,
    selectedTagUuids,
    editUuid,
    t,
    navigate,
    isLocalProxyMode,
    selectedRemoteProxyUuids,
    selectedLocalProxyNodeNames,
  ]);

  return {
    windowConfig,
    createCount,
    isSubmitting,
    selectedGroupUuid,
    selectedTagUuids,
    setCreateCount,
    setSelectedGroupUuid,
    setSelectedTagUuids,
    handleConfigUpdate,
    handleFullConfigUpdate,
    handleSaveAsTemplate,
    handleUpdateTemplate,
    handleCreateWindow,
  };
}
