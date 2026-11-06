import { invoke } from '@/lib/tauri';
import type { ProxyItem } from '../api';
import type { ProxySummary } from '../types';

export interface MihomoLocalProxyRecord {
  id: string;
  controller: string;
  name: string;
  node_name: string;
  listener_name: string;
  listen_host: string;
  listen_port: number;
  listener_type: string;
  proxy_scheme: string;
  status: string;
  latency_ms: number | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentProxyCandidate extends ProxyItem {
  source: 'remote' | 'local';
  node_name?: string;
  listener_name?: string;
  country_code?: string;
  local_missing?: boolean;
}

export async function getLocalMihomoProxyRecords(): Promise<MihomoLocalProxyRecord[]> {
  return invoke<MihomoLocalProxyRecord[]>('get_local_mihomo_proxies');
}

export function mapLocalMihomoProxyToProxyCandidate(
  proxy: MihomoLocalProxyRecord
): EnvironmentProxyCandidate {
  return {
    id: 0,
    uuid: proxy.node_name,
    name: proxy.name,
    host: proxy.listen_host,
    port: proxy.listen_port,
    proxy_type: proxy.proxy_scheme,
    status: proxy.status,
    latency: proxy.latency_ms ?? undefined,
    environments_count: 0,
    country: proxy.country ?? undefined,
    country_code: proxy.country_code ?? undefined,
    city: proxy.city ?? undefined,
    remark: proxy.node_name,
    source: 'local',
    node_name: proxy.node_name,
    listener_name: proxy.listener_name,
  };
}

export function mapLocalMihomoProxyToProxySummary(proxy: MihomoLocalProxyRecord): ProxySummary {
  return {
    id: 0,
    uuid: proxy.node_name,
    name: proxy.name,
    host: proxy.listen_host,
    port: proxy.listen_port,
    proxy_type: proxy.proxy_scheme,
    country: proxy.country ?? undefined,
    country_code: proxy.country_code ?? undefined,
    city: proxy.city ?? undefined,
    status: proxy.status,
    latency: proxy.latency_ms ?? undefined,
    source: 'local',
    node_name: proxy.node_name,
    listener_name: proxy.listener_name,
  };
}

export function buildMissingLocalProxySummary(nodeName: string): ProxySummary {
  return {
    id: 0,
    uuid: nodeName,
    name: nodeName,
    host: '127.0.0.1',
    port: 0,
    proxy_type: 'http',
    status: 'unknown',
    source: 'local',
    node_name: nodeName,
    local_missing: true,
  };
}
