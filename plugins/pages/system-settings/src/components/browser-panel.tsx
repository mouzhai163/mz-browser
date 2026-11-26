import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Fingerprint, Globe, History, Loader2, Network, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { SettingCard } from './setting-card';
import { SettingRow } from './setting-row';
import { fingerprintModes, type FingerprintMode } from '../config';
import { getBrowserSettings, setBrowserSettings } from '../../../../services/store/src';
import {
  downloadBrowserKernel,
  getKernelDownloadSettings,
  listBrowserKernels,
  uninstallBrowserKernel,
  updateBrowserKernel,
  updateKernelDownloadSettings,
  type BrowserKernelVersion,
  type KernelDownloadProxyMode,
  type KernelDownloadProxyProtocol,
} from '../../../create-window/src/api';

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return String(error);
}

function isKernelDownloadCancellation(error: unknown): boolean {
  const message = errorText(error);
  return (
    message.includes('080602') ||
    message.includes('内核下载已取消') ||
    message.toLowerCase().includes('kernel download cancelled')
  );
}

/**
 * 浏览器与自动化面板
 */
export const BrowserPanel: React.FC = () => {
  const { t } = useTranslation('settings');
  const [defaultFingerprintMode, setDefaultFingerprintMode] = useState<FingerprintMode>('random');
  const [cleanTempOnClose, setCleanTempOnClose] = useState(true);
  const [autoRestoreSession, setAutoRestoreSession] = useState(false);
  const [browserSettingsLoaded, setBrowserSettingsLoaded] = useState(false);
  const [kernels, setKernels] = useState<BrowserKernelVersion[] | null>(null);
  const [updatingKernels, setUpdatingKernels] = useState<Set<string>>(() => new Set());
  const [kernelPendingUninstall, setKernelPendingUninstall] = useState<BrowserKernelVersion | null>(
    null
  );
  const [uninstallingKernel, setUninstallingKernel] = useState(false);
  const [proxyMode, setProxyMode] = useState<KernelDownloadProxyMode>('system');
  const [proxyProtocol, setProxyProtocol] = useState<KernelDownloadProxyProtocol>('http');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('1080');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [proxyPasswordConfigured, setProxyPasswordConfigured] = useState(false);
  const [clearProxyPassword, setClearProxyPassword] = useState(false);
  const [proxySaving, setProxySaving] = useState(false);
  const [savedProxySettings, setSavedProxySettings] = useState<{
    proxyMode: KernelDownloadProxyMode;
    proxyType: KernelDownloadProxyProtocol;
    proxyHost: string;
    proxyPort: string;
    proxyUsername: string;
  } | null>(null);

  const loadKernels = useCallback(async () => {
    try {
      const groups = await listBrowserKernels('windows');
      const all = Object.values(groups).flat();
      all.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
      return all;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadKernels().then((all) => {
      if (!cancelled) setKernels(all);
    });
    return () => {
      cancelled = true;
    };
  }, [loadKernels]);

  useEffect(() => {
    let cancelled = false;
    void getKernelDownloadSettings()
      .then((settings) => {
        if (cancelled) return;
        setProxyMode(settings.proxyMode);
        setProxyProtocol(settings.proxyType);
        setProxyHost(settings.proxyHost);
        setProxyPort(settings.proxyPort);
        setProxyUsername(settings.proxyUsername);
        setProxyPasswordConfigured(settings.hasProxyPassword);
        setClearProxyPassword(false);
        setSavedProxySettings({
          proxyMode: settings.proxyMode,
          proxyType: settings.proxyType,
          proxyHost: settings.proxyHost,
          proxyPort: settings.proxyPort,
          proxyUsername: settings.proxyUsername,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveKernelProxy = useCallback(async () => {
    const port = Number(proxyPort);
    if (
      proxyMode === 'custom' &&
      (!proxyHost.trim() || !Number.isInteger(port) || port < 1 || port > 65535)
    ) {
      toast.error(t('kernelProxyInvalid'));
      return;
    }
    setProxySaving(true);
    try {
      const settings = await updateKernelDownloadSettings({
        proxyMode,
        proxyType: proxyProtocol,
        // 非自定义模式下隐藏输入框，但仍保留已填写的自定义代理，避免只是切换直连/系统就丢失配置。
        proxyHost: proxyHost.trim(),
        proxyPort: proxyMode === 'custom' ? String(port) : proxyPort.trim(),
        proxyUsername: proxyUsername.trim(),
        // 省略密码字段表示保留原密码；只有用户显式勾选清除时才提交空字符串。
        ...(proxyMode === 'custom'
          ? proxyPassword
            ? { proxyPassword }
            : clearProxyPassword
              ? { proxyPassword: '' }
              : {}
          : {}),
      });
      setProxyPassword('');
      setProxyPasswordConfigured(settings.hasProxyPassword);
      setClearProxyPassword(false);
      setSavedProxySettings({
        proxyMode: settings.proxyMode,
        proxyType: settings.proxyType,
        proxyHost: settings.proxyHost,
        proxyPort: settings.proxyPort,
        proxyUsername: settings.proxyUsername,
      });
      toast.success(t('kernelProxySaved'));
    } catch (error) {
      toast.error(t('kernelProxySaveFailed'), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setProxySaving(false);
    }
  }, [
    clearProxyPassword,
    proxyHost,
    proxyMode,
    proxyPassword,
    proxyPort,
    proxyProtocol,
    proxyUsername,
    t,
  ]);

  const handleDownloadKernel = useCallback(
    async (kernel: BrowserKernelVersion) => {
      setUpdatingKernels((current) => new Set(current).add(kernel.kernel_id));
      try {
        await downloadBrowserKernel(kernel.kernel_id);
        toast.success(t('kernelDownloaded', { name: kernel.resource_name }));
        setKernels(await loadKernels());
      } catch (error) {
        if (isKernelDownloadCancellation(error)) {
          toast(t('kernelDownloadCancelled', { name: kernel.resource_name }));
        } else {
          toast.error(t('kernelDownloadFailed', { name: kernel.resource_name }), {
            description: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        setUpdatingKernels((current) => {
          const next = new Set(current);
          next.delete(kernel.kernel_id);
          return next;
        });
      }
    },
    [loadKernels, t]
  );

  // 内核更新由用户手动触发：启动环境时不会自动更新，正在使用这个内核的环境要先关闭
  const handleUpdateKernel = useCallback(
    async (kernel: BrowserKernelVersion) => {
      setUpdatingKernels((current) => new Set(current).add(kernel.kernel_id));
      try {
        await updateBrowserKernel(kernel.kernel_id);
        toast.success(t('kernelUpdated', { name: kernel.resource_name }));
        setKernels(await loadKernels());
      } catch (error) {
        toast.error(t('kernelUpdateFailed', { name: kernel.resource_name }), {
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setUpdatingKernels((current) => {
          const next = new Set(current);
          next.delete(kernel.kernel_id);
          return next;
        });
      }
    },
    [loadKernels, t]
  );

  const handleConfirmUninstallKernel = useCallback(async () => {
    if (!kernelPendingUninstall) return;
    setUninstallingKernel(true);
    try {
      await uninstallBrowserKernel(kernelPendingUninstall.kernel_id);
      toast.success(t('kernelUninstalled', { name: kernelPendingUninstall.resource_name }));
      setKernels(await loadKernels());
      setKernelPendingUninstall(null);
    } catch (error) {
      toast.error(t('kernelUninstallFailed', { name: kernelPendingUninstall.resource_name }), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setUninstallingKernel(false);
    }
  }, [kernelPendingUninstall, loadKernels, t]);

  useEffect(() => {
    let cancelled = false;
    void getBrowserSettings()
      .then((s) => {
        if (!cancelled) {
          setDefaultFingerprintMode(s.defaultFingerprintMode);
          setCleanTempOnClose(s.cleanTempOnClose);
          setAutoRestoreSession(s.autoRestoreSession);
          setBrowserSettingsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setBrowserSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFingerprintModeChange = useCallback((mode: FingerprintMode) => {
    setDefaultFingerprintMode(mode);
    void setBrowserSettings({ defaultFingerprintMode: mode });
  }, []);

  const handleCleanTempOnCloseChange = useCallback((checked: boolean) => {
    setCleanTempOnClose(checked);
    void setBrowserSettings({ cleanTempOnClose: checked });
  }, []);

  const handleAutoRestoreSessionChange = useCallback((checked: boolean) => {
    setAutoRestoreSession(checked);
    void setBrowserSettings({ autoRestoreSession: checked });
  }, []);

  const getProxyModeLabel = (mode: KernelDownloadProxyMode) => {
    if (mode === 'direct') return t('kernelProxyDirect');
    if (mode === 'custom') return t('kernelProxyCustom');
    return t('kernelProxySystem');
  };

  const proxyDirty = savedProxySettings
    ? proxyMode !== savedProxySettings.proxyMode ||
      (proxyMode === 'custom' &&
        (proxyProtocol !== savedProxySettings.proxyType ||
          proxyHost.trim() !== savedProxySettings.proxyHost ||
          proxyPort.trim() !== savedProxySettings.proxyPort ||
          proxyUsername.trim() !== savedProxySettings.proxyUsername ||
          proxyPassword.length > 0 ||
          clearProxyPassword))
    : false;

  const getFingerprintLabel = (id: string) => {
    const labels: Record<string, string> = {
      random: t('fingerprintRandom'),
      custom: t('fingerprintCustom'),
      real: t('fingerprintReal'),
    };
    return labels[id] || id;
  };

  return (
    <div className="space-y-4">
      {/* 浏览器内核 */}
      <SettingCard title={t('browserKernels')} icon={Cpu}>
        <div className="space-y-2" data-testid="settings-kernel-list">
          {kernels === null ? (
            <p className="p-3 text-xs text-muted-foreground">{t('kernelsLoading')}</p>
          ) : kernels.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">{t('kernelsEmpty')}</p>
          ) : (
            kernels.map((kernel) => (
              <div
                key={kernel.kernel_id}
                className="flex items-center justify-between rounded-md border border-border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Cpu className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {kernel.resource_name}
                    </div>
                    <div className="text-xs text-muted-foreground">{kernel.version}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {kernel.installed && kernel.update_available ? (
                    <>
                      <span className="rounded border border-warning/30 bg-warning/10 px-1.5 text-xs leading-5 text-warning">
                        {t('kernelUpdateAvailable')}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        disabled={updatingKernels.has(kernel.kernel_id)}
                        onClick={() => void handleUpdateKernel(kernel)}
                      >
                        {updatingKernels.has(kernel.kernel_id)
                          ? t('kernelUpdating')
                          : t('kernelUpdate')}
                      </Button>
                    </>
                  ) : kernel.installed ? (
                    <span className="rounded border border-success/30 bg-success/10 px-1.5 text-xs leading-5 text-success">
                      {t('kernelInstalled')}
                    </span>
                  ) : (
                    <>
                      <span className="rounded border border-border bg-muted px-1.5 text-xs leading-5 text-muted-foreground">
                        {t('kernelNotInstalled')}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        disabled={updatingKernels.has(kernel.kernel_id)}
                        onClick={() => void handleDownloadKernel(kernel)}
                      >
                        {updatingKernels.has(kernel.kernel_id)
                          ? t('kernelDownloading')
                          : t('kernelDownload')}
                      </Button>
                    </>
                  )}
                  {kernel.installed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs text-destructive hover:text-destructive"
                      disabled={updatingKernels.has(kernel.kernel_id) || uninstallingKernel}
                      onClick={() => setKernelPendingUninstall(kernel)}
                    >
                      {t('kernelUninstall')}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 border-t border-border px-3 pt-3">
          <div className="mb-3 flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{t('kernelDownloadProxy')}</p>
              <p className="text-xs text-muted-foreground">{t('kernelDownloadProxyDesc')}</p>
            </div>
          </div>
          <div
            className={`grid grid-cols-1 gap-2 ${
              proxyMode === 'custom'
                ? 'md:grid-cols-[150px_110px_1fr_110px_auto]'
                : 'md:grid-cols-[150px_auto]'
            }`}
          >
            <Select
              value={proxyMode}
              onValueChange={(v) => setProxyMode(v as KernelDownloadProxyMode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t('kernelProxySystem')}</SelectItem>
                <SelectItem value="direct">{t('kernelProxyDirect')}</SelectItem>
                <SelectItem value="custom">{t('kernelProxyCustom')}</SelectItem>
              </SelectContent>
            </Select>
            {proxyMode === 'custom' && (
              <>
                <Select
                  value={proxyProtocol}
                  onValueChange={(v) => setProxyProtocol(v as KernelDownloadProxyProtocol)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                    <SelectItem value="socks5">SOCKS5</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={proxyHost}
                  onChange={(e) => setProxyHost(e.target.value)}
                  placeholder={t('kernelProxyHost')}
                />
                <Input
                  value={proxyPort}
                  onChange={(e) => setProxyPort(e.target.value)}
                  placeholder={t('kernelProxyPort')}
                  inputMode="numeric"
                />
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              disabled={proxySaving || !proxyDirty}
              onClick={() => void handleSaveKernelProxy()}
            >
              {proxySaving ? t('kernelProxySaving') : t('kernelProxySave')}
            </Button>
          </div>
          {savedProxySettings && (
            <p className={`mt-2 text-xs ${proxyDirty ? 'text-warning' : 'text-muted-foreground'}`}>
              {proxyDirty
                ? t('kernelProxyUnsaved', { mode: getProxyModeLabel(savedProxySettings.proxyMode) })
                : t('kernelProxyCurrent', {
                    mode: getProxyModeLabel(savedProxySettings.proxyMode),
                  })}
            </p>
          )}
          {proxyMode === 'custom' && (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <Input
                value={proxyUsername}
                onChange={(e) => setProxyUsername(e.target.value)}
                placeholder={t('kernelProxyUsername')}
              />
              <Input
                value={proxyPassword}
                onChange={(e) => {
                  setProxyPassword(e.target.value);
                  if (e.target.value) setClearProxyPassword(false);
                }}
                placeholder={
                  proxyPasswordConfigured ? t('kernelProxyPasswordKeep') : t('kernelProxyPassword')
                }
                type="password"
              />
              {proxyPasswordConfigured && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={clearProxyPassword}
                    onChange={(e) => setClearProxyPassword(e.target.checked)}
                  />
                  {t('kernelProxyPasswordClear')}
                </label>
              )}
            </div>
          )}
        </div>
      </SettingCard>

      {/* 浏览器环境 */}
      <SettingCard title={t('browserEnvironment')} icon={Fingerprint}>
        {/* 默认指纹模式 */}
        <div className="p-3">
          <p className="text-sm font-medium text-foreground mb-3">{t('defaultFingerprint')}</p>
          <div className="grid grid-cols-3 gap-3">
            {fingerprintModes.map((mode) => {
              const isActive = defaultFingerprintMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => handleFingerprintModeChange(mode.id)}
                  disabled={!browserSettingsLoaded}
                  className={`p-3 rounded-lg text-left transition-all ${
                    isActive ? 'bg-primary/8' : 'bg-accent/20 hover:bg-accent/50'
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}
                  >
                    {getFingerprintLabel(mode.id)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2 pt-2">
          <SettingRow
            icon={Globe}
            title={t('cleanTempOnClose')}
            description={t('cleanTempOnCloseDesc')}
          >
            <Switch
              checked={cleanTempOnClose}
              onCheckedChange={handleCleanTempOnCloseChange}
              disabled={!browserSettingsLoaded}
            />
          </SettingRow>
          <SettingRow
            icon={History}
            title={t('autoRestoreSession')}
            description={t('autoRestoreSessionDesc')}
          >
            <Switch
              checked={autoRestoreSession}
              onCheckedChange={handleAutoRestoreSessionChange}
              disabled={!browserSettingsLoaded}
            />
          </SettingRow>
        </div>
      </SettingCard>

      <FormattedDialog
        open={kernelPendingUninstall !== null}
        onOpenChange={(open) => {
          if (!open && !uninstallingKernel) setKernelPendingUninstall(null);
        }}
        minWidth="min-w-[440px]"
        header={{
          icon: Trash2,
          iconColor: 'text-destructive',
          title: t('kernelUninstallTitle'),
          description: t('kernelUninstallDescription', {
            name: kernelPendingUninstall?.resource_name ?? '',
          }),
          gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
          className: 'border-b border-destructive/20',
        }}
        contentPadding="p-5"
      >
        <p className="text-sm text-muted-foreground">{t('kernelUninstallWarning')}</p>
        <FormattedDialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setKernelPendingUninstall(null)}
            disabled={uninstallingKernel}
          >
            <X className="h-4 w-4 mr-1.5" />
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void handleConfirmUninstallKernel()}
            disabled={uninstallingKernel}
          >
            {uninstallingKernel ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                {t('kernelUninstalling')}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1.5" />
                {t('kernelUninstallConfirm')}
              </>
            )}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>
    </div>
  );
};
