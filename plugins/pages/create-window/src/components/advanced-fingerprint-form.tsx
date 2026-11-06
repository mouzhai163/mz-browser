import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdvancedFingerprintSettings, ResolutionMode } from '../types';
import { generateWebGL, generateScreenResolution, getSystemScreenResolution, generateFontListConfig } from '../utils/fingerprint-generator';

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

interface AdvancedFingerprintFormProps {
  value: AdvancedFingerprintSettings;
  onChange: (value: AdvancedFingerprintSettings) => void;
}

export function AdvancedFingerprintForm({ value, onChange }: AdvancedFingerprintFormProps) {
  const { t } = useTranslation('create-window');

  const randomRealOptions = [
    { value: 'random' as const, label: t('advancedFingerprint.fingerprintMode.random') },
    { value: 'real' as const, label: t('advancedFingerprint.fingerprintMode.real') },
  ];

  const resolutionOptions = [
    { value: 'random' as const, label: t('advancedFingerprint.fingerprintMode.random') },
    { value: 'system' as const, label: t('advancedFingerprint.fingerprintMode.system') },
  ];

  const systemRandomOptions = [
    { value: 'system' as const, label: t('advancedFingerprint.fingerprintMode.system') },
    { value: 'random' as const, label: t('advancedFingerprint.fingerprintMode.random') },
  ];

  const webrtcOptions = [
    { value: 'replace' as const, label: t('advancedFingerprint.webrtcMode.replace') },
    { value: 'real' as const, label: t('advancedFingerprint.webrtcMode.real') },
    { value: 'disable' as const, label: t('advancedFingerprint.webrtcMode.disable') },
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

  // 处理分辨率模式切换
  const handleResolutionModeChange = (mode: ResolutionMode) => {
    const newResolution = mode === 'system'
      ? getSystemScreenResolution()
      : generateScreenResolution();
    onChange({ ...value, resolution: newResolution });
  };

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg">
      <h3 className="text-sm font-semibold">{t('advancedFingerprint.title')}</h3>

      {/* 分辨率 & 字体指纹 - 两列布局 */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.resolution')}</Label>
          <div className="flex items-center gap-1">
            <div className="h-8 px-2 flex items-center text-xs font-mono bg-muted rounded">
              <span>{value.resolution.width} × {value.resolution.height}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => handleResolutionModeChange('random')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.fontFingerprint')}</Label>
          <div className="flex items-center gap-1">
            <div className="h-8 px-2 flex items-center text-xs bg-muted rounded">
              <span>{t('advancedFingerprint.fingerprintMode.random')}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onChange({ ...value, fontFingerprint: 'random' })}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 字体列表 */}
      <div className="flex items-center justify-between gap-4">
        <Label className="text-xs shrink-0">{t('advancedFingerprint.fontList')}</Label>
        <div className="flex items-center gap-2">
          <div className="h-8 px-2 flex items-center text-xs bg-muted rounded">
            <span>
              {value.fontList.mode === 'system' && t('advancedFingerprint.fontListMode.system')}
              {value.fontList.mode === 'random' && t('advancedFingerprint.fontListMode.random')}
              {value.fontList.mode === 'ua-match' && t('advancedFingerprint.fontListMode.uaMatch')}
              {value.fontList.mode === 'custom' && t('advancedFingerprint.fontListMode.custom')}
              {value.fontList.fonts && ` (${value.fontList.fonts.length})`}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              const newFontList = generateFontListConfig('random', 'Windows');
              onChange({ ...value, fontList: newFontList });
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 屏幕深度 & 像素比 & 最大触摸点 */}
      <div className="grid grid-cols-3 gap-x-8 gap-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.colorDepth')}</Label>
          <SegmentedControl
            value={value.colorDepth.toString()}
            options={[
              { value: '24', label: '24bit' },
              { value: '32', label: '32bit' },
            ]}
            onChange={(v) => onChange({ ...value, colorDepth: parseInt(v) as 24 | 32 })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.devicePixelRatio')}</Label>
          <SegmentedControl
            value={value.devicePixelRatio.toString()}
            options={[
              { value: '1', label: '1.0' },
              { value: '1.5', label: '1.5' },
              { value: '2', label: '2.0' },
            ]}
            onChange={(v) => onChange({ ...value, devicePixelRatio: parseFloat(v) })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.maxTouchPoints')}</Label>
          <SegmentedControl
            value={value.maxTouchPoints.toString()}
            options={[
              { value: '0', label: '0' },
              { value: '5', label: '5' },
              { value: '10', label: '10' },
            ]}
            onChange={(v) => onChange({ ...value, maxTouchPoints: parseInt(v) })}
          />
        </div>
      </div>

      {/* WebRTC */}
      <div className="flex items-center justify-between gap-4">
        <Label className="text-xs shrink-0">{t('advancedFingerprint.webrtc')}</Label>
        <SegmentedControl
          value={value.webrtc}
          options={webrtcOptions}
          onChange={(v) => onChange({ ...value, webrtc: v })}
        />
      </div>

      {/* WebGL 图像 & WebGL Info - 两列布局 */}
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
              title={t('advancedFingerprint.refresh')}
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
              title={t('advancedFingerprint.refresh')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* WebGpu */}
      <div className="flex items-center justify-between gap-4">
        <Label className="text-xs shrink-0">{t('advancedFingerprint.webgpu')}</Label>
        <SegmentedControl
          value={value.webgpu}
          options={webgpuOptions}
          onChange={(v) => onChange({ ...value, webgpu: v })}
        />
      </div>

      {/* Canvas & AudioContext - 两列布局 */}
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

      {/* Speech Voices & Client Rects - 两列布局 */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.speechVoices')}</Label>
          <SegmentedControl
            value={value.speechVoices}
            options={randomRealOptions}
            onChange={(v) => onChange({ ...value, speechVoices: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.clientRects')}</Label>
          <SegmentedControl
            value={value.clientRects}
            options={randomRealOptions}
            onChange={(v) => onChange({ ...value, clientRects: v })}
          />
        </div>
      </div>

      {/* 媒体设备 & Do Not Track - Switch 风格 */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.mediaDevices')}</Label>
          <SegmentedControl
            value={value.mediaDevices}
            options={randomRealOptions}
            onChange={(v) => onChange({ ...value, mediaDevices: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('advancedFingerprint.doNotTrack')}</Label>
          <Switch
            checked={value.doNotTrack}
            onCheckedChange={(checked) => onChange({ ...value, doNotTrack: checked })}
          />
        </div>
      </div>
    </div>
  );
}
