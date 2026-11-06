export interface MihomoConnectionConfig {
  controller: string;
  secret: string;
  config_path?: string;
}

export interface MihomoStatus {
  attached: boolean;
  controller: string | null;
  config_path?: string | null;
}

export interface MihomoProxyDelayResult {
  name: string;
  delay_ms: number | null;
  available: boolean;
}

export interface MihomoConnectionInfo {
  attached: boolean;
  controller: string | null;
  secret: string | null;
  config_path?: string | null;
}

export interface MihomoProviderOverview {
  name: string;
  provider_type: string | null;
  vehicle_type: string | null;
  updated_at: string | null;
  node_count: number;
}

export interface MihomoGroupOverview {
  name: string;
  group_type: string;
  selected: string | null;
  candidates: string[];
}

export interface MihomoNodeOverview {
  name: string;
  node_type: string;
  alive: boolean | null;
  udp: boolean | null;
  source_provider: string | null;
}

export interface MihomoOverview {
  controller: string;
  version: string | null;
  providers: MihomoProviderOverview[];
  groups: MihomoGroupOverview[];
  nodes: MihomoNodeOverview[];
}

export interface MihomoNodeSelectionSnapshot {
  controller: string;
  selected_node_names: string[];
  updated_at: string;
}

export interface ApplyMihomoNodeSelectionRequest {
  selected_node_names: string[];
}

export interface MihomoLocalProxy {
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

export interface UpdateMihomoLocalProxyRequest {
  id: string;
  status: string;
  latency_ms?: number | null;
  country?: string | null;
  country_code?: string | null;
  city?: string | null;
}
