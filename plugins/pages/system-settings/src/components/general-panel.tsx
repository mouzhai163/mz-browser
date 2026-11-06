import { useState, useMemo, useEffect } from 'react';
import {
  Palette,
  Languages,
  Power,
  Bell,
  Minimize2,
  Volume2,
  VolumeX,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Rocket,
  AppWindow,
  BellRing,
  CheckCircle,
  FileStack,
  Trash2,
  Pencil,
  Play,
  Loader2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri';
import { SettingCard } from './setting-card';
import { SettingRow } from './setting-row';
import { useCallback } from 'react';
import { themeOptions } from '../config';
import { listTemplates, deleteTemplate, type TemplateDto } from '../api/templates';
import {
  useSettingsDialogStore,
  getGeneralSettings,
  setGeneralSettings,
} from '../../../../services/store/src';
import type { ThemeMode, Locale } from '../../../../services/store/src';

/**
 * 通用设置面板（合并外观、语言、启动、通知设置）
 */
export const GeneralPanel: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { i18n, t } = useTranslation('settings');
  const { close: closeSettingsDialog } = useSettingsDialogStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [rememberWindowPosition, setRememberWindowPosition] = useState(true);
  const [desktopNotification, setDesktopNotification] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [taskCompleteNotify, setTaskCompleteNotify] = useState(true);
  const [generalSettingsLoaded, setGeneralSettingsLoaded] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    void getGeneralSettings()
      .then((s) => {
        if (!cancelled) {
          setSidebarCollapsed(s.defaultCollapseSidebar);
          setAutoStart(s.autoStart);
          setStartMinimized(s.startMinimized);
          setRememberWindowPosition(s.rememberWindowPosition);
          setDesktopNotification(s.desktopNotification);
          setSoundEnabled(s.soundEnabled);
          setTaskCompleteNotify(s.taskCompleteNotify);
          setGeneralSettingsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setGeneralSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void invoke<{ enabled: boolean }>('get_auto_start_state')
      .then((state) => {
        if (!cancelled) {
          setAutoStart(state.enabled);
          void setGeneralSettings({ autoStart: state.enabled });
        }
      })
      .catch(() => {
        // 保持 store 中的值作为回退，不阻塞页面使用
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleThemeChange = useCallback(
    (v: string) => {
      const next = v as ThemeMode;
      setTheme(next);
      void setGeneralSettings({ theme: next });
    },
    [setTheme]
  );

  const handleLanguageChange = useCallback(
    (lng: string) => {
      const next = lng as Locale;
      void i18n.changeLanguage(next);
      localStorage.setItem('simprint-ui-locale', next);
      void setGeneralSettings({ language: next });
    },
    [i18n]
  );

  const handleSidebarCollapsedChange = useCallback((checked: boolean) => {
    setSidebarCollapsed(checked);
    void setGeneralSettings({ defaultCollapseSidebar: checked });
  }, []);

  const handleAutoStartChange = useCallback((checked: boolean) => {
    const previous = autoStart;
    setAutoStart(checked);

    void invoke<{ enabled: boolean }>('set_auto_start_enabled', { enabled: checked })
      .then((state) => {
        setAutoStart(state.enabled);
        return setGeneralSettings({ autoStart: state.enabled });
      })
      .catch((error) => {
        setAutoStart(previous);
        toast.error(error instanceof Error ? error.message : '设置开机自动启动失败');
      });
  }, [autoStart]);

  const handleStartMinimizedChange = useCallback((checked: boolean) => {
    setStartMinimized(checked);
    void setGeneralSettings({ startMinimized: checked });
  }, []);

  const handleRememberWindowPositionChange = useCallback((checked: boolean) => {
    setRememberWindowPosition(checked);
    void setGeneralSettings({ rememberWindowPosition: checked });
  }, []);

  const handleDesktopNotificationChange = useCallback((checked: boolean) => {
    setDesktopNotification(checked);
    void setGeneralSettings({ desktopNotification: checked });
  }, []);

  const handleSoundEnabledChange = useCallback((checked: boolean) => {
    setSoundEnabled(checked);
    void setGeneralSettings({ soundEnabled: checked });
  }, []);

  const handleTaskCompleteNotifyChange = useCallback((checked: boolean) => {
    setTaskCompleteNotify(checked);
    void setGeneralSettings({ taskCompleteNotify: checked });
  }, []);

  // 模板管理
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [deletingTemplateUuid, setDeletingTemplateUuid] = useState<string | null>(null);

  // 加载模板列表
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const response = await listTemplates({
          pagination: { page: 1, page_size: 100 },
        });
        setTemplates(response.items);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t('loadTemplatesFailed') || '加载模板列表失败'
        );
      } finally {
        setLoadingTemplates(false);
      }
    };
    void fetchTemplates();
  }, [t]);

  // 删除模板
  const handleDeleteTemplate = async (uuid: string) => {
    if (!confirm(t('confirmDeleteTemplate') || '确定要删除此模板吗？')) return;

    setDeletingTemplateUuid(uuid);
    try {
      await deleteTemplate(uuid);
      setTemplates((prev) => prev.filter((tpl) => tpl.uuid !== uuid));
      toast.success(t('deleteTemplateSuccess') || '模板已删除');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('deleteTemplateFailed') || '删除模板失败'
      );
    } finally {
      setDeletingTemplateUuid(null);
    }
  };

  // 应用模板（跳转到创建环境页面，使用模板数据初始化表单）
  const handleApplyTemplate = (uuid: string) => {
    // 关闭设置弹窗
    closeSettingsDialog();
    // 跳转到创建环境页面，并传递模板 UUID 用于初始化表单
    navigate(`/create-window?fromTemplate=${uuid}`);
  };

  // 编辑模板（跳转到创建窗口页面）
  const handleEditTemplate = (uuid: string) => {
    // 关闭设置弹窗
    closeSettingsDialog();
    // 跳转到创建窗口页面，并传递模板 UUID 用于加载
    navigate(`/create-window?template=${uuid}`);
  };

  const language = useMemo(() => i18n.language, [i18n.language]);

  return (
    <div className="space-y-6">
      {/* 外观设置 */}
      <SettingCard title={t('appearance')} icon={Palette}>
        {/* 主题 */}
        <SettingRow icon={Sun} title={t('themeMode')} description={t('themeModeDesc')}>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const labelKey: Record<string, string> = {
                  light: t('themeLight'),
                  dark: t('themeDark'),
                  system: t('themeSystem'),
                };
                return (
                  <SelectItem key={option.id} value={option.id}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{labelKey[option.id] || option.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </SettingRow>

        {/* 语言 */}
        <SettingRow icon={Languages} title={t('language')} description={t('languageDesc')}>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh-CN">{t('chinese')}</SelectItem>
              <SelectItem value="en-US">{t('english')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        {/* 导航栏折叠 */}
        <SettingRow
          icon={sidebarCollapsed ? PanelLeftClose : PanelLeft}
          title={t('defaultCollapseSidebar')}
          description={t('defaultCollapseSidebarDesc')}
        >
          <Switch
            checked={sidebarCollapsed}
            onCheckedChange={handleSidebarCollapsedChange}
            disabled={!generalSettingsLoaded}
          />
        </SettingRow>
      </SettingCard>

      {/* 启动设置 */}
      <SettingCard title={t('startup')} icon={Power}>
        <SettingRow icon={Rocket} title={t('autoStart')} description={t('autoStartDesc')}>
          <Switch
            checked={autoStart}
            onCheckedChange={handleAutoStartChange}
            disabled={!generalSettingsLoaded}
          />
        </SettingRow>
        <SettingRow
          icon={Minimize2}
          title={t('startMinimized')}
          description={t('startMinimizedDesc')}
        >
          <Switch
            checked={startMinimized}
            onCheckedChange={handleStartMinimizedChange}
            disabled={!generalSettingsLoaded}
          />
        </SettingRow>
        <SettingRow
          icon={AppWindow}
          title={t('rememberWindowPosition')}
          description={t('rememberWindowPositionDesc')}
        >
          <Switch
            checked={rememberWindowPosition}
            onCheckedChange={handleRememberWindowPositionChange}
            disabled={!generalSettingsLoaded}
          />
        </SettingRow>
      </SettingCard>

      {/* 通知设置 */}
      <SettingCard title={t('notification')} icon={Bell}>
        <SettingRow
          icon={BellRing}
          title={t('desktopNotification')}
          description={t('desktopNotificationDesc')}
        >
          <Switch
            checked={desktopNotification}
            onCheckedChange={handleDesktopNotificationChange}
            disabled={!generalSettingsLoaded}
          />
        </SettingRow>
        <SettingRow
          icon={soundEnabled ? Volume2 : VolumeX}
          title={t('soundAlert')}
          description={t('soundAlertDesc')}
        >
          <Switch
            checked={soundEnabled}
            onCheckedChange={handleSoundEnabledChange}
            disabled={!generalSettingsLoaded}
          />
        </SettingRow>
        <SettingRow
          icon={CheckCircle}
          title={t('taskCompleteNotify')}
          description={t('taskCompleteNotifyDesc')}
        >
          <Switch
            checked={taskCompleteNotify}
            onCheckedChange={handleTaskCompleteNotifyChange}
            disabled={!generalSettingsLoaded}
          />
        </SettingRow>
      </SettingCard>

      {/* 模板管理 */}
      <SettingCard title={t('templates')} icon={FileStack}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">{t('templateList')}</h4>
              <p className="text-xs text-muted-foreground">{t('templateListDesc')}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {t('templateCount', { count: templates.length })}
            </span>
          </div>

          {loadingTemplates ? (
            <div className="text-sm text-muted-foreground py-4 text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('loading') || '加载中...'}</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
              {t('noTemplates')}
            </div>
          ) : (
            <div className="border border-border rounded-md divide-y divide-border">
              {templates.map((template) => (
                <div
                  key={template.uuid}
                  className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium truncate">{template.name}</div>
                      {template.is_public && (
                        <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                          {t('public') || '公开'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {template.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {template.description}
                        </div>
                      )}
                      {(template.system_info || template.kernel_info) && (
                        <div className="text-xs text-muted-foreground">
                          {[template.system_info, template.kernel_info].filter(Boolean).join(' / ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        {t('createdAt') || '创建时间'}:{' '}
                        {new Date(template.created_at).toLocaleString()}
                      </span>
                      {template.usage_count !== undefined && template.usage_count > 0 && (
                        <span>
                          {t('usageCount') || '使用次数'}: {template.usage_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={t('applyTemplate') || '应用模板'}
                      onClick={() => handleApplyTemplate(template.uuid)}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={t('editTemplate') || '编辑模板'}
                      onClick={() => handleEditTemplate(template.uuid)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title={t('deleteTemplate') || '删除模板'}
                      onClick={() => handleDeleteTemplate(template.uuid)}
                      disabled={deletingTemplateUuid === template.uuid}
                    >
                      {deletingTemplateUuid === template.uuid ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingCard>
    </div>
  );
};
