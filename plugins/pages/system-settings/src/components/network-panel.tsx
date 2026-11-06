import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Wifi, Cloud, CloudOff, RefreshCw, Globe, CloudUpload, Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SettingCard } from './setting-card';
import { SettingRow } from './setting-row';
import {
  getNetworkSettings,
  setNetworkSettings,
  SYNC_INTERVAL_OPTIONS,
} from '../../../../services/store/src';

/**
 * 网络与同步面板
 */
export const NetworkPanel: React.FC = () => {
  const { t } = useTranslation('settings');
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyAddress, setProxyAddress] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(30);
  const [networkSettingsLoaded, setNetworkSettingsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getNetworkSettings()
      .then((s) => {
        if (!cancelled) {
          setProxyEnabled(s.proxyEnabled);
          setProxyAddress(s.proxyAddress);
          setProxyPort(s.proxyPort);
          setAutoSync(s.autoSync);
          setSyncInterval(s.syncInterval);
          setNetworkSettingsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setNetworkSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleProxyEnabledChange = useCallback((checked: boolean) => {
    setProxyEnabled(checked);
    void setNetworkSettings({ proxyEnabled: checked });
  }, []);

  const handleProxyAddressChange = useCallback((value: string) => {
    setProxyAddress(value);
    void setNetworkSettings({ proxyAddress: value });
  }, []);

  const handleProxyPortChange = useCallback((value: string) => {
    setProxyPort(value);
    void setNetworkSettings({ proxyPort: value });
  }, []);

  const handleAutoSyncChange = useCallback((checked: boolean) => {
    setAutoSync(checked);
    void setNetworkSettings({ autoSync: checked });
  }, []);

  const handleSyncIntervalChange = useCallback((value: string) => {
    const num = Number(value);
    setSyncInterval(num);
    void setNetworkSettings({ syncInterval: num });
  }, []);

  return (
    <div className="space-y-6">
      {/* 网络设置 */}
      <SettingCard title={t('networkProxy')} icon={Wifi}>
        <SettingRow icon={Globe} title={t('enableProxy')} description={t('enableProxyDesc')}>
          <Switch
            checked={proxyEnabled}
            onCheckedChange={handleProxyEnabledChange}
            disabled={!networkSettingsLoaded}
          />
        </SettingRow>

        {proxyEnabled && (
          <div className="space-y-3 p-4 bg-accent/20 rounded-lg mx-2 my-2">
            <div>
              <label className="text-xs text-muted-foreground">{t('proxyAddress')}</label>
              <Input
                type="text"
                placeholder={t('proxyAddressPlaceholder')}
                value={proxyAddress}
                onChange={(e) => handleProxyAddressChange(e.target.value)}
                className="mt-1 h-9 text-sm"
                disabled={!networkSettingsLoaded}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('proxyPort')}</label>
              <Input
                type="text"
                placeholder={t('proxyPortPlaceholder')}
                value={proxyPort}
                onChange={(e) => handleProxyPortChange(e.target.value)}
                className="mt-1 h-9 text-sm"
                disabled={!networkSettingsLoaded}
              />
            </div>
          </div>
        )}

        {/* 连接状态 */}
        <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg mx-2 my-2">
          <div>
            <p className="text-sm font-medium text-foreground">{t('networkStatus')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('networkStatusDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs text-emerald-500 font-medium">{t('connected')}</span>
          </div>
        </div>
      </SettingCard>

      {/* 数据同步 */}
      <SettingCard title={t('dataSync')} icon={autoSync ? Cloud : CloudOff}>
        <SettingRow icon={CloudUpload} title={t('autoSync')} description={t('autoSyncDesc')}>
          <Switch
            checked={autoSync}
            onCheckedChange={handleAutoSyncChange}
            disabled={!networkSettingsLoaded}
          />
        </SettingRow>

        {autoSync && (
          <div className="flex items-center justify-between p-3 ml-7 bg-accent/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{t('syncInterval')}</span>
            </div>
            <Select
              value={String(syncInterval)}
              onValueChange={handleSyncIntervalChange}
              disabled={!networkSettingsLoaded}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_INTERVAL_OPTIONS.map((min) => (
                  <SelectItem key={min} value={String(min)}>
                    {min === 60 ? t('syncIntervalHour') : t('syncIntervalMinutes', { count: min })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 上次同步时间 */}
        <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg mx-2 my-2">
          <div>
            <p className="text-sm font-medium text-foreground">{t('lastSync')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">2026-01-14 12:30:00</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary rounded hover:bg-primary/10 transition-colors">
            <RefreshCw className="w-3 h-3" />
            {t('syncNow')}
          </button>
        </div>
      </SettingCard>
    </div>
  );
};
