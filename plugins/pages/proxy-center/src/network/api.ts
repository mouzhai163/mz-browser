import { invoke } from '@/lib/tauri';
import type {
  AddGroupRequest,
  AddNodesRequest,
  AddSubscriptionRequest,
  NetworkMode,
  NetworkRelayState,
  RelayDelayResult,
} from './types';

export function getNetworkRelayState(): Promise<NetworkRelayState> {
  return invoke<NetworkRelayState>('get_network_relay_state');
}

export function setNetworkRelayMode(mode: NetworkMode): Promise<NetworkRelayState> {
  return invoke<NetworkRelayState>('set_network_relay_mode', { mode });
}

export function selectNetworkRelayNode(
  groupId: string,
  nodeId: string
): Promise<NetworkRelayState> {
  return invoke<NetworkRelayState>('select_network_relay_node', { groupId, nodeId });
}

export function addNetworkRelaySubscription(
  request: AddSubscriptionRequest
): Promise<NetworkRelayState> {
  return invoke<NetworkRelayState>('add_network_relay_subscription', { request });
}

export function refreshNetworkRelaySubscription(groupId: string): Promise<NetworkRelayState> {
  return invoke<NetworkRelayState>('refresh_network_relay_subscription', { groupId });
}

export function addNetworkRelayGroup(request: AddGroupRequest): Promise<NetworkRelayState> {
  return invoke<NetworkRelayState>('add_network_relay_group', { request });
}

export function deleteNetworkRelayGroup(groupId: string): Promise<NetworkRelayState> {
  return invoke<NetworkRelayState>('delete_network_relay_group', { groupId });
}

export function addNetworkRelayNodes(request: AddNodesRequest): Promise<NetworkRelayState> {
  return invoke<NetworkRelayState>('add_network_relay_nodes', { request });
}

export function deleteNetworkRelayNode(
  groupId: string,
  nodeId: string
): Promise<NetworkRelayState> {
  return invoke<NetworkRelayState>('delete_network_relay_node', { groupId, nodeId });
}

export function installNetworkRelayCore(): Promise<NetworkRelayState> {
  return invoke<NetworkRelayState>('install_network_relay_core');
}

export function setNetworkRelayCorePath(corePath: string): Promise<NetworkRelayState> {
  return invoke<NetworkRelayState>('set_network_relay_core_path', { corePath });
}

export function testNetworkRelayNodeDelay(
  groupId: string,
  nodeId: string
): Promise<RelayDelayResult> {
  return invoke<RelayDelayResult>('test_network_relay_node_delay', { groupId, nodeId });
}

export function testNetworkRelayGroupDelays(groupId: string): Promise<RelayDelayResult[]> {
  return invoke<RelayDelayResult[]>('test_network_relay_group_delays', { groupId });
}
