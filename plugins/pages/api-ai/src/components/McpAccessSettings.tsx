import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, KeyRound, Lock, MousePointerClick, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getMcpAccessToken, listEnvironmentChoices, rotateMcpAccessToken } from '../api';
import type { EnvironmentChoice } from '../api';
import type { McpConfigSnapshot, UpdateMcpConfigRequest } from '../types';

interface Props {
  config: McpConfigSnapshot;
  onUpdate: (updates: UpdateMcpConfigRequest) => Promise<void>;
  onRefresh: () => Promise<void>;
}

function Card({ title, extra, children }: { title: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-[15px] font-semibold text-foreground">{title}</h4>
        {extra}
      </div>
      {children}
    </section>
  );
}

interface TierRowProps {
  icon: typeof Eye;
  tone: 'primary' | 'warning' | 'danger';
  title: string;
  desc: string;
  tag?: { text: string; tone: 'warning' | 'danger' | 'muted' };
  children: ReactNode;
  first?: boolean;
}

const toneBox: Record<TierRowProps['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
};

const tagTone: Record<NonNullable<TierRowProps['tag']>['tone'], string> = {
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  muted: 'border-border bg-muted text-muted-foreground',
};

function TierRow({ icon: Icon, tone, title, desc, tag, children, first }: TierRowProps) {
  return (
    <div className={cn('flex items-center gap-3 py-3.5', !first && 'border-t border-border')}>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', toneBox[tone])}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {tag ? (
            <span className={cn('rounded border px-1.5 text-xs leading-5', tagTone[tag.tone])}>{tag.text}</span>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
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

  const checkbox = 'h-4 w-4 accent-[var(--primary)] disabled:opacity-50';

  return (
    <form
      data-testid="mcp-access-form"
      onSubmit={save}
      className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="space-y-4">
        <Card title={t('mcp.tiersTitle', { defaultValue: 'AI 能做什么' })}>
          <fieldset disabled={busy}>
            <TierRow
              first
              icon={Lock}
              tone="primary"
              title={t('mcp.tiers.baseTitle', { defaultValue: '基础' })}
              desc={t('mcp.tiers.baseDesc')}
              tag={{ text: t('mcp.tiers.always'), tone: 'muted' }}
            >
              <input type="checkbox" checked disabled readOnly className={checkbox} />
            </TierRow>
            <TierRow
              icon={Eye}
              tone="primary"
              title={t('mcp.tiers.readTitle')}
              desc={t('mcp.tiers.read')}
            >
              <input
                type="checkbox"
                data-testid="mcp-scope-pages"
                className={checkbox}
                checked={pagesOn}
                onChange={(event) => {
                  setPagesOn(event.target.checked);
                  if (!event.target.checked) {
                    setActOn(false);
                    setFullOn(false);
                  }
                }}
              />
            </TierRow>
            <TierRow
              icon={MousePointerClick}
              tone="warning"
              title={t('mcp.tiers.actTitle')}
              desc={t('mcp.tiers.act')}
              tag={{ text: t('mcp.tiers.trust'), tone: 'warning' }}
            >
              <input
                type="checkbox"
                data-testid="mcp-scope-act"
                className={checkbox}
                checked={pagesOn && actOn}
                disabled={!pagesOn}
                onChange={(event) => {
                  setActOn(event.target.checked);
                  if (!event.target.checked) setFullOn(false);
                }}
              />
            </TierRow>
            {pagesOn && actOn && <p className="pb-2 text-xs text-destructive">{t('mcp.actWarning')}</p>}
            <TierRow
              icon={KeyRound}
              tone="danger"
              title={t('mcp.tiers.fullTitle')}
              desc={t('mcp.tiers.full')}
              tag={{ text: t('mcp.tiers.risk', { defaultValue: '高风险' }), tone: 'danger' }}
            >
              <input
                type="checkbox"
                data-testid="mcp-scope-full"
                className={checkbox}
                checked={pagesOn && actOn && fullOn}
                disabled={!pagesOn || !actOn}
                onChange={(event) => setFullOn(event.target.checked)}
              />
            </TierRow>
            {pagesOn && actOn && fullOn && (
              <p className="pb-2 text-xs text-destructive" data-testid="mcp-full-warning">
                {t('mcp.fullPageAccessWarning')}
              </p>
            )}
            <TierRow
              icon={SlidersHorizontal}
              tone="danger"
              title={t('mcp.tiers.manageTitle')}
              desc={t('mcp.tiers.manage')}
              tag={{ text: t('mcp.tiers.risk', { defaultValue: '高风险' }), tone: 'danger' }}
            >
              <input
                type="checkbox"
                data-testid="mcp-scope-manage"
                className={checkbox}
                checked={manageOn}
                onChange={(event) => setManageOn(event.target.checked)}
              />
            </TierRow>
            {manageOn && <p className="pb-1 text-xs text-destructive">{t('mcp.manageWarning')}</p>}
          </fieldset>
        </Card>

        <Card title={t('mcp.connectionTitle', { defaultValue: '访问令牌与启动' })}>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-foreground">{t('mcp.autoStart')}</span>
            <input
              type="checkbox"
              name="autoStart"
              data-testid="mcp-auto-start"
              className={checkbox}
              defaultChecked={config.autoStart}
              disabled={busy}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
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
            <p className="mt-3 break-all rounded border border-border bg-muted p-3 font-mono text-xs select-all">
              {token}
            </p>
          )}
          {confirmRotation && (
            <div className="mt-3 space-y-2 text-xs text-destructive">
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
            <p role="alert" className="mt-3 text-xs text-destructive">
              {error}
            </p>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card
          title={t('mcp.environmentsTitle')}
          extra={<span className="text-xs text-muted-foreground">{t('mcp.environmentsSelected', { count: selected.size })}</span>}
        >
          <div className="space-y-2 text-xs" data-testid="mcp-env-picker">
            {choicesError && <p className="text-destructive">{t('mcp.environmentsLoadFailed')}</p>}
            {!choices && !choicesError && <p className="text-muted-foreground">{t('mcp.environmentsLoading')}</p>}
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
                      className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
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
                <ul className="max-h-64 overflow-auto">
                  {visible.map((choice) => (
                    <li key={choice.uuid} className="border-t border-border first:border-t-0">
                      <label className="flex items-center gap-3 py-2.5">
                        <input
                          type="checkbox"
                          data-testid={`mcp-env-${choice.uuid}`}
                          className={checkbox}
                          checked={selected.has(choice.uuid)}
                          disabled={busy}
                          onChange={(event) => toggle(choice.uuid, event.target.checked)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">{choice.name}</span>
                          <span className="block text-xs text-muted-foreground">{choice.status}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                  {missing.map((uuid) => (
                    <li key={uuid} className="border-t border-border">
                      <label className="flex items-center gap-3 py-2.5 text-muted-foreground">
                        <input
                          type="checkbox"
                          className={checkbox}
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
                    <li className="py-2 text-muted-foreground">{t('mcp.environmentsNoMatch')}</li>
                  )}
                </ul>
              </>
            )}
          </div>
        </Card>

        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-xs text-warning">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <TriangleAlert className="h-4 w-4" />
            {t('mcp.safetyTitle', { defaultValue: '安全提示' })}
          </div>
          <p className="text-foreground/80">{t('mcp.accessWarning')}</p>
        </div>
      </div>
    </form>
  );
}
