import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getMcpAccessToken, rotateMcpAccessToken } from '../api';
import type { McpConfigSnapshot, UpdateMcpConfigRequest } from '../types';

interface Props {
  config: McpConfigSnapshot;
  onUpdate: (updates: UpdateMcpConfigRequest) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function McpAccessSettings({ config, onUpdate, onRefresh }: Props) {
  const { t } = useTranslation('apiConsole');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRotation, setConfirmRotation] = useState(false);

  useEffect(() => {
    if (!token) return;
    const hide = () => setToken(null);
    const timer = window.setTimeout(hide, 30000);
    window.addEventListener('blur', hide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('blur', hide);
    };
  }, [token]);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('errors.updateMcpStatus'));
    } finally {
      setBusy(false);
    }
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const lines = (name: string) =>
      String(data.get(name) ?? '')
        .split(/[,\n]/)
        .map((line) => line.trim())
        .filter(Boolean);
    void run(async () => {
      setToken(null);
      await onUpdate({
        allowedEnvironmentUuids: lines('environments'),
        allowedOrigins: lines('origins'),
        pageToolsEnabled: data.get('pages') === 'on',
      });
    });
  };

  return (
    <form data-testid="mcp-access-form" onSubmit={save} className="space-y-4 border border-border bg-background p-4">
      <div>
        <h4 className="text-sm font-semibold">{t('mcp.accessTitle')}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{t('mcp.accessWarning')}</p>
      </div>
      <label className="block space-y-2 text-xs">
        <span>{t('mcp.environments')}</span>
        <Textarea
          name="environments"
          defaultValue={config.allowedEnvironmentUuids.join('\n')}
          rows={3}
          disabled={busy}
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="pages"
          defaultChecked={config.pageToolsEnabled}
          disabled={busy}
        />
        {t('mcp.readOnlyPages')}
      </label>
      <label className="block space-y-2 text-xs">
        <span>{t('mcp.origins')}</span>
        <Textarea
          name="origins"
          defaultValue={config.allowedOrigins.join('\n')}
          rows={3}
          disabled={busy}
          placeholder="https://example.com"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {t('mcp.saveAccess')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            if (token) setToken(null);
            else
              void run(async () => {
                setToken(await getMcpAccessToken());
              });
          }}
        >
          {token ? t('service.hideKey') : t('service.showKey')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setConfirmRotation(!confirmRotation)}
        >
          {t('mcp.rotateToken')}
        </Button>
      </div>
      {token && (
        <p className="break-all rounded border border-border p-3 font-mono text-xs select-all">
          {token}
        </p>
      )}
      {confirmRotation && (
        <div className="space-y-2 text-xs text-destructive">
          <p>{t('mcp.rotateWarning')}</p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setToken(null);
                await rotateMcpAccessToken();
                setConfirmRotation(false);
                await onRefresh();
              })
            }
          >
            {t('confirm.confirm')}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
