import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Fingerprint, Globe, History } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { SettingCard } from './setting-card';
import { SettingRow } from './setting-row';
import { fingerprintModes, type FingerprintMode } from '../config';
import { getBrowserSettings, setBrowserSettings } from '../../../../services/store/src';

/**
 * 浏览器与自动化面板
 */
export const BrowserPanel: React.FC = () => {
  const { t } = useTranslation('settings');
  const [defaultFingerprintMode, setDefaultFingerprintMode] = useState<FingerprintMode>('random');
  const [cleanTempOnClose, setCleanTempOnClose] = useState(true);
  const [autoRestoreSession, setAutoRestoreSession] = useState(false);
  const [browserSettingsLoaded, setBrowserSettingsLoaded] = useState(false);

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

  const getFingerprintDesc = (id: string) => {
    const descs: Record<string, string> = {
      random: t('fingerprintRandomDesc'),
      custom: t('fingerprintCustomDesc'),
      real: t('fingerprintRealDesc'),
    };
    return descs[id] || '';
  };

  return (
    <div className="space-y-6">
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
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getFingerprintDesc(mode.id)}
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
