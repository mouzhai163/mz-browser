import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getMcpAccessToken, listEnvironmentChoices, rotateMcpAccessToken } from '../api';
import type { EnvironmentChoice } from '../api';
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
  const [pagesOn, setPagesOn] = useState(config.pageToolsEnabled);
  const [actOn, setActOn] = useState(config.actToolsEnabled);
  const [manageOn, setManageOn] = useState(config.manageToolsEnabled);
  const [fullOn, setFullOn] = useState(config.fullPageAccessEnabled);
  const [choices, setChoices] = useState<EnvironmentChoice[] | null>(null);
  const [choicesError, setChoicesError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(config.allowedEnvironmentUuids));
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let alive = true;
    listEnvironmentChoices()
      .then((items) => alive && setChoices(items))
      .catch(() => alive && setChoicesError(true));
    return () => {
      alive = false;
    };
  }, []);

  const known = new Set((choices ?? []).map((choice) => choice.uuid));
  // authorized ids whose environment no longer exists stay visible so they can be removed
  const missing = choices ? [...selected].filter((id) => !known.has(id)) : [];
  const visible = (choices ?? []).filter((choice) =>
    `${choice.name} ${choice.uuid}`.toLowerCase().includes(filter.trim().toLowerCase())
  );
  const toggle = (uuid: string, on: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (on) next.add(uuid);
      else next.delete(uuid);
      return next;
    });

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
    void run(async () => {
      setToken(null);
      await onUpdate({
        allowedEnvironmentUuids: [...selected],
        pageToolsEnabled: pagesOn,
        actToolsEnabled: pagesOn && actOn,
        fullPageAccessEnabled: pagesOn && actOn && fullOn,
        manageToolsEnabled: manageOn,
        autoStart: data.get('autoStart') === 'on',
      });
    });
  };

  return (
    <form data-testid="mcp-access-form" onSubmit={save} className="space-y-4 border border-border bg-background p-4">
      <div>
        <h4 className="text-sm font-semibold">{t('mcp.accessTitle')}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{t('mcp.accessWarning')}</p>
      </div>
      <div className="space-y-2 text-xs" data-testid="mcp-env-picker">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{t('mcp.environments')}</span>
          <span className="text-muted-foreground">
            {t('mcp.environmentsSelected', { count: selected.size })}
          </span>
        </div>
        {choicesError && <p className="text-destructive">{t('mcp.environmentsLoadFailed')}</p>}
        {!choices && !choicesError && (
          <p className="text-muted-foreground">{t('mcp.environmentsLoading')}</p>
        )}
        {choices && choices.length === 0 && missing.length === 0 && (
          <p className="text-muted-foreground">{t('mcp.environmentsNone')}</p>
        )}
        {choices && (choices.length > 0 || missing.length > 0) && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {choices.length > 6 && (
                <input
                  type="search"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder={t('mcp.environmentsSearch')}
                  className="h-8 min-w-0 flex-1 border border-border bg-background px-2 text-xs"
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || visible.length === 0}
                onClick={() => setSelected((previous) => new Set([...previous, ...visible.map((c) => c.uuid)]))}
              >
                {t('mcp.environmentsSelectAll')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || selected.size === 0}
                onClick={() => setSelected(new Set())}
              >
                {t('mcp.environmentsClear')}
              </Button>
            </div>
            <ul className="max-h-48 space-y-1 overflow-auto border border-border p-2">
              {visible.map((choice) => (
                <li key={choice.uuid}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      data-testid={`mcp-env-${choice.uuid}`}
                      checked={selected.has(choice.uuid)}
                      disabled={busy}
                      onChange={(event) => toggle(choice.uuid, event.target.checked)}
                    />
                    <span className="truncate">{choice.name}</span>
                    <span className="text-muted-foreground">{choice.status}</span>
                  </label>
                </li>
              ))}
              {missing.map((uuid) => (
                <li key={uuid}>
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked
                      disabled={busy}
                      onChange={() => toggle(uuid, false)}
                    />
                    <span className="truncate">{t('mcp.environmentsMissing')}</span>
                    <span className="font-mono">{uuid.slice(0, 8)}</span>
                  </label>
                </li>
              ))}
              {visible.length === 0 && missing.length === 0 && (
                <li className="text-muted-foreground">{t('mcp.environmentsNoMatch')}</li>
              )}
            </ul>
          </>
        )}
      </div>
      <fieldset className="space-y-2 text-xs" disabled={busy}>
        <legend className="mb-1 font-semibold">{t('mcp.scopeTitle')}</legend>
        <p className="text-muted-foreground">{t('mcp.scopeBase')}</p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            data-testid="mcp-scope-pages"
            checked={pagesOn}
            onChange={(event) => {
              setPagesOn(event.target.checked);
              if (!event.target.checked) {
                setActOn(false);
                setFullOn(false);
              }
            }}
          />
          {t('mcp.readOnlyPages')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            data-testid="mcp-scope-act"
            checked={pagesOn && actOn}
            disabled={!pagesOn}
            onChange={(event) => {
              setActOn(event.target.checked);
              if (!event.target.checked) setFullOn(false);
            }}
          />
          {t('mcp.actPages')}
        </label>
        {pagesOn && actOn && <p className="text-destructive">{t('mcp.actWarning')}</p>}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            data-testid="mcp-scope-full"
            checked={pagesOn && actOn && fullOn}
            disabled={!pagesOn || !actOn}
            onChange={(event) => setFullOn(event.target.checked)}
          />
          {t('mcp.fullPageAccess')}
        </label>
        {pagesOn && actOn && fullOn && (
          <p className="text-destructive" data-testid="mcp-full-warning">
            {t('mcp.fullPageAccessWarning')}
          </p>
        )}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            data-testid="mcp-scope-manage"
            checked={manageOn}
            onChange={(event) => setManageOn(event.target.checked)}
          />
          {t('mcp.manage')}
        </label>
        {manageOn && <p className="text-destructive">{t('mcp.manageWarning')}</p>}
      </fieldset>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="autoStart"
          data-testid="mcp-auto-start"
          defaultChecked={config.autoStart}
          disabled={busy}
        />
        {t('mcp.autoStart')}
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
