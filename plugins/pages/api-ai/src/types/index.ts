export interface LocalApiConfig {
  enabled: boolean;
  apiKey: string;
  port: number;
  remoteAccess: boolean;
  corsOrigins: string[];
  requestsToday: number;
  dailyLimit: number;
}

export interface UpdateLocalApiConfigRequest {
  enabled?: boolean;
  port?: number;
  remoteAccess?: boolean;
  corsOrigins?: string[];
}

export interface ResetLocalApiKeyResponse {
  apiKey: string;
}

export interface McpConfigSnapshot {
  enabled: boolean;
  running: boolean;
  endpoint: string;
  healthUrl: string;
  authenticationRequired: boolean;
  allowedEnvironmentUuids: string[];
  pageToolsEnabled: boolean;
  manageToolsEnabled: boolean;
  actToolsEnabled: boolean;
  autoStart: boolean;
}

export interface UpdateMcpConfigRequest {
  enabled?: boolean;
  allowedEnvironmentUuids?: string[];
  pageToolsEnabled?: boolean;
  manageToolsEnabled?: boolean;
  actToolsEnabled?: boolean;
  autoStart?: boolean;
}
