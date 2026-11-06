import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApiService } from '../hooks/useApiService';
import { useMcpService } from '../hooks/useMcpService';
import { ApiInfoCards } from './ApiInfoCards';
import { ApiServiceConfigForm } from './ApiServiceConfig';
import { ApiServiceControl } from './ApiServiceControl';
import { ApiServiceHeader } from './ApiServiceHeader';
import { ApiServiceStatusBar } from './ApiServiceStatusBar';
import { ApiServiceSkeleton } from './api-service-skeleton';
import { McpServicePanel } from './McpServicePanel';
import { ServiceTimelineEnd, ServiceTimelineStart } from './ServiceControlDecoration';

export function ApiConsolePage() {
  useTranslation('apiConsole');

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
    <main className="flex-1 flex flex-col min-w-0 h-full">
      <ApiServiceHeader />

      {config && <ApiServiceStatusBar config={config} running={running} />}

      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full w-full">
          <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-16">
              <section className="scroll-mt-4 relative">
                <ServiceTimelineStart />
                {loading ? (
                  <ApiServiceSkeleton />
                ) : error ? (
                  <div className="px-4 py-2 text-xs text-destructive border border-destructive/20 bg-destructive/10">
                    {error}
                  </div>
                ) : config ? (
                  <>
                    <ApiServiceControl running={running} onToggle={setEnabled} />

                    <div className="grid grid-cols-[2fr_1fr] gap-4">
                      <ApiServiceConfigForm
                        config={config}
                        onUpdate={updateConfig}
                        onResetApiKey={resetApiKey}
                        resetting={resetting}
                      />
                      <ApiInfoCards />
                    </div>
                  </>
                ) : null}
              </section>

              <section className="scroll-mt-4 relative">
                <ServiceTimelineEnd />
                <McpServicePanel
                  config={mcpConfig}
                  loading={mcpLoading}
                  error={mcpError}
                  onToggle={setMcpEnabled}
                  onUpdate={(updates) => updateMcpConfig(updates, 'errors.updateMcpStatus')}
                  onRefresh={refreshMcpConfig}
                />
              </section>
            </div>
          </div>
        </ScrollArea>
      </div>
    </main>
  );
}
