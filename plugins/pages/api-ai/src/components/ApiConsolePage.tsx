import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageTitle } from '@/components/page-title';
import { useApiService } from '../hooks/useApiService';
import { useMcpService } from '../hooks/useMcpService';
import { ApiServiceConfigForm } from './ApiServiceConfig';
import { ApiServiceControl } from './ApiServiceControl';
import { ApiServiceSkeleton } from './api-service-skeleton';
import { McpServicePanel } from './McpServicePanel';

export function ApiConsolePage() {
  const { t } = useTranslation('apiConsole');

  const { config, running, loading, error, resetting, updateConfig, setEnabled, resetApiKey } =
    useApiService();
  const {
    config: mcpConfig,
    loading: mcpLoading,
    error: mcpError,
    setEnabled: setMcpEnabled,
    updateConfig: updateMcpConfig,
    fetchConfig: refreshMcpConfig,
  } = useMcpService();

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full w-full">
          <div className="mx-auto max-w-6xl space-y-4 px-6 pb-8 pt-5">
            <PageTitle title={t('header.title', { defaultValue: 'AI 与接口' })} />

            <McpServicePanel
              config={mcpConfig}
              loading={mcpLoading}
              error={mcpError}
              onToggle={setMcpEnabled}
              onUpdate={(updates) => updateMcpConfig(updates, 'errors.updateMcpStatus')}
              onRefresh={refreshMcpConfig}
            />

            {/* 旧版本地 HTTP 接口：保留但默认折叠，后续由 MCP 取代 */}
            <details className="group rounded-lg border border-border bg-card shadow-xs">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-foreground">
                    {t('legacy.title', { defaultValue: '本地 HTTP 接口（旧版）' })}
                  </span>
                  {config ? (
                    <span
                      className={
                        running
                          ? 'rounded border border-success/30 bg-success/10 px-1.5 text-xs leading-5 text-success'
                          : 'rounded border border-border bg-muted px-1.5 text-xs leading-5 text-muted-foreground'
                      }
                    >
                      {running
                        ? t('legacy.running', { defaultValue: '运行中 · 端口 {{port}}', port: config.port })
                        : t('legacy.stopped', { defaultValue: '未启动' })}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground group-open:hidden">
                  {t('legacy.expand', { defaultValue: '展开' })}
                </span>
              </summary>
              <div className="border-t border-border p-5">
                {loading ? (
                  <ApiServiceSkeleton />
                ) : error ? (
                  <div className="rounded border border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
                    {error}
                  </div>
                ) : config ? (
                  <>
                    <ApiServiceControl running={running} onToggle={setEnabled} />
                    <div className="mt-4">
                      <ApiServiceConfigForm
                        config={config}
                        onUpdate={updateConfig}
                        onResetApiKey={resetApiKey}
                        resetting={resetting}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </details>
          </div>
        </ScrollArea>
      </div>
    </main>
  );
}
