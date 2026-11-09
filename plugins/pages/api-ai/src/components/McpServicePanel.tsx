import { useMemo, useState } from 'react';
import { ExternalLink, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import type { McpConfigSnapshot, UpdateMcpConfigRequest } from '../types';
import { ApiServiceSkeleton } from './api-service-skeleton';
import { McpAccessSettings } from './McpAccessSettings';

interface McpServicePanelProps {
  config: McpConfigSnapshot | null;
  loading: boolean;
  error: string | null;
  onToggle: (enabled: boolean) => void;
  onUpdate: (updates: UpdateMcpConfigRequest) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function McpServicePanel({
  config,
  loading,
  error,
  onToggle,
  onUpdate,
  onRefresh,
}: McpServicePanelProps) {
  if (loading) {
    return <ApiServiceSkeleton />;
  }

  return (
    <div className="space-y-4">
      {config ? <McpServiceControl config={config} onToggle={onToggle} /> : null}

      {config && (
        <McpAccessSettings
          key={JSON.stringify([
            config.allowedEnvironmentUuids,
            config.pageToolsEnabled,
            config.fullPageAccessEnabled,
          ])}
          config={config}
          onUpdate={onUpdate}
          onRefresh={onRefresh}
        />
      )}

      {error ? (
        <div className="px-4 py-2 text-xs text-destructive border border-destructive/20 bg-destructive/10">
          {error}
        </div>
      ) : null}

      {config ? (
        <McpClientConfigContent key={`${config.endpoint}:${config.running}`} config={config} />
      ) : null}
    </div>
  );
}

function McpServiceControl({
  config,
  onToggle,
}: {
  config: McpConfigSnapshot;
  onToggle: (enabled: boolean) => void;
}) {
  const { t } = useTranslation('apiConsole');

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg border p-4 shadow-xs ${
        config.running ? 'border-success/30 bg-success/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            config.running ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-foreground">
              {config.running
                ? t('mcp.statusRunning', { defaultValue: 'MCP 服务运行中' })
                : t('mcp.control')}
            </h3>
            {config.running ? <span className="h-2 w-2 rounded-full bg-success" /> : null}
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{config.endpoint}</p>
        </div>
      </div>
      <Switch data-testid="mcp-service-toggle" checked={config.running} onCheckedChange={onToggle} className="ml-4" />
    </div>
  );
}

function McpClientConfigContent({ config }: { config: McpConfigSnapshot }) {
  const { t } = useTranslation('apiConsole');
  const [activeClient, setActiveClient] = useState<'vscode' | 'cursor' | 'claude' | 'codex'>(
    'vscode'
  );

  const clients = useMemo(
    () => ({
      vscode: {
        title: t('mcp.clients.vscode.title'),
        docsLabel: t('mcp.clients.vscode.docs'),
        docsUrl: 'https://code.visualstudio.com/docs/copilot/reference/mcp-configuration',
        hint: '.vscode/mcp.json',
        snippet: JSON.stringify(
          {
            servers: {
              mz: {
                type: 'http',
                url: config.endpoint,
                headers: { Authorization: 'Bearer <MCP_TOKEN>' },
              },
            },
          },
          null,
          2
        ),
      },
      cursor: {
        title: t('mcp.clients.cursor.title'),
        docsLabel: t('mcp.clients.cursor.docs'),
        docsUrl: 'https://docs.cursor.com/context/mcp',
        hint: '~/.cursor/mcp.json',
        snippet: JSON.stringify(
          {
            mcpServers: {
              mz: {
                url: config.endpoint,
                headers: { Authorization: 'Bearer <MCP_TOKEN>' },
              },
            },
          },
          null,
          2
        ),
      },
      claude: {
        title: t('mcp.clients.claude.title'),
        docsLabel: t('mcp.clients.claude.docs'),
        docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/mcp',
        hint: 'Claude Code CLI',
        snippet: `claude mcp add --transport http mz ${config.endpoint} --header "Authorization: Bearer $env:MZ_MCP_TOKEN"`,
      },
      codex: {
        title: t('mcp.clients.codex.title'),
        docsLabel: t('mcp.clients.codex.docs'),
        docsUrl: 'https://developers.openai.com/learn/docs-mcp',
        hint: '~/.codex/config.toml',
        snippet: `[mcp_servers.mz]
 url = "${config.endpoint}"
 bearer_token_env_var = "MZ_MCP_TOKEN"`,
      },
    }),
    [config.endpoint, t]
  );
  const selectedClient = clients[activeClient];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_1.45fr]">
      <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="mb-4">
          <h4 className="text-[15px] font-semibold text-foreground">{t('mcp.clientGrid')}</h4>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Object.entries(clients).map(([key, client]) => {
            const isActive = key === activeClient;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveClient(key as keyof typeof clients);
                }}
                className={`border p-3 h-24 text-center rounded-sm transition-colors ${
                  isActive
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-background hover:bg-muted/40'
                }`}
              >
                <div className="text-sm font-semibold text-foreground">{client.title}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-1">{selectedClient.title}</h4>
            </div>
            <a
              href={selectedClient.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
            >
              {selectedClient.docsLabel}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <pre className="bg-muted border border-border rounded p-3 text-[11px] leading-5 overflow-auto whitespace-pre-wrap break-all font-mono">
          {selectedClient.snippet}
        </pre>
      </div>
    </div>
  );
}
