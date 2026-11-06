import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Orbit, PencilLine, PlugZap, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getMihomoConnectionInfo, testAndAttachMihomo } from './api';
import { MihomoTextInput } from './mihomo-text-input';
import type { MihomoConnectionConfig, MihomoConnectionInfo, MihomoOverview, MihomoStatus } from './types';

interface MihomoConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: (status: MihomoStatus) => void;
  defaultMode?: 'view' | 'edit';
  overview?: MihomoOverview | null;
}

const defaultConfig: MihomoConnectionConfig = {
  controller: '127.0.0.1:9090',
  secret: '',
};

export function MihomoConnectDialog({
  open,
  onOpenChange,
  onConnected,
  defaultMode = 'edit',
  overview,
}: MihomoConnectDialogProps) {
  const { t } = useTranslation('proxy');
  const [config, setConfig] = useState<MihomoConnectionConfig>(defaultConfig);
  const [connectionInfo, setConnectionInfo] = useState<MihomoConnectionInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>(defaultMode);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setInitializing(false);
      setError(null);
      setMode(defaultMode);
      return;
    }

    let cancelled = false;

    const init = async () => {
      setInitializing(true);
      setError(null);
      try {
        const nextInfo = await getMihomoConnectionInfo();
        if (cancelled) {
          return;
        }

        setConnectionInfo(nextInfo);
        setConfig({
          controller: nextInfo.controller || defaultConfig.controller,
          secret: nextInfo.secret || '',
        });

        if (defaultMode === 'view' && nextInfo.attached) {
          setMode('view');
        } else {
          setMode('edit');
        }
      } catch (invokeError) {
        if (!cancelled) {
          setConnectionInfo(null);
          setConfig(defaultConfig);
          setMode('edit');
          setError(
            invokeError instanceof Error
              ? invokeError.message
              : t('mihomo.form.loadFailed', { defaultValue: '读取连接配置失败' })
          );
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [defaultMode, open, t]);

  const handleSubmit = async () => {
    if (!config.controller.trim()) {
      setError(t('mihomo.form.controllerRequired', { defaultValue: '请输入 Mihomo 控制地址' }));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const status = await testAndAttachMihomo({
        controller: config.controller.trim(),
        secret: config.secret.trim(),
      });
      setConnectionInfo({
        attached: true,
        controller: config.controller.trim(),
        secret: config.secret.trim(),
      });
      toast.success(
        t('mihomo.form.connectSuccess', { defaultValue: 'Mihomo 连接成功，正在进入 Mihomo 页面' })
      );
      onOpenChange(false);
      onConnected?.(status);
    } catch (invokeError) {
      const message =
        invokeError instanceof Error
          ? invokeError.message
          : t('mihomo.form.connectFailed', { defaultValue: 'Mihomo 连接失败' });
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader className="gap-1">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Orbit className="h-4 w-4 text-sky-500" />
            {t('mihomo.form.title', { defaultValue: '连接 Mihomo' })}
          </DialogTitle>
          <DialogDescription>
            {mode === 'view'
              ? t('mihomo.form.viewDescription', {
                  defaultValue: '查看当前 Mihomo 连接信息。点击编辑连接后可修改配置。',
                })
              : t('mihomo.form.description', {
                  defaultValue:
                    '填写 Mihomo external-controller 配置。测试通过后会直接进入 Mihomo 页面。',
                })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {initializing ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('mihomo.form.loading', { defaultValue: '正在读取连接信息...' })}
            </div>
          ) : mode === 'view' && connectionInfo?.attached ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  {t('mihomo.form.connectedTitle', { defaultValue: '当前已连接' })}
                </div>
                <p className="mt-1 leading-5">
                  {t('mihomo.form.connectedBody', {
                    defaultValue: '当前 Mihomo 已附着到本地会话，可直接读取订阅和节点。',
                  })}
                </p>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20">
                <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 px-4 py-4 text-sm">
                  <div className="text-muted-foreground">
                    {t('mihomo.form.controller', { defaultValue: '控制地址' })}
                  </div>
                  <div className="font-mono text-xs">{connectionInfo.controller || '-'}</div>
                  <div className="text-muted-foreground">
                    {t('mihomo.form.secret', { defaultValue: 'Secret（可选）' })}
                  </div>
                  <div>
                    {connectionInfo.secret
                      ? t('mihomo.form.secretConfigured', { defaultValue: '已配置' })
                      : t('mihomo.form.secretEmpty', { defaultValue: '未配置' })}
                  </div>
                  <div className="text-muted-foreground">
                    {t('mihomo.form.version', { defaultValue: '版本' })}
                  </div>
                  <div>{overview?.version || '-'}</div>
                  <div className="text-muted-foreground">
                    {t('mihomo.form.providers', { defaultValue: '订阅源' })}
                  </div>
                  <div>{overview ? overview.providers.length : '-'}</div>
                  <div className="text-muted-foreground">
                    {t('mihomo.form.nodes', { defaultValue: '节点数' })}
                  </div>
                  <div>{overview ? overview.nodes.length : '-'}</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <PlugZap className="h-3.5 w-3.5 text-sky-500" />
                  {t('mihomo.form.hintTitle', { defaultValue: '连接要求' })}
                </div>
                <p className="mt-1 leading-5">
                  {t('mihomo.form.hintBody', {
                    defaultValue:
                      '请先在本机 Clash/Mihomo 中开启 external-controller，并确认当前实例可被访问。',
                  })}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mihomo-controller" className="text-xs">
                  {t('mihomo.form.controller', { defaultValue: '控制地址' })}
                </Label>
                <MihomoTextInput
                  id="mihomo-controller"
                  value={config.controller}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, controller: event.target.value }))
                  }
                  placeholder="127.0.0.1:9090"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mihomo-secret" className="text-xs">
                  {t('mihomo.form.secret', { defaultValue: 'Secret（可选）' })}
                </Label>
                <Input
                  id="mihomo-secret"
                  type="password"
                  value={config.secret}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, secret: event.target.value }))
                  }
                  placeholder={t('mihomo.form.secretPlaceholder', {
                    defaultValue: '如果未设置鉴权，可留空',
                  })}
                  className="font-mono text-xs"
                />
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="h-3.5 w-3.5" />
                {t('mihomo.form.errorTitle', { defaultValue: '连接失败' })}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-all leading-5">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {mode === 'view' && connectionInfo?.attached ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('mihomo.form.close', { defaultValue: '关闭' })}
              </Button>
              <Button onClick={() => setMode('edit')}>
                <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                {t('mihomo.form.edit', { defaultValue: '编辑连接' })}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  if (connectionInfo?.attached) {
                    setMode('view');
                    setError(null);
                    return;
                  }
                  onOpenChange(false);
                }}
                disabled={submitting}
              >
                {connectionInfo?.attached
                  ? t('mihomo.form.backToView', { defaultValue: '返回查看' })
                  : t('mihomo.form.cancel', { defaultValue: '取消' })}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || initializing}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    {t('mihomo.form.submitting', { defaultValue: '测试中...' })}
                  </>
                ) : (
                  t('mihomo.form.submit', {
                    defaultValue: connectionInfo?.attached ? '测试并保存' : '测试并进入',
                  })
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
