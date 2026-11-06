/**
 * 环境管理 API 类型定义
 */

import type {
  Environment,
  GroupSummary,
  ProxySummary,
  TagSummary,
  AccountSummary,
  GroupItem,
  TagItem,
} from '../types';

// 从 types 重新导出，保持类型一致
export type {
  Environment,
  GroupSummary,
  ProxySummary,
  TagSummary,
  AccountSummary,
  GroupItem,
  TagItem,
} from '../types';

// ============ 请求类型 ============

export interface ListEnvironmentsRequest {
  page?: number;
  page_size?: number;
  filters?: {
    keyword?: string;
    status?: string;
    group_uuid?: string;
    tag_uuids?: string[];
    created_from?: string;
    created_to?: string;
  };
}

export interface GetEnvironmentRequest {
  uuid: string;
}

export interface CreateEnvironmentRequest {
  workspace_uuid: string;
  team_uuid: string;
  name: string;
  description?: string;
  icon?: string;
  icon_color?: string;
  group_uuid?: string;
  tag_uuids?: string[];
  account_uuids?: string[];
  proxy_uuid?: string;
  cookies?: CookieGroupItem[];
  urls?: EnvironmentUrlInput[];
  config: EnvironmentConfigRequest;
}

export interface EnvironmentConfigRequest {
  window_info: Record<string, unknown>;
  basic_settings: Record<string, unknown>;
  fingerprint_settings: Record<string, unknown>;
  device_settings: Record<string, unknown>;
  preference_settings: Record<string, unknown>;
  project_metadata?: Record<string, unknown>;
}

export interface EnvironmentUrlInput {
  url: string;
  title?: string;
  sort_order?: number;
}

export interface UrlItem {
  id: number;
  environment_uuid: string;
  url: string;
  title?: string;
  sort_order?: number;
  created_at: string;
}

export interface CookieGroupItem {
  site: string;
  cookie_text: string;
}

export interface UpdateEnvironmentRequest {
  uuid: string;
  name?: string;
  description?: string;
  icon?: string;
  icon_color?: string;
  group_uuid?: string;
  cookies?: CookieGroupItem[];
  urls?: EnvironmentUrlInput[];
  config?: EnvironmentConfigRequest;
}

export interface DeleteEnvironmentRequest {
  uuid: string;
}

export interface SetEnvironmentProxyRequest {
  uuid: string;
  proxy_uuid?: string;
}

export interface SetEnvironmentAccountsRequest {
  uuid: string;
  account_uuids: string[];
}

export interface AssignTagsRequest {
  uuid: string;
  tag_uuids: string[];
}

export interface BatchAssignTagsRequest {
  env_uuids: string[];
  tag_uuid: string;
}

export interface RemoveTagRequest {
  uuid: string;
  tag_uuid: string;
}

export interface BatchRemoveTagsRequest {
  env_uuids: string[];
  tag_uuid?: string;
}

export interface MoveToGroupRequest {
  uuid: string;
  group_uuid?: string;
}

export interface BatchMoveToGroupRequest {
  env_uuids: string[];
  group_uuid: string;
}

export interface BatchDeleteRequest {
  uuids: string[];
}

export interface ExportEnvironmentsRequest {
  uuids?: string[];
  include_config?: boolean;
  include_accounts?: boolean;
}

export interface ImportEnvironmentsRequest {
  import_data: string;
  target_group_uuid?: string;
}

// ============ 响应类型 ============

export interface EnvironmentListResponse {
  items: Environment[];
  total: number;
  page: number;
  page_size: number;
}

export interface EnvironmentDetailResponse {
  environment: Environment;
  config?: EnvironmentConfigRequest;
  cookies: CookieGroupItem[];
  urls: UrlItem[];
  tags: TagItem[];
  accounts: Array<{
    id: number;
    uuid: string;
    platform_url: string;
    platform_name?: string;
    account: string;
    password?: string;
    status: string;
    remark?: string;
  }>;
  extensions: Array<{
    extension_id: string;
    name: string;
    version: string;
    icon_url?: string;
    download_url?: string;
    hash?: string;
    scope: 'user' | 'team' | 'group-personal' | 'group-team';
  }>;
  group?: {
    id: number;
    uuid: string;
    name: string;
    description?: string;
    sort_order?: number;
  }; // 分组完整信息
  proxy?: {
    id: number;
    uuid: string;
    name: string;
    host: string;
    port: number;
    proxy_type: string;
    username?: string;
    password?: string;
    country?: string;
    city?: string;
    status: string;
    latency?: number;
    last_check_ip?: string;
  }; // 代理完整信息
}

export interface CreateResponse {
  uuid: string;
}

export interface GroupListResponse {
  items: GroupItem[];
}

export interface TagListResponse {
  items: TagItem[];
}
