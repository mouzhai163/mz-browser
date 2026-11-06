import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { NumberInput } from '@/components/number-input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { LocalApiConfig, UpdateLocalApiConfigRequest } from '../types';
import { ApiKeyDisplay } from './ApiKeyDisplay';

interface ApiServiceConfigProps {
  config: LocalApiConfig;
  onUpdate: (updates: UpdateLocalApiConfigRequest, errorKey: string) => void;
  onResetApiKey: () => void;
  resetting: boolean;
}

export function ApiServiceConfigForm({
  config,
  onUpdate,
  onResetApiKey,
  resetting,
}: ApiServiceConfigProps) {
  const { t } = useTranslation('apiConsole');
  const [portInput, setPortInput] = useState(String(config.port));
  const [corsOriginsText, setCorsOriginsText] = useState(config.corsOrigins.join('\n'));
  const [corsFocused, setCorsFocused] = useState(false);

  useEffect(() => {
    setPortInput(String(config.port));
  }, [config.port]);

  useEffect(() => {
    setCorsOriginsText(config.corsOrigins.join('\n'));
  }, [config.corsOrigins]);

  const commitPort = (value: string) => {
    if (!value) {
      setPortInput(String(config.port));
      return;
    }

    const port = Number.parseInt(value, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error(t('errors.invalidPortRange'));
      setPortInput(String(config.port));
      return;
    }

    if (port !== config.port) {
      onUpdate({ port }, 'errors.updatePort');
    }
  };

  return (
    <div className="bg-background border border-border p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">{t('service.config')}</h3>

      {/* 监听端口 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground block">{t('service.port')}</label>
        <NumberInput
          value={portInput}
          onChange={(e) => {
            setPortInput(e.target.value);
          }}
          onBlur={(e) => {
            commitPort(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="h-8 text-xs"
        />
      </div>

      {/* API密钥 */}
      <ApiKeyDisplay
        apiKey={config.apiKey}
        onCopy={() => {}}
        onReset={onResetApiKey}
        resetting={resetting}
      />

      {/* 远程访问 */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label className="text-xs font-medium text-foreground block mb-1">
            {t('service.remoteAccess')}
          </label>
          <p className="text-xs text-muted-foreground">{t('service.remoteAccessDesc')}</p>
        </div>
        <Switch
          checked={config.remoteAccess}
          onCheckedChange={(remoteAccess) =>
            onUpdate({ remoteAccess }, 'errors.updateRemoteAccess')
          }
          className="ml-4"
        />
      </div>

      {/* CORS允许来源 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground block">
          {t('service.corsOrigins')}
        </label>
        <Textarea
          value={corsOriginsText}
          onChange={(e) => {
            setCorsOriginsText(e.target.value);
          }}
          onFocus={() => {
            setCorsFocused(true);
          }}
          onBlur={() => {
            setCorsFocused(false);
            const corsOrigins = corsOriginsText
              .split(/[\n,]/)
              .map((origin) => origin.trim())
              .filter(Boolean);
            onUpdate({ corsOrigins }, 'errors.updateCors');
          }}
          wrap="soft"
          className="min-h-24 w-full resize-none field-sizing-fixed overflow-x-hidden whitespace-pre-wrap break-all text-xs placeholder:text-xs"
          placeholder={corsFocused ? t('service.corsOriginsPlaceholder') : ''}
        />
        <p className="text-xs text-muted-foreground">{t('service.corsOriginsDesc')}</p>
      </div>
    </div>
  );
}
