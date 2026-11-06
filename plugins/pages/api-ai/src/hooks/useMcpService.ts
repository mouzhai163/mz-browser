import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getMcpConfig, startMcpRuntime, stopMcpRuntime, updateMcpConfig } from '../api';
import type { McpConfigSnapshot, UpdateMcpConfigRequest } from '../types';

export const useMcpService = () => {
  const { t } = useTranslation('apiConsole');
  const [config, setConfig] = useState<McpConfigSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextConfig = await getMcpConfig();
      setConfig(nextConfig);
    } catch (e) {
      console.error('[api-ai] Failed to fetch MCP config:', e);
      setError(e instanceof Error ? e.message : t('errors.fetchMcpConfig'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(
    async (updates: UpdateMcpConfigRequest, errorKey: string) => {
      const restart = config?.running ?? false;
      try {
        const nextConfig = await updateMcpConfig(updates);
        setConfig(nextConfig);

        if (nextConfig.enabled && restart) {
          await startMcpRuntime();
          const refreshed = await getMcpConfig();
          setConfig(refreshed);
        }
      } catch (e) {
        console.error('[api-ai] Failed to update MCP config:', e);
        toast.error(e instanceof Error ? e.message : t(errorKey));
        throw e;
      }
    },
    [t, config?.running]
  );

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      try {
        const nextConfig = await updateMcpConfig({ enabled });
        setConfig(nextConfig);

        if (enabled) {
          await startMcpRuntime();
        } else {
          await stopMcpRuntime();
        }

        const refreshed = await getMcpConfig();
        setConfig(refreshed);
      } catch (e) {
        console.error('[api-ai] Failed to toggle MCP runtime:', e);
        toast.error(e instanceof Error ? e.message : t('errors.updateMcpStatus'));
      }
    },
    [t]
  );

  return {
    config,
    loading,
    error,
    fetchConfig,
    updateConfig,
    setEnabled,
  };
};
