import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getLocalApiConfig,
  getLocalApiRuntimeRunning,
  reloadLocalApiRuntime,
  resetLocalApiKey,
  startLocalApiRuntime,
  stopLocalApiRuntime,
  updateLocalApiConfig,
} from '../api';
import type { LocalApiConfig, UpdateLocalApiConfigRequest } from '../types';

export const useApiService = () => {
  const { t } = useTranslation('apiConsole');
  const [config, setConfig] = useState<LocalApiConfig | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextConfig, nextRunning] = await Promise.all([
        getLocalApiConfig(),
        getLocalApiRuntimeRunning(),
      ]);
      setConfig(nextConfig);
      setRunning(nextRunning);
    } catch (e) {
      console.error('[api-ai] Failed to fetch API service config:', e);
      setError(e instanceof Error ? e.message : t('errors.fetchConfig'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(
    async (updates: UpdateLocalApiConfigRequest, errorKey: string) => {
      if (!config) return;
      try {
        const nextConfig = await updateLocalApiConfig(updates);
        setConfig(nextConfig);
        await reloadLocalApiRuntime();
        const nextRunning = await getLocalApiRuntimeRunning();
        setRunning(nextRunning);
      } catch (e) {
        console.error('[api-ai] Failed to update API service config:', e);
        toast.error(e instanceof Error ? e.message : t(errorKey));
      }
    },
    [config, t]
  );

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!config) return;
      try {
        const nextConfig = await updateLocalApiConfig({ enabled });
        setConfig(nextConfig);

        if (enabled) {
          await startLocalApiRuntime();
        } else {
          await stopLocalApiRuntime();
        }

        const nextRunning = await getLocalApiRuntimeRunning();
        setRunning(nextRunning);
      } catch (e) {
        console.error('[api-ai] Failed to toggle API service runtime:', e);
        toast.error(e instanceof Error ? e.message : t('errors.updateStatus'));
        try {
          const nextRunning = await getLocalApiRuntimeRunning();
          setRunning(nextRunning);
        } catch (refreshError) {
          console.error('[api-ai] Failed to refresh API service runtime:', refreshError);
        }
      }
    },
    [config, t]
  );

  const resetApiKey = useCallback(async () => {
    setResetting(true);
    try {
      const result = await resetLocalApiKey();
      await reloadLocalApiRuntime();
      const nextRunning = await getLocalApiRuntimeRunning();
      setRunning(nextRunning);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              apiKey: result.apiKey,
            }
          : null
      );
    } catch (e) {
      console.error('[api-ai] Failed to reset API key:', e);
      toast.error(e instanceof Error ? e.message : t('errors.resetKey'));
    } finally {
      setResetting(false);
    }
  }, [t]);

  return {
    config,
    running,
    loading,
    error,
    resetting,
    fetchConfig,
    updateConfig,
    setEnabled,
    resetApiKey,
  };
};
