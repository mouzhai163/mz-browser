import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WindowInfoForm } from './window-info-form';
import { NetworkLocationForm } from './network-location-form';
import { FingerprintForm } from './fingerprint-form';
import { ScreenHardwareForm } from './screen-hardware-form';
import { BrowserBehaviorForm } from './browser-behavior-form';
import { WindowSummary } from './window-summary';
import { ImportDialog } from './import-dialog';
import { QuantitySelector } from './quantity-selector';
import { CreateWindowSelectGroupDialog } from './create-window-select-group-dialog';
import { CreateWindowSelectTagsDialog } from './create-window-select-tags-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  FolderOpen,
  Tag,
  Plus,
  Save,
  Upload,
  Loader2,
  CheckCircle2,
  ChevronDown,
  X,
} from 'lucide-react';
import type { WindowConfig } from '../types';
import { useCreateWindow, useScrollNavigation } from '../hooks';
import { generateAllFingerprintSettings } from '../utils/fingerprint-generator';
import { generateUserAgentByKernel } from '../utils/user-agent-generator';
// @ts-ignore - Cross-plugin import
import {
  listGroups,
  listTags,
  listProxies,
  listAccounts,
  type GroupItem,
  type TagItem,
  type ProxyItem,
  type AccountItem,
} from '../../../environment-manager/src/api';
// @ts-ignore - Cross-plugin import
import { getTagDotColorClasses } from '../../../environment-manager/src/utils';
// @ts-ignore - Cross-plugin import
import {
  listTemplates,
  getTemplate,
  type TemplateDto,
} from '../../../system-settings/src/api/templates';
import { transformTemplateToWindowConfig } from '../utils/template-to-config';
import { toast } from 'sonner';

// 导航栏配置
const SECTIONS = [
  { id: 'basic-info', key: 'sections.basicInfo' },
  { id: 'network-location', key: 'sections.networkLocation' },
  { id: 'fingerprint', key: 'sections.fingerprint' },
  { id: 'screen-hardware', key: 'sections.screenHardware' },
  { id: 'browser-behavior', key: 'sections.browserBehavior' },
] as const;

const SECTION_IDS = SECTIONS.map((s) => s.id);

interface CreateWindowContentProps {
  config: WindowConfig | null;
  onConfigChange: (config: WindowConfig) => void;
  editUuid?: string;
  templateUuid?: string; // 模板编辑模式下的模板 UUID
  initialGroupUuid?: string; // 编辑模式下的初始分组 UUID
  initialTagUuids?: string[]; // 编辑模式下的初始标签 UUID 列表
}

export function CreateWindowContent({
  config,
  onConfigChange,
  editUuid,
  templateUuid,
  initialGroupUuid,
  initialTagUuids,
}: CreateWindowContentProps) {
  const { t } = useTranslation('create-window');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);

  // 分组、标签、代理、账号列表
  const [allGroups, setAllGroups] = useState<GroupItem[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [, setAllProxies] = useState<ProxyItem[]>([]);
  const [, setAllAccounts] = useState<AccountItem[]>([]);
  const [, setLoadingGroups] = useState(false);
  const [, setLoadingTags] = useState(false);

  // 模板相关状态
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDto | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // 滚动导航
  const { activeSection, scrollContainerRef, sectionRefs, scrollToSection } =
    useScrollNavigation(SECTION_IDS);

  // 窗口创建逻辑
  const {
    windowConfig,
    createCount,
    isSubmitting,
    setCreateCount,
    selectedGroupUuid,
    selectedTagUuids,
    setSelectedGroupUuid,
    setSelectedTagUuids,
    handleConfigUpdate,
    handleFullConfigUpdate,
    handleSaveAsTemplate,
    handleUpdateTemplate,
    handleCreateWindow,
  } = useCreateWindow(
    config,
    onConfigChange,
    editUuid,
    templateUuid,
    initialGroupUuid,
    initialTagUuids
  );

  const isEditMode = !!editUuid;
  const isTemplateEditMode = !!templateUuid;

  // 加载分组、标签、代理、账号列表
  useEffect(() => {
    const loadData = async () => {
      setLoadingGroups(true);
      setLoadingTags(true);
      try {
        const [groups, tags, proxies, accounts] = await Promise.all([
          listGroups(),
          listTags(),
          listProxies().catch(() => []), // 忽略错误
          listAccounts().catch(() => []), // 忽略错误
        ]);
        setAllGroups(groups);
        setAllTags(tags);
        setAllProxies(proxies);
        setAllAccounts(accounts);
      } catch {
        // 忽略错误
      } finally {
        setLoadingGroups(false);
        setLoadingTags(false);
      }
    };
    loadData();
  }, []);

  // 加载模板列表
  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const response = await listTemplates({ page: 1, page_size: 100 });
        setTemplates(response.items);
      } catch (e) {
        // 不要静默失败，否则看起来像“没有模板”
        console.error('Failed to load templates:', e);
        toast.error(
          e instanceof Error ? e.message : t('actions.loadTemplatesFailed') || '加载模板失败'
        );
      } finally {
        setLoadingTemplates(false);
      }
    };
    void loadTemplates();
  }, []);

  // 应用模板
  const handleApplyTemplate = useCallback(
    async (template: TemplateDto) => {
      setApplyingTemplate(true);
      try {
        const templateResponse = await getTemplate(template.uuid, false);
        const config = transformTemplateToWindowConfig(templateResponse);

        // 应用配置
        handleFullConfigUpdate(config);

        // 设置选中的模板
        setSelectedTemplate(template);

        // 从模板的环境详情数据中获取分组和标签
        const envDetail = templateResponse.config_json as any;
        if (envDetail?.group?.uuid) {
          setSelectedGroupUuid(envDetail.group.uuid);
        }
        if (envDetail?.tags && envDetail.tags.length > 0) {
          setSelectedTagUuids(envDetail.tags.map((tag: any) => tag.uuid));
        }

        toast.success(t('actions.applyTemplateSuccess') || '模板应用成功');
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : t('actions.applyTemplateFailed') || '应用模板失败'
        );
      } finally {
        setApplyingTemplate(false);
      }
    },
    [handleFullConfigUpdate, setSelectedGroupUuid, setSelectedTagUuids, t]
  );

  // 一键随机指纹
  const handleRandomizeFingerprint = useCallback(() => {
    const { fingerprintSettings, deviceSettings } = generateAllFingerprintSettings();
    // 同时更新 User Agent
    const newUserAgent = generateUserAgentByKernel(
      windowConfig.windowInfo.system,
      windowConfig.windowInfo.kernel
    );
    // 一次性更新所有配置
    handleFullConfigUpdate({
      ...windowConfig,
      advancedFingerprintSettings: fingerprintSettings,
      deviceSettings: {
        ...windowConfig.deviceSettings,
        ...deviceSettings,
      },
      windowInfo: {
        ...windowConfig.windowInfo,
        userAgent: newUserAgent,
      },
    });
  }, [windowConfig, handleFullConfigUpdate]);

  // 获取选中的分组信息
  const selectedGroup = useMemo(() => {
    if (!selectedGroupUuid) return null;
    return allGroups.find((g) => g.uuid === selectedGroupUuid) || null;
  }, [selectedGroupUuid, allGroups]);

  // 获取选中的标签信息
  const selectedTags = useMemo(() => {
    if (!selectedTagUuids || selectedTagUuids.length === 0) return [];
    return allTags.filter((t) => selectedTagUuids.includes(t.uuid));
  }, [selectedTagUuids, allTags]);

  return (
    <div className="flex flex-col h-full relative">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border bg-background/10 backdrop-blur-2xl">
        {/* 导航栏 */}
        <nav className="flex items-center gap-1">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md transition-all duration-200',
                activeSection === section.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {t(section.key)}
            </button>
          ))}
        </nav>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          {!isTemplateEditMode && (
            <div className="flex items-center h-8 border border-input rounded-md overflow-hidden">
              {/* 存储模板按钮 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAsTemplate}
                disabled={isSubmitting}
                className="h-8 text-xs rounded-none border-0 border-r border-input"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                {t('actions.saveTemplate')}
              </Button>
              {/* 分隔符和模板选择 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={applyingTemplate || loadingTemplates}
                    className="h-8 text-xs rounded-none border-0 px-2"
                  >
                    {applyingTemplate ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : selectedTemplate ? (
                      <div className="flex items-center gap-1.5">
                        <span className="max-w-[120px] truncate text-xs">
                          {selectedTemplate.name}
                        </span>
                        <X
                          className="h-3 w-3 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTemplate(null);
                            // 清除分组和标签（可选，根据需求决定是否清除）
                            // setSelectedGroupUuid(undefined);
                            // setSelectedTagUuids([]);
                          }}
                        />
                      </div>
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 max-h-[300px] overflow-y-auto">
                  {loadingTemplates ? (
                    <DropdownMenuItem disabled className="text-xs">
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      {t('actions.loadingTemplates') || '加载中...'}
                    </DropdownMenuItem>
                  ) : templates.length === 0 ? (
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      {t('actions.noTemplates') || '暂无模板'}
                    </DropdownMenuItem>
                  ) : (
                    <>
                      {templates.map((template) => (
                        <DropdownMenuItem
                          key={template.uuid}
                          onClick={() => handleApplyTemplate(template)}
                          className="text-xs cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{template.name}</span>
                            {template.description && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {template.description}
                              </span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          {isTemplateEditMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdateTemplate}
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t('actions.updateTemplate')}
            </Button>
          )}
          {!isTemplateEditMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportDialogOpen(true)}
              className="h-8 text-xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {t('tabs.import')}
            </Button>
          )}
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex flex-1 overflow-hidden w-5/6 mx-auto">
        {/* 左侧：创建数量选择器 */}
        {!isEditMode && (
          <div className="shrink-0 pt-4 pr-4">
            <QuantitySelector value={createCount} onChange={setCreateCount} />
          </div>
        )}

        {/* 中间：表单区域 */}
        <ScrollArea ref={scrollContainerRef} className="flex-1">
          <div className="py-4 space-y-4 pb-24 pr-4">
            {/* 基本信息 */}
            <div
              ref={(el) => {
                sectionRefs.current['basic-info'] = el;
              }}
              id="basic-info"
            >
              <WindowInfoForm
                value={windowConfig.windowInfo}
                onChange={(value) => handleConfigUpdate('windowInfo', value)}
              />
            </div>

            {/* 网络与定位 */}
            <div
              ref={(el) => {
                sectionRefs.current['network-location'] = el;
              }}
              id="network-location"
            >
              <NetworkLocationForm
                basicSettings={windowConfig.basicSettings}
                advancedSettings={windowConfig.advancedFingerprintSettings}
                proxySourceMode={windowConfig.windowInfo.proxySourceMode}
                proxyUuids={windowConfig.windowInfo.proxyUuids}
                localProxyNodeNames={windowConfig.windowInfo.localProxyNodeNames}
                createCount={isEditMode ? 1 : createCount}
                onBasicSettingsChange={(value) => handleConfigUpdate('basicSettings', value)}
                onAdvancedSettingsChange={(value) =>
                  handleConfigUpdate('advancedFingerprintSettings', value)
                }
                onProxySelectionChange={(value) =>
                  handleConfigUpdate('windowInfo', {
                    ...windowConfig.windowInfo,
                    proxySourceMode: value.mode,
                    proxyUuids: value.remoteProxyUuids,
                    localProxyNodeNames: value.localProxyNodeNames,
                  })
                }
              />
            </div>

            {/* 指纹伪装 */}
            <div
              ref={(el) => {
                sectionRefs.current['fingerprint'] = el;
              }}
              id="fingerprint"
            >
              <FingerprintForm
                value={windowConfig.advancedFingerprintSettings}
                onChange={(value) => handleConfigUpdate('advancedFingerprintSettings', value)}
              />
            </div>

            {/* 屏幕与硬件 */}
            <div
              ref={(el) => {
                sectionRefs.current['screen-hardware'] = el;
              }}
              id="screen-hardware"
            >
              <ScreenHardwareForm
                advancedSettings={windowConfig.advancedFingerprintSettings}
                deviceSettings={windowConfig.deviceSettings}
                onAdvancedSettingsChange={(value) =>
                  handleConfigUpdate('advancedFingerprintSettings', value)
                }
                onDeviceSettingsChange={(value) => handleConfigUpdate('deviceSettings', value)}
              />
            </div>

            {/* 浏览器行为 */}
            <div
              ref={(el) => {
                sectionRefs.current['browser-behavior'] = el;
              }}
              id="browser-behavior"
            >
              <BrowserBehaviorForm
                basicSettings={windowConfig.basicSettings}
                deviceSettings={windowConfig.deviceSettings}
                advancedSettings={windowConfig.advancedFingerprintSettings}
                onBasicSettingsChange={(value) => handleConfigUpdate('basicSettings', value)}
                onDeviceSettingsChange={(value) => handleConfigUpdate('deviceSettings', value)}
                onAdvancedSettingsChange={(value) =>
                  handleConfigUpdate('advancedFingerprintSettings', value)
                }
              />
            </div>
          </div>
        </ScrollArea>

        {/* 右侧：概要区域 */}
        <div className="w-[420px] border-l border-border overflow-y-auto">
          <WindowSummary config={windowConfig} onRandomize={handleRandomizeFingerprint} />
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="absolute bottom-0 left-0 right-0 bg-background/10 border-t border-border py-3 z-10 backdrop-blur-2xl">
        <div className="w-5/6 mx-auto flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={() => setGroupDialogOpen(true)}>
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              {t('projectMetadata.group')}
            </Button>
            {selectedGroup && (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    className="h-7 w-7 flex items-center justify-center rounded-md border border-border hover:bg-muted transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent className="w-64">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-blue-500" />
                      <span className="font-semibold text-sm">{selectedGroup.name}</span>
                    </div>
                    {selectedGroup.description && (
                      <p className="text-xs text-muted-foreground">{selectedGroup.description}</p>
                    )}
                  </div>
                </HoverCardContent>
              </HoverCard>
            )}
            <Button variant="outline" size="sm" onClick={() => setTagsDialogOpen(true)}>
              <Tag className="h-3.5 w-3.5 mr-1.5" />
              {t('projectMetadata.tags')}
            </Button>
            {selectedTags.length > 0 && (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    className="h-7 w-7 flex items-center justify-center rounded-md border border-border hover:bg-muted transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4 text-purple-500" />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent className="w-64">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-purple-500" />
                      <span className="font-semibold text-sm">
                        {t('projectMetadata.tags')} ({selectedTags.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTags.map((tag) => (
                        <span
                          key={tag.uuid}
                          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border"
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full border ${getTagDotColorClasses(tag.color || 'slate')}`}
                          />
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            )}
          </div>
          {!isTemplateEditMode && (
            <Button onClick={handleCreateWindow} size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : isEditMode ? (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isEditMode
                ? t('actions.saveWindow') || '保存窗口'
                : createCount === 1
                  ? t('actions.createWindow')
                  : `${t('actions.createWindow')} (${createCount})`}
            </Button>
          )}
        </div>
      </div>

      {/* 导入对话框 */}
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      {/* 分组选择对话框 */}
      <CreateWindowSelectGroupDialog
        open={groupDialogOpen}
        selectedGroupUuid={selectedGroupUuid}
        onOpenChange={(open) => {
          setGroupDialogOpen(open);
          // 对话框关闭时重新加载分组列表（可能创建了新分组）
          if (!open) {
            listGroups()
              .then(setAllGroups)
              .catch(() => {
                // 忽略错误
              });
          }
        }}
        onConfirm={(groupUuid) => {
          setSelectedGroupUuid(groupUuid);
        }}
      />

      {/* 标签选择对话框 */}
      <CreateWindowSelectTagsDialog
        open={tagsDialogOpen}
        selectedTagUuids={selectedTagUuids}
        onOpenChange={(open) => {
          setTagsDialogOpen(open);
          // 对话框关闭时重新加载标签列表（可能创建了新标签）
          if (!open) {
            listTags()
              .then(setAllTags)
              .catch(() => {
                // 忽略错误
              });
          }
        }}
        onConfirm={(tagUuids) => {
          setSelectedTagUuids(tagUuids);
        }}
      />
    </div>
  );
}
