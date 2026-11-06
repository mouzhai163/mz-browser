import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { BasicSettings, MatchMode } from '../types';

interface BasicSettingsFormProps {
  value: BasicSettings;
  onChange: (value: BasicSettings) => void;
}

// 分段控制器组件
function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1 text-xs rounded-full transition-all duration-200',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function BasicSettingsForm({ value, onChange }: BasicSettingsFormProps) {
  const { t } = useTranslation('create-window');

  const matchModeOptions = [
    { value: 'ip' as MatchMode, label: t('basicSettings.matchMode.ip') },
    { value: 'custom' as MatchMode, label: t('basicSettings.matchMode.custom') },
  ];

  const geolocationPromptOptions = [
    { value: 'ask' as const, label: t('basicSettings.geolocationPromptOptions.ask') },
    { value: 'allow' as const, label: t('basicSettings.geolocationPromptOptions.allow') },
    { value: 'forbid' as const, label: t('basicSettings.geolocationPromptOptions.forbid') },
  ];

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg">
      <h3 className="text-sm font-semibold">{t('basicSettings.title')}</h3>

      {/* 语言设置 - 两列布局 */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.language')}</Label>
          <SegmentedControl
            value={value.language}
            options={matchModeOptions}
            onChange={(v) => onChange({ ...value, language: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.interfaceLanguage')}</Label>
          <SegmentedControl
            value={value.interfaceLanguage}
            options={matchModeOptions}
            onChange={(v) => onChange({ ...value, interfaceLanguage: v })}
          />
        </div>
      </div>

      {/* 时区和地理位置 - 两列布局 */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.timezone')}</Label>
          <SegmentedControl
            value={value.timezone}
            options={matchModeOptions}
            onChange={(v) => onChange({ ...value, timezone: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.geolocation')}</Label>
          <SegmentedControl
            value={value.geolocation}
            options={matchModeOptions}
            onChange={(v) => onChange({ ...value, geolocation: v })}
          />
        </div>
      </div>

      {/* 地理位置提示 */}
      <div className="flex items-center justify-between gap-4">
        <Label className="text-xs shrink-0">{t('basicSettings.geolocationPrompt')}</Label>
        <SegmentedControl
          value={value.geolocationPrompt}
          options={geolocationPromptOptions}
          onChange={(v) => onChange({ ...value, geolocationPrompt: v })}
        />
      </div>

      {/* 媒体设置 - Switch 开关 */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.sound')}</Label>
          <Switch
            checked={value.sound}
            onCheckedChange={(checked) => onChange({ ...value, sound: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.images')}</Label>
          <Switch
            checked={value.images}
            onCheckedChange={(checked) => onChange({ ...value, images: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.video')}</Label>
          <Switch
            checked={value.video}
            onCheckedChange={(checked) => onChange({ ...value, video: checked })}
          />
        </div>
      </div>
    </div>
  );
}
