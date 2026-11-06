/**
 * 消息 API
 */
import { post, isSuccess } from '@/lib/request';

// ============ API 端点 ============

const API_ENDPOINTS = {
  LIST_MESSAGES: 'messages/list',
  MARK_READ: 'messages/read',
  BATCH_MARK_READ: 'messages/batch-read',
  STATS: 'messages/stats',
  HANDLE: 'messages/handle',
} as const;

// ============ 类型定义 ============

export interface Message {
  message_uuid: string;
  message_type: string;
  title: string;
  content: string | null;
  sender_uuid: string | null;
  related_type: string | null;
  related_uuid: string | null;
  metadata: Record<string, any> | null;
  priority: string;
  message_created_at: string;
  is_read: boolean;
  read_at: string | null;
  action_status: string | null;
  action_at: string | null;
  sender_name: string | null;
  sender_email: string | null;
}

export interface MessageListRequest {
  page?: number;
  page_size?: number;
  filters?: {
    message_type?: string;
    is_read?: boolean;
    action_status?: string;
    priority?: string;
  };
}

export interface MessageListResponse {
  items: Message[];
  total: number;
  page: number;
  page_size: number;
}

export interface MessageStats {
  total: number;
  unread: number;
  by_type: Record<string, number>;
}

export interface MarkReadRequest {
  message_uuid: string;
}

export interface BatchMarkReadRequest {
  message_uuids: string[];
}

export interface HandleMessageRequest {
  message_uuid: string;
  action: 'accept' | 'reject';
}

// ============ API 函数 ============

/**
 * 获取消息列表
 */
export async function listMessages(request: MessageListRequest = {}): Promise<MessageListResponse> {
  const result = await post<MessageListResponse>(API_ENDPOINTS.LIST_MESSAGES, {
    page: request.page || 1,
    page_size: request.page_size || 20,
    filters: request.filters,
  });

  if (!isSuccess(result)) {
    throw new Error(result.message || '获取消息列表失败');
  }

  return result.data!;
}

/**
 * 标记消息为已读
 */
export async function markMessageRead(messageUuid: string): Promise<void> {
  const result = await post(API_ENDPOINTS.MARK_READ, {
    message_uuid: messageUuid,
  });

  if (!isSuccess(result)) {
    throw new Error(result.message || '标记已读失败');
  }
}

/**
 * 批量标记消息为已读
 */
export async function batchMarkMessagesRead(messageUuids: string[]): Promise<void> {
  const result = await post(API_ENDPOINTS.BATCH_MARK_READ, {
    message_uuids: messageUuids,
  });

  if (!isSuccess(result)) {
    throw new Error(result.message || '批量标记已读失败');
  }
}

/**
 * 获取消息统计
 */
export async function getMessageStats(): Promise<MessageStats> {
  const result = await post<MessageStats>(API_ENDPOINTS.STATS, {});

  if (!isSuccess(result)) {
    throw new Error(result.message || '获取消息统计失败');
  }

  return result.data!;
}

/**
 * 处理消息（接受/拒绝）
 */
export async function handleMessage(request: HandleMessageRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.HANDLE, {
    message_uuid: request.message_uuid,
    action: request.action,
  });

  if (!isSuccess(result)) {
    throw new Error(result.message || '处理消息失败');
  }
}
