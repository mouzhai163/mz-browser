/**
 * 创建窗口 API 类型定义
 */

/**
 * 创建环境请求参数（对应后端 CreateEnvironmentRequest）
 */
export interface CookieGroupInput {
  site: string;
  cookie_text: string;
}

export interface CreateEnvironmentRequest {
  name: string;
  description?: string;
  icon?: string;
  icon_color?: string;
  group_uuid?: string;
  tag_uuids?: string[];
  account_uuids?: string[];
  proxy_uuid?: string; // 代理 UUID（单个）
  cookies?: CookieGroupInput[];
  urls?: EnvironmentUrlInput[];
  config: EnvironmentConfigRequest;
}

export interface EnvironmentUrlInput {
  url: string;
  title?: string;
  sort_order?: number;
}

/**
 * 环境配置请求
 */
export interface EnvironmentConfigRequest {
  window_info: Record<string, unknown>;
  basic_settings: Record<string, unknown>;
  fingerprint_settings: Record<string, unknown>;
  device_settings: Record<string, unknown>;
  preference_settings: Record<string, unknown>;
  project_metadata: Record<string, unknown>;
}

/**
 * 创建环境响应
 */
export interface CreateEnvironmentResponse {
  uuid: string;
}

/**
 * 创建模板请求参数
 */
export interface CreateTemplateRequest {
  name: string;
  description?: string;
  is_public?: boolean;
  /// 完整的环境详情数据（EnvironmentDetailResponse 的 JSON 格式）
  /// 如果提供了 environment_uuid，则此字段会被忽略，后端会自动获取环境详情
  environment_data?: Record<string, unknown>;
  /// 环境 UUID（如果提供，后端会自动获取该环境的完整详情数据）
  environment_uuid?: string;
}

/**
 * 创建模板响应
 */
export interface CreateTemplateResponse {
  uuid: string;
}

/**
 * 创建环境选项
 */
export interface CreateEnvironmentOptions {
  groupUuid?: string;
  tagUuids?: string[];
  accountUuids?: string[];
  proxyUuid?: string; // 代理 UUID（单个，用于编辑模式）
}

/**
 * 批量创建环境请求
 */
export interface BatchCreateEnvironmentRequest {
  environments: CreateEnvironmentRequest[];
}

/**
 * 批量创建环境响应（后端返回 CreateResponse 数组）
 */
export interface BatchCreateEnvironmentResponse {
  data: CreateEnvironmentResponse[]; // 后端返回的是 CreateResponse 数组
}
