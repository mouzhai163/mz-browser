import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TextareaInput } from '@/components/textarea-input';
import type { BasicSettings, DeviceSettings, AdvancedFingerprintSettings } from '../types';

interface BrowserBehaviorFormProps {
  basicSettings: BasicSettings;
  deviceSettings: DeviceSettings;
  advancedSettings: AdvancedFingerprintSettings;
  onBasicSettingsChange: (value: BasicSettings) => void;
  onDeviceSettingsChange: (value: DeviceSettings) => void;
  onAdvancedSettingsChange: (value: AdvancedFingerprintSettings) => void;
}

export function BrowserBehaviorForm({
  basicSettings,
  deviceSettings,
  advancedSettings,
  onBasicSettingsChange,
  onDeviceSettingsChange,
  onAdvancedSettingsChange,
}: BrowserBehaviorFormProps) {
  const { t } = useTranslation('create-window');

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg">
      <h3 className="text-sm font-semibold">{t('sections.browserBehavior')}</h3>

      {/* 媒体设置 */}
      <div className="grid grid-cols-3 gap-x-8 gap-y-3">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.sound')}</Label>
          <Switch
            checked={basicSettings.sound}
            onCheckedChange={(checked) =>
              onBasicSettingsChange({ ...basicSettings, sound: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.images')}</Label>
          <Switch
            checked={basicSettings.images}
            onCheckedChange={(checked) =>
              onBasicSettingsChange({ ...basicSettings, images: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.video')}</Label>
          <Switch
            checked={basicSettings.video}
            onCheckedChange={(checked) =>
              onBasicSettingsChange({ ...basicSettings, video: checked })
            }
          />
        </div>
      </div>

      {/* 安全与隐私设置 */}
      <div className="pt-2 border-t border-border space-y-3">
        <div className="grid grid-cols-2 gap-x-12 gap-y-3">
          <div className="flex items-center justify-between gap-4">
            <Label className="text-xs shrink-0">{t('advancedFingerprint.doNotTrack')}</Label>
            <Switch
              checked={advancedSettings.doNotTrack}
              onCheckedChange={(checked) =>
                onAdvancedSettingsChange({ ...advancedSettings, doNotTrack: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label className="text-xs shrink-0">{t('deviceSettings.sslFingerprint')}</Label>
            <Switch
              checked={deviceSettings.sslFingerprint}
              onCheckedChange={(checked) =>
                onDeviceSettingsChange({ ...deviceSettings, sslFingerprint: checked })
              }
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-3">
          <div className="flex items-center justify-between gap-4">
            <Label className="text-xs shrink-0">{t('deviceSettings.portScanProtection')}</Label>
            <Switch
              checked={deviceSettings.portScanProtection}
              onCheckedChange={(checked) =>
                onDeviceSettingsChange({ ...deviceSettings, portScanProtection: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label className="text-xs shrink-0">{t('deviceSettings.hardwareAcceleration')}</Label>
            <Switch
              checked={deviceSettings.hardwareAcceleration}
              onCheckedChange={(checked) =>
                onDeviceSettingsChange({ ...deviceSettings, hardwareAcceleration: checked })
              }
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('deviceSettings.disableSandbox')}</Label>
          <Switch
            checked={deviceSettings.disableSandbox}
            onCheckedChange={(checked) =>
              onDeviceSettingsChange({ ...deviceSettings, disableSandbox: checked })
            }
          />
        </div>
      </div>

      {/* 启动参数 */}
      <div className="pt-2 border-t border-border">
        <div className="space-y-1">
          <Label htmlFor="startup-parameters" className="text-xs">
            {t('deviceSettings.startupParameters')}
          </Label>
          <TextareaInput
            id="startup-parameters"
            value={deviceSettings.startupParameters}
            onChange={(e) =>
              onDeviceSettingsChange({ ...deviceSettings, startupParameters: e.target.value })
            }
            className="text-xs bg-muted border-0"
            placeholder={t('deviceSettings.startupParametersPlaceholder')}
          />
        </div>
      </div>
    </div>
  );
}
