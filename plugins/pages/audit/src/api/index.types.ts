/**
 * 审计日志 API 类型定义
 */

// ============ 后端 DTO 类型 ============

/** 后端审计日志 DTO */
export interface AuditLogDto {
  id: number;
  uuid: string;
  user_uuid: string;
  team_uuid?: string;
  action: string;
  target_type: string;
  target_uuid?: string;
  target_name?: string;
  details?: string;
  changes?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  created_at: string;
  // 扩展字段（后端可能返回）
  user_name?: string;
  user_email?: string;
}

// ============ 请求类型 ============

/** 分页参数 */
export interface Pagination {
  page: number;
  page_size: number;
}

/** 审计日志筛选条件 */
export interface AuditLogFilters {
  keyword?: string;
  action?: string;
  target_type?: string;
  user_uuid?: string;
  date_from?: string;
  date_to?: string;
}

/** 查询审计日志请求 */
export interface ListAuditLogsRequest extends Pagination {
  filters?: AuditLogFilters;
}

/** 导出审计日志请求 */
export interface ExportAuditLogsRequest {
  format: 'json' | 'csv';
  filters?: AuditLogFilters;
  max_records?: number;
}

/** 审计统计请求 */
export interface AuditStatsRequest {
  date_from?: string;
  date_to?: string;
}

// ============ 响应类型 ============

/** 审计日志列表响应 */
export interface AuditLogsListResponse {
  items: AuditLogDto[];
  total: number;
  page: number;
  page_size: number;
}

/** 导出响应 */
export interface ExportResponse {
  content: string;
  filename: string;
  mime_type: string;
}

/** 操作计数 */
export interface ActionCount {
  action: string;
  count: number;
}

/** 目标类型计数 */
export interface TargetTypeCount {
  target_type: string;
  count: number;
}

/** 审计统计响应 */
export interface AuditStatsResponse {
  total_logs: number;
  logs_today: number;
  logs_this_week: number;
  logs_this_month: number;
  top_actions: ActionCount[];
  top_target_types: TargetTypeCount[];
}

// ============ 前端展示类型 ============

/** 审计操作类型 */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'register'
  | 'export'
  | 'import'
  | 'start'
  | 'stop'
  | 'batch'
  | 'batch_create'
  | 'batch_delete'
  | 'batch_import'
  | 'invite'
  | 'remove'
  | 'accept_invitation'
  | 'reject_invitation'
  | 'leave'
  | 'update_password';

/** 审计目标类型 */
export type AuditTargetType =
  | 'environment'
  | 'group'
  | 'tag'
  | 'proxy'
  | 'team'
  | 'team_member'
  | 'user'
  | 'settings'
  | 'system';

/** 前端审计日志展示格式 */
export interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  details: string;
  timestamp: string;
  operator: string;
  operatorId: string;
  ipAddress?: string;
}
