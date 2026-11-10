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
  fullPageAccessEnabled: boolean;
  autoStart: boolean;
}

export interface UpdateMcpConfigRequest {
  enabled?: boolean;
  allowedEnvironmentUuids?: string[];
  pageToolsEnabled?: boolean;
  manageToolsEnabled?: boolean;
  actToolsEnabled?: boolean;
  fullPageAccessEnabled?: boolean;
  autoStart?: boolean;
}
