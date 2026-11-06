import { invoke } from '@/lib/tauri';
import type {
  ApplyMihomoNodeSelectionRequest,
  MihomoConnectionConfig,
  MihomoConnectionInfo,
  MihomoLocalProxy,
  MihomoNodeSelectionSnapshot,
  MihomoOverview,
  MihomoProxyDelayResult,
  MihomoStatus,
  UpdateMihomoLocalProxyRequest,
} from './types';

export function testAndAttachMihomo(config: MihomoConnectionConfig): Promise<MihomoStatus> {
  return invoke<MihomoStatus>('test_and_attach_mihomo', { config });
}

export function getMihomoStatus(): Promise<MihomoStatus> {
  return invoke<MihomoStatus>('get_mihomo_status');
}

export function getMihomoConnectionInfo(): Promise<MihomoConnectionInfo> {
  return invoke<MihomoConnectionInfo>('get_mihomo_connection_info');
}

export function getMihomoOverview(): Promise<MihomoOverview> {
  return invoke<MihomoOverview>('get_mihomo_overview');
}

export function testMihomoProxyDelay(proxyName: string): Promise<MihomoProxyDelayResult> {
  return invoke<MihomoProxyDelayResult>('test_mihomo_proxy_delay', { proxyName });
}

export function testMihomoGroupDelays(groupName: string): Promise<MihomoProxyDelayResult[]> {
  return invoke<MihomoProxyDelayResult[]>('test_mihomo_group_delays', { groupName });
}

export function getMihomoNodeSelection(): Promise<MihomoNodeSelectionSnapshot> {
  return invoke<MihomoNodeSelectionSnapshot>('get_mihomo_node_selection');
}

export function applyMihomoNodeSelection(
  request: ApplyMihomoNodeSelectionRequest
): Promise<MihomoLocalProxy[]> {
  return invoke<MihomoLocalProxy[]>('apply_mihomo_node_selection', { request });
}

export function getLocalMihomoProxies(): Promise<MihomoLocalProxy[]> {
  return invoke<MihomoLocalProxy[]>('get_local_mihomo_proxies');
}

export function updateLocalMihomoProxy(
  request: UpdateMihomoLocalProxyRequest
): Promise<MihomoLocalProxy> {
  return invoke<MihomoLocalProxy>('update_local_mihomo_proxy', { request });
}
