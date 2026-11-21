export type NetworkMode = 'direct' | 'system_proxy' | 'relay';

export type RelayGroupKind = 'local' | 'subscription';

export interface RelayNode {
  id: string;
  name: string;
  protocol: string;
  server: string;
  port: number;
  raw_proxy: Record<string, unknown>;
  latency_ms?: number | null;
  country_code?: string | null;
}

export interface RelayGroup {
  id: string;
  name: string;
  kind: RelayGroupKind;
  subscription_url?: string | null;
  updated_at?: string | null;
  nodes: RelayNode[];
}

export interface NetworkRelayConfig {
  mode: NetworkMode;
  selected_group_id?: string | null;
  selected_node_id?: string | null;
  groups: RelayGroup[];
  custom_core_path?: string | null;
}

export interface SystemProxyInfo {
  enabled: boolean;
  server?: string | null;
  host?: string | null;
  port?: number | null;
  scheme: string;
}

export interface RelayCoreStatus {
  installed: boolean;
  running: boolean;
  core_path: string;
  mixed_port: number;
  controller_port: number;
  error?: string | null;
}

export interface NetworkRelayState {
  config: NetworkRelayConfig;
  core_status: RelayCoreStatus;
  system_proxy: SystemProxyInfo;
  active_node?: RelayNode | null;
}

export interface RelayDelayResult {
  node_id: string;
  name: string;
  available: boolean;
  delay_ms?: number | null;
}

export interface AddSubscriptionRequest {
  name: string;
  url: string;
}

export interface AddGroupRequest {
  name: string;
}

export interface ManualNodeInput {
  name: string;
  protocol: 'http' | 'https' | 'socks5';
  server: string;
  port: number;
  username?: string;
  password?: string;
}

export interface AddNodesRequest {
  group_id: string;
  raw_links?: string;
  manual_node?: ManualNodeInput;
}
