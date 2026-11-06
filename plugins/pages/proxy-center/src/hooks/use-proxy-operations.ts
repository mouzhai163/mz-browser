import { useState } from 'react';
import { invoke } from '@/lib/tauri';
import { toast } from 'sonner';
import type { Proxy, ProxyFormData } from '../types';
import { createProxy, updateProxy, deleteProxy, batchDeleteProxies } from '../api';

interface UseProxyOperationsReturn {
  submitting: boolean;
  createProxyOp: (data: ProxyFormData) => Promise<void>;
  updateProxyOp: (uuid: string, data: ProxyFormData) => Promise<void>;
  deleteProxyOp: (uuid: string) => Promise<void>;
  batchDeleteProxiesOp: (uuids: string[]) => Promise<void>;
  testProxy: (proxy: Proxy) => Promise<Proxy | null>;
  batchTestProxies: (proxies: Proxy[]) => Promise<void>;
  testAllProxies: (proxies: Proxy[]) => Promise<void>;
}

/**
 * 代理操作逻辑 Hook
 */
export function useProxyOperations(onComplete?: () => void): UseProxyOperationsReturn {
  const [submitting, setSubmitting] = useState(false);

  const createProxyOp = async (data: ProxyFormData): Promise<void> => {
    setSubmitting(true);
    try {
      await createProxy({
        name: data.name,
        host: data.host,
        port: Number(data.port) || 8080,
        proxy_type: data.type,
        username: data.username || undefined,
        password: data.password || undefined,
        country: data.country || undefined,
        city: data.city || undefined,
      });
      onComplete?.();
    } finally {
      setSubmitting(false);
    }
  };

  const updateProxyOp = async (uuid: string, data: ProxyFormData): Promise<void> => {
    setSubmitting(true);
    try {
      await updateProxy({
        uuid,
        name: data.name,
        host: data.host,
        port: Number(data.port) || 8080,
        proxy_type: data.type,
        username: data.username || undefined,
        password: data.password || undefined,
        country: data.country || undefined,
        city: data.city || undefined,
      });
      onComplete?.();
    } finally {
      setSubmitting(false);
    }
  };

  const deleteProxyOp = async (uuid: string): Promise<void> => {
    await deleteProxy(uuid);
    onComplete?.();
  };

  const batchDeleteProxiesOp = async (uuids: string[]): Promise<void> => {
    await batchDeleteProxies(uuids);
    onComplete?.();
  };

  // 测试单个代理
  const testProxy = async (proxy: Proxy): Promise<Proxy | null> => {
    try {
      const result = await invoke<{
        success: boolean;
        ip_info?: { ip: string; country: string; country_code: string };
        latency_ms?: number;
        error?: string;
      }>('test_proxy', {
        config: {
          proxy_type: proxy.type,
          host: proxy.host,
          port: proxy.port,
          username: proxy.username || null,
          // 使用新的密码对象格式
          password: proxy.password
            ? { value: proxy.password, encrypted: false }
            : null,
        },
      });

      if (result.success && result.ip_info) {
        return {
          ...proxy,
          status: 'healthy',
          latency: result.latency_ms,
          country: result.ip_info.country || result.ip_info.country_code,
          countryCode: result.ip_info.country_code,
        };
      } else {
        return {
          ...proxy,
          status: 'unreachable',
          latency: undefined,
          country: proxy.country,
          countryCode: proxy.countryCode,
        };
      }
    } catch (e) {
      return {
        ...proxy,
        status: 'unreachable',
        latency: undefined,
        country: proxy.country,
        countryCode: proxy.countryCode,
      };
    }
  };

  // 批量测试代理
  const batchTestProxies = async (proxies: Proxy[]): Promise<void> => {
    if (proxies.length === 0) return;
    for (const proxy of proxies) {
      await testProxy(proxy);
    }
  };

  // 测试所有代理（与 batchTestProxies 相同）
  const testAllProxies = async (proxies: Proxy[]): Promise<void> => {
    await batchTestProxies(proxies);
  };

  return {
    submitting,
    createProxyOp,
    updateProxyOp,
    deleteProxyOp,
    batchDeleteProxiesOp,
    testProxy,
    batchTestProxies,
    testAllProxies,
  };
}
