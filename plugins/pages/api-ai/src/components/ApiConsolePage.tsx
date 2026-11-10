import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageTitle } from '@/components/page-title';
import { useMcpService } from '../hooks/useMcpService';
import { McpServicePanel } from './McpServicePanel';

export function ApiConsolePage() {
  const { t } = useTranslation('apiConsole');

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
          </div>
        </ScrollArea>
      </div>
    </main>
  );
}
