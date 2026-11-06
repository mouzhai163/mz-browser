import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { PreferenceSettings } from '../types';

interface PreferenceSettingsFormProps {
  value: PreferenceSettings;
  onChange: (value: PreferenceSettings) => void;
}

export function PreferenceSettingsForm({ value, onChange }: PreferenceSettingsFormProps) {
  const { t } = useTranslation('create-window');

  const toggleBoolean = (key: keyof PreferenceSettings) => {
    const current = value[key];
    if (typeof current === 'boolean') {
      onChange({ ...value, [key]: !current } as PreferenceSettings);
    }
  };

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg">
      <h3 className="text-sm font-semibold">{t('preferences.title')}</h3>

      {/* 同步相关选项 */}
      {(
        [
          'syncWindowName',
          'customBookmarks',
          'syncBookmarks',
          'syncHistory',
          'syncTabs',
          'syncCookies',
          'syncExtensions',
          'syncSavedPasswords',
          'syncIndexedDB',
          'syncLocalStorage',
        ] as const
      ).map((key) => (
        <div key={key} className="space-y-2">
          <Label className="text-xs">{t(`preferences.${key}`)}</Label>
          <div className="flex gap-2">
            <Button
              variant={value[key] ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => toggleBoolean(key)}
            >
              {t('basicSettings.onOff.on')}
            </Button>
            <Button
              variant={!value[key] ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => toggleBoolean(key)}
            >
              {t('basicSettings.onOff.off')}
            </Button>
          </div>
        </div>
      ))}

      {/* 启动前删除相关选项 */}
      {(
        [
          'deleteCacheBeforeLaunch',
          'deleteCookiesBeforeLaunch',
          'deleteLocalStorageBeforeLaunch',
        ] as const
      ).map((key) => (
        <div key={key} className="space-y-2">
          <Label className="text-xs">{t(`preferences.${key}`)}</Label>
          <div className="flex gap-2">
            <Button
              variant={value[key] ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => toggleBoolean(key)}
            >
              {t('basicSettings.onOff.on')}
            </Button>
            <Button
              variant={!value[key] ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => toggleBoolean(key)}
            >
              {t('basicSettings.onOff.off')}
            </Button>
          </div>
        </div>
      ))}

      {/* 启动浏览器时随机指纹、弹出保存密码提示 */}
      {(['randomFingerprintOnLaunch', 'showSavePasswordPrompt'] as const).map((key) => (
        <div key={key} className="space-y-2">
          <Label className="text-xs">{t(`preferences.${key}`)}</Label>
          <div className="flex gap-2">
            <Button
              variant={value[key] ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => toggleBoolean(key)}
            >
              {t('basicSettings.onOff.on')}
            </Button>
            <Button
              variant={!value[key] ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => toggleBoolean(key)}
            >
              {t('basicSettings.onOff.off')}
            </Button>
          </div>
        </div>
      ))}

      {/* 网络/IP相关停止打开选项 */}
      {(
        ['stopOpenIfNetworkUnavailable', 'stopOpenIfIpChanges', 'stopOpenIfCountryChanges'] as const
      ).map((key) => (
        <div key={key} className="space-y-2">
          <Label className="text-xs">{t(`preferences.${key}`)}</Label>
          <div className="flex gap-2">
            <Button
              variant={value[key] ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => toggleBoolean(key)}
            >
              {t('basicSettings.onOff.on')}
            </Button>
            <Button
              variant={!value[key] ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => toggleBoolean(key)}
            >
              {t('basicSettings.onOff.off')}
            </Button>
          </div>
        </div>
      ))}

      {/* 打开工作台、IP变化提醒、是否开启谷歌登录 */}
      {(['openWorkbench', 'ipChangeReminder', 'enableGoogleLogin'] as const).map((key) => (
        <div key={key} className="space-y-2">
          <Label className="text-xs">{t(`preferences.${key}`)}</Label>
          <div className="flex gap-2">
            <Button
              variant={value[key] === true ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => onChange({ ...value, [key]: true } as PreferenceSettings)}
            >
              {t('basicSettings.onOff.on')}
            </Button>
            <Button
              variant={value[key] === false ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => onChange({ ...value, [key]: false } as PreferenceSettings)}
            >
              {t('basicSettings.onOff.off')}
            </Button>
            <Button
              variant={value[key] === 'follow-software' ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => onChange({ ...value, [key]: 'follow-software' } as PreferenceSettings)}
            >
              {t('preferences.followSoftwareSettings')}
            </Button>
          </div>
        </div>
      ))}

      {/* 网址访问黑名单/白名单 */}
      {(['urlBlacklist', 'urlWhitelist'] as const).map((key) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={key} className="text-xs">
            {t(`preferences.${key}`)}
          </Label>
          <textarea
            id={key}
            value={value[key].join('\n')}
            onChange={(e) =>
              onChange({
                ...value,
                [key]: e.target.value.split('\n').filter((url) => url.trim()),
              } as PreferenceSettings)
            }
            className="w-full h-24 px-3 py-2 text-xs bg-background border border-border rounded resize-none"
            placeholder={t('preferences.urlListPlaceholder')}
          />
        </div>
      ))}
    </div>
  );
}
