// 分组摘要
export interface GroupSummary {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  sort_order?: number;
}

// 代理摘要
export interface ProxySummary {
  id: number;
  uuid: string;
  name: string;
  host: string;
  port: number;
  proxy_type: string;
  country?: string;
  country_code?: string;
  city?: string;
  status: string;
  latency?: number;
  last_check_ip?: string;
  source?: 'remote' | 'local';
  node_name?: string;
  listener_name?: string;
  local_missing?: boolean;
}

// 标签摘要
export interface TagSummary {
  id: number;
  uuid: string;
  name: string;
  color?: string;
  sort_order?: number;
}

// 账号摘要
export interface AccountSummary {
  id: number;
  uuid: string;
  platform_url: string;
  platform_name?: string;
  account: string;
  password?: string;
  status: string;
  remark?: string;
}

// 扩展摘要
export interface ExtensionSummary {
  extension_id: string;
  name: string;
  version: string;
  icon_url?: string;
  download_url?: string;
  hash?: string;
  scope: 'user' | 'team' | 'group-personal' | 'group-team';
}

// 环境（包含完整关联数据）
export interface Environment {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  status: string;
  system_info?: string;
  kernel_info?: string;
  fingerprint_summary?: string;
  last_opened_at?: string;
  created_at: string;
  updated_at: string;
  // 分组详情（完整对象）
  group?: GroupSummary;
  // 代理详情（完整对象）
  proxy?: ProxySummary;
  // 标签列表（完整对象列表）
  tags: TagSummary[];
  // 账号列表（完整对象列表）
  accounts: AccountSummary[];
  // 扩展列表（完整对象列表）
  extensions: ExtensionSummary[];
}

// 分组列表项（用于选择器等）
export interface GroupItem {
  id: string;
  uuid: string;
  name: string;
  description?: string;
}

// 标签列表项（用于选择器等）
export interface TagItem {
  id: string;
  uuid: string;
  name: string;
  color: string;
  environmentsCount?: number;
}
