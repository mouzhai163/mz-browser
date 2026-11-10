import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Fingerprint, Globe, History } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { SettingCard } from './setting-card';
import { SettingRow } from './setting-row';
import { fingerprintModes, type FingerprintMode } from '../config';
import { getBrowserSettings, setBrowserSettings } from '../../../../services/store/src';
import { listBrowserKernels, type BrowserKernelVersion } from '../../../create-window/src/api';

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

  useEffect(() => {
    let cancelled = false;
    void listBrowserKernels('windows')
      .then((groups) => {
        if (cancelled) return;
        const all = Object.values(groups).flat();
        all.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
        setKernels(all);
      })
      .catch(() => {
        if (!cancelled) setKernels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <SettingCard title={t('browserKernels', { defaultValue: '浏览器内核' })} icon={Cpu}>
        <div className="space-y-2" data-testid="settings-kernel-list">
          {kernels === null ? (
            <p className="p-3 text-xs text-muted-foreground">{t('kernelsLoading', { defaultValue: '加载中…' })}</p>
          ) : kernels.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">{t('kernelsEmpty', { defaultValue: '暂无可用内核' })}</p>
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
                    <div className="text-sm font-semibold text-foreground">{kernel.resource_name}</div>
                    <div className="text-xs text-muted-foreground">{kernel.version}</div>
                  </div>
                </div>
                <span
                  className={
                    kernel.installed
                      ? 'rounded border border-success/30 bg-success/10 px-1.5 text-xs leading-5 text-success'
                      : 'rounded border border-border bg-muted px-1.5 text-xs leading-5 text-muted-foreground'
                  }
                >
                  {kernel.installed
                    ? t('kernelInstalled', { defaultValue: '已安装' })
                    : t('kernelNotInstalled', { defaultValue: '首次使用时下载' })}
                </span>
              </div>
            ))
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
                    isActive
                      ? 'bg-primary/8'
                      : 'bg-accent/20 hover:bg-accent/50'
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
    </div>
  );
};
