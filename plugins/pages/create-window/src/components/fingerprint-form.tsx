import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdvancedFingerprintSettings } from '../types';
import { generateWebGL, generateFontListConfig } from '../utils/fingerprint-generator';

interface FingerprintFormProps {
  value: AdvancedFingerprintSettings;
  onChange: (value: AdvancedFingerprintSettings) => void;
}

// 生成关联的 WebGL vendor 和 renderer
// 注意：这两个值必须匹配，否则会被指纹检测工具识别为伪装
function generateRandomWebglPair(): { vendor: string; renderer: string } {
  return generateWebGL();
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
            'px-2.5 py-1 text-xs rounded-full transition-all duration-200',
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

export function FingerprintForm({ value, onChange }: FingerprintFormProps) {
  const { t } = useTranslation('create-window');

  const randomRealOptions = [
    { value: 'random' as const, label: t('advancedFingerprint.fingerprintMode.random') },
    { value: 'real' as const, label: t('advancedFingerprint.fingerprintMode.real') },
  ];

  const systemRandomOptions = [
    { value: 'system' as const, label: t('advancedFingerprint.fingerprintMode.system') },
    { value: 'random' as const, label: t('advancedFingerprint.fingerprintMode.random') },
  ];

  const webglInfoOptions = [
    { value: 'real' as const, label: t('advancedFingerprint.fingerprintMode.real') },
    { value: 'random' as const, label: t('advancedFingerprint.fingerprintMode.random') },
    { value: 'custom' as const, label: t('advancedFingerprint.fingerprintMode.custom') },
  ];

  const webgpuOptions = [
    { value: 'webgl-match' as const, label: t('advancedFingerprint.webgpuMode.webglMatch') },
    { value: 'real' as const, label: t('advancedFingerprint.webgpuMode.real') },
    { value: 'disable' as const, label: t('advancedFingerprint.webgpuMode.disable') },
  ];

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg">
      <h3 className="text-sm font-semibold">{t('sections.fingerprint')}</h3>

      {/* Canvas & AudioContext */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.canvas')}</Label>
          <SegmentedControl
            value={value.canvas}
            options={randomRealOptions}
            onChange={(v) => onChange({ ...value, canvas: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.audioContext')}</Label>
          <SegmentedControl
            value={value.audioContext}
            options={randomRealOptions}
            onChange={(v) => onChange({ ...value, audioContext: v })}
          />
        </div>
      </div>

      {/* 字体指纹 & 媒体设备 */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.fontFingerprint')}</Label>
          <SegmentedControl
            value={value.fontFingerprint}
            options={systemRandomOptions}
            onChange={(v) => onChange({ ...value, fontFingerprint: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.mediaDevices')}</Label>
          <SegmentedControl
            value={value.mediaDevices}
            options={randomRealOptions}
            onChange={(v) => onChange({ ...value, mediaDevices: v })}
          />
        </div>
      </div>

      {/* 字体列表 */}
      <div className="space-y-1">
        <Label className="text-xs">{t('advancedFingerprint.fontList')}</Label>
        <div className="flex items-center gap-1">
          <div className="flex-1 h-8 px-2 flex items-center text-xs font-mono bg-muted rounded overflow-hidden">
            <span className="truncate">
              {value.fontList.fonts && value.fontList.fonts.length > 0
                ? value.fontList.fonts.length <= 3
                  ? value.fontList.fonts.join(', ')
                  : `${value.fontList.fonts.slice(0, 3).join(', ')}... (+${value.fontList.fonts.length - 3})`
                : value.fontList.mode === 'system'
                ? t('advancedFingerprint.fontListMode.system')
                : t('advancedFingerprint.fontListMode.custom')}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              const newFontList = generateFontListConfig(
                value.fontList.mode === 'ua-match' ? 'ua-match' : 'random',
                'Windows',
                value.fontList.includeChinese === true,
              );
              onChange({ ...value, fontList: newFontList });
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 中文字体：只有两个选择，默认不包含 */}
      <div className="flex items-center justify-between gap-4" data-testid="chinese-fonts-option">
        <Label className="text-xs shrink-0">{t('advancedFingerprint.chineseFonts')}</Label>
        <SegmentedControl
          value={value.fontList.includeChinese === true ? 'yes' : 'no'}
          options={[
            { value: 'no' as const, label: t('advancedFingerprint.chineseFontsMode.no') },
            { value: 'yes' as const, label: t('advancedFingerprint.chineseFontsMode.yes') },
          ]}
          onChange={(v) =>
            onChange({
              ...value,
              fontList: generateFontListConfig('random', 'Windows', v === 'yes'),
            })
          }
        />
      </div>

      {/* Client Rects & Speech Voices */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.clientRects')}</Label>
          <SegmentedControl
            value={value.clientRects}
            options={randomRealOptions}
            onChange={(v) => onChange({ ...value, clientRects: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.speechVoices')}</Label>
          <SegmentedControl
            value={value.speechVoices}
            options={randomRealOptions}
            onChange={(v) => onChange({ ...value, speechVoices: v })}
          />
        </div>
      </div>

      {/* WebGL 分隔线 */}
      <div className="pt-2 border-t border-border space-y-4">
        {/* WebGL 图像 & WebGL Info */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label className="text-xs shrink-0">{t('advancedFingerprint.webglImage')}</Label>
            <SegmentedControl
              value={value.webglImage}
              options={randomRealOptions}
              onChange={(v) => onChange({ ...value, webglImage: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label className="text-xs shrink-0">{t('advancedFingerprint.webglInfo')}</Label>
            <SegmentedControl
              value={value.webglInfo}
              options={webglInfoOptions}
              onChange={(v) => onChange({ ...value, webglInfo: v })}
            />
          </div>
        </div>

        {/* WebGL 厂商 & 渲染器 */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-4">
          <div className="space-y-1">
            <Label className="text-xs">{t('advancedFingerprint.webglVendor')}</Label>
            <div className="flex items-center gap-1">
              <div className="flex-1 h-8 px-2 flex items-center text-xs font-mono bg-muted rounded overflow-hidden">
                <span className="truncate">{value.webglVendor}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  const pair = generateRandomWebglPair();
                  onChange({ ...value, webglVendor: pair.vendor, webglRenderer: pair.renderer });
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('advancedFingerprint.webglRenderer')}</Label>
            <div className="flex items-center gap-1">
              <div className="flex-1 h-8 px-2 flex items-center text-xs font-mono bg-muted rounded overflow-hidden">
                <span className="truncate">{value.webglRenderer}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  const pair = generateRandomWebglPair();
                  onChange({ ...value, webglVendor: pair.vendor, webglRenderer: pair.renderer });
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* WebGPU */}
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.webgpu')}</Label>
          <SegmentedControl
            value={value.webgpu}
            options={webgpuOptions}
            onChange={(v) => onChange({ ...value, webgpu: v })}
          />
        </div>
      </div>
    </div>
  );
}
