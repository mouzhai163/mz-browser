/**
 * 审计日志 API
 */
import { post, isSuccess } from '@/lib/request';
import type {
  AuditLogDto,
  AuditLogsListResponse,
  AuditStatsResponse,
  ExportResponse,
  ListAuditLogsRequest,
  ExportAuditLogsRequest,
  AuditStatsRequest,
  AuditLog,
} from './index.types';

export * from './index.types';

// ============ API 端点 ============

export const API_ENDPOINTS = {
  LIST_LOGS: 'audit/logs',
  LOG_DETAIL: 'audit/logs/detail',
  EXPORT_LOGS: 'audit/logs/export',
  STATS: 'audit/stats',
} as const;

// ============ 数据转换 ============

/**
 * 将后端 DTO 转换为前端 AuditLog 格式
 */
function transformAuditLogDto(dto: AuditLogDto): AuditLog {
  return {
    id: dto.uuid,
    action: dto.action,
    targetType: dto.target_type,
    targetId: dto.target_uuid,
    targetName: dto.target_name,
    details: dto.details || '',
    timestamp: dto.created_at,
    operator: dto.user_name || dto.user_email || dto.user_uuid,
    operatorId: dto.user_uuid,
    ipAddress: dto.ip_address,
  };
}

// ============ API 方法 ============

/**
 * 获取审计日志列表
 */
export async function getAuditLogs(
  request: ListAuditLogsRequest = { page: 1, page_size: 20 }
): Promise<{ items: AuditLog[]; total: number; page: number; page_size: number }> {
  const result = await post<AuditLogsListResponse>(API_ENDPOINTS.LIST_LOGS, {
    page: request.page || 1,
    page_size: request.page_size || 20,
    filters: request.filters,
  });

  if (!isSuccess(result)) {
    throw new Error(result.message || '获取审计日志列表失败');
  }

  const data = result.data!;
  return {
    items: (data.items || []).map(transformAuditLogDto),
    total: data.total || 0,
    page: data.page || 1,
    page_size: data.page_size || 20,
  };
}

/**
 * 获取审计日志详情
 */
export async function getAuditLogDetail(uuid: string): Promise<AuditLog> {
  const result = await post<AuditLogDto>(API_ENDPOINTS.LOG_DETAIL, { uuid });

  if (!isSuccess(result)) {
    throw new Error(result.message || '获取审计日志详情失败');
  }

  return transformAuditLogDto(result.data!);
}

/**
 * 导出审计日志
 */
export async function exportAuditLogs(request: ExportAuditLogsRequest): Promise<ExportResponse> {
  const result = await post<ExportResponse>(API_ENDPOINTS.EXPORT_LOGS, request);

  if (!isSuccess(result)) {
    throw new Error(result.message || '导出审计日志失败');
  }

  return result.data!;
}

/**
 * 获取审计统计
 */
export async function getAuditStats(request: AuditStatsRequest = {}): Promise<AuditStatsResponse> {
  const result = await post<AuditStatsResponse>(API_ENDPOINTS.STATS, request);

  if (!isSuccess(result)) {
    throw new Error(result.message || '获取审计统计失败');
  }

  return result.data!;
}
