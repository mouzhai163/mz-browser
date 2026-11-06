import { extensionRegistry } from '@slotkitjs/core';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { createWindowResources } from './i18n/resources';
import { CreateWindowContent } from './components/create-window-content';
import { CreateWindowSkeleton } from './components/create-window-skeleton';
import type { WindowConfig } from './types';
// @ts-ignore - Cross-plugin import
import { getEnvironment } from '../../environment-manager/src/api';
import { transformEnvironmentConfigToWindowConfig } from './utils/environment-to-config';
// @ts-ignore - Cross-plugin import
import { getTemplate } from '../../system-settings/src/api/templates';
import { transformTemplateToWindowConfig } from './utils/template-to-config';
// @ts-ignore - Cross-plugin import
import { getEnvironmentLocalProxyBindings } from '../../../services/store/src';

const CreateWindowPage: React.FC = () => {
  useTranslation('create-window'); // 注册 i18n namespace
  const [searchParams] = useSearchParams();
  const editUuid = searchParams.get('edit');
  const templateUuid = searchParams.get('template');
  const fromTemplateUuid = searchParams.get('fromTemplate');

  const [windowConfig, setWindowConfig] = useState<WindowConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialGroupUuid, setInitialGroupUuid] = useState<string | undefined>();
  const [initialTagUuids, setInitialTagUuids] = useState<string[]>([]);

  // 如果是编辑模式、模板编辑模式或从模板创建环境，加载数据
  useEffect(() => {
    if (editUuid) {
      loadEnvironmentForEdit(editUuid);
    } else if (templateUuid) {
      loadTemplateForEdit(templateUuid);
    } else if (fromTemplateUuid) {
      loadTemplateForCreate(fromTemplateUuid);
    }
  }, [editUuid, templateUuid, fromTemplateUuid]);

  const loadEnvironmentForEdit = async (uuid: string) => {
    setLoading(true);
    try {
      const [detail, localBindings] = await Promise.all([
        getEnvironment({ uuid }),
        getEnvironmentLocalProxyBindings().catch(() => ({})),
      ]);
      const config = transformEnvironmentConfigToWindowConfig(detail);
      const localBinding = localBindings[uuid];
      if (localBinding) {
        config.windowInfo.proxySourceMode = 'local';
        config.windowInfo.proxyUuids = [];
        config.windowInfo.localProxyNodeNames = [localBinding.node_name];
      }
      setWindowConfig(config);

      // 设置分组和标签（从 detail 中获取，因为后端现在直接返回完整对象）
      setInitialGroupUuid(detail.group?.uuid);
      setInitialTagUuids(detail.tags.map((tag) => tag.uuid));
    } catch (error) {
      console.error('Failed to load environment for edit:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateForEdit = async (uuid: string) => {
    setLoading(true);
    try {
      const templateResponse = await getTemplate(uuid, false);
      const config = transformTemplateToWindowConfig(templateResponse);
      setWindowConfig(config);

      // 从模板的环境详情数据中获取分组和标签
      const envDetail = templateResponse.config_json as any;
      setInitialGroupUuid(envDetail?.group?.uuid);
      setInitialTagUuids((envDetail?.tags || []).map((tag: any) => tag.uuid));
    } catch (error) {
      console.error('Failed to load template for edit:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateForCreate = async (uuid: string) => {
    setLoading(true);
    try {
      // 传递 for_create=true 来检查关联数据是否存在
      const templateResponse = await getTemplate(uuid, true);
      const config = transformTemplateToWindowConfig(
        templateResponse,
        templateResponse.associations_status
      );
      setWindowConfig(config);

      // 从模板的环境详情数据中获取分组和标签
      const envDetail = templateResponse.config_json as any;
      const associationsStatus = templateResponse.associations_status;

      // 根据关联数据状态决定是否初始化分组和标签
      if (associationsStatus) {
        // 只有当分组存在时才初始化
        if (associationsStatus.group_exists && envDetail?.group?.uuid) {
          setInitialGroupUuid(envDetail.group.uuid);
        }

        // 只有当标签存在时才初始化
        const existingTagUuids = (envDetail?.tags || [])
          .filter((tag: any) => associationsStatus.tags_exist[tag.uuid] === true)
          .map((tag: any) => tag.uuid);
        setInitialTagUuids(existingTagUuids);
      } else {
        // 如果没有关联状态信息，使用原来的逻辑（向后兼容）
        setInitialGroupUuid(envDetail?.group?.uuid);
        setInitialTagUuids((envDetail?.tags || []).map((tag: any) => tag.uuid));
      }
    } catch (error) {
      console.error('Failed to load template for create:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <CreateWindowSkeleton />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-50px)] relative">
      <CreateWindowContent
        config={windowConfig}
        onConfigChange={setWindowConfig}
        editUuid={editUuid || undefined}
        templateUuid={templateUuid || undefined}
        initialGroupUuid={initialGroupUuid}
        initialTagUuids={initialTagUuids}
      />
    </div>
  );
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'create-window',
    value: {
      path: '/create-window',
      Component: CreateWindowPage,
    },
    priority: 10,
  });
  console.log('[create-window] Route contributed at module load: /create-window');
} catch (error) {
  console.warn('[create-window] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'create-window',
    value: {
      namespace: 'create-window',
      resources: createWindowResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[create-window] Failed to contribute i18n resources:', error);
}

const createWindowPlugin = {
  id: 'create-window',
  name: 'Create Window',
  version: '1.0.0',
  component: CreateWindowPage,
  slots: [],
};

export default createWindowPlugin;
