import { Info, Users, MessageSquare } from 'lucide-react';

// 消息类型映射（用于显示名称）
export const MESSAGE_TYPE_MAP: Record<string, string> = {
  system_notification: 'notification.systemNotification',
  team_invitation: 'notification.teamMessage',
  team_removal: 'notification.teamMessage',
  team_announcement: 'notification.teamMessage',
  private_chat: 'notification.privateChat',
};

// 左侧导航的类型筛选（合并后的类型）
export const NAV_TYPE_MAP: Record<string, string> = {
  system_notification: 'notification.systemNotification',
  team: 'notification.teamMessage',
  private_chat: 'notification.privateChat',
};

// 团队相关的消息类型
export const TEAM_MESSAGE_TYPES = ['team_invitation', 'team_removal', 'team_announcement'];

// 消息类型图标映射
export const MESSAGE_TYPE_ICONS: Record<string, typeof Info> = {
  system_notification: Info,
  team_invitation: Users,
  team_removal: Users,
  team_announcement: Users,
  team: Users,
  private_chat: MessageSquare,
};

// 消息类型图标颜色映射
export const MESSAGE_TYPE_ICON_COLORS: Record<string, string> = {
  system_notification: 'text-blue-500',
  team_invitation: 'text-emerald-500',
  team_removal: 'text-emerald-500',
  team_announcement: 'text-emerald-500',
  team: 'text-emerald-500',
  private_chat: 'text-orange-500',
};

/**
 * 获取消息类型显示名称
 */
export function getMessageTypeName(type: string, t: (key: string) => string): string {
  const key = MESSAGE_TYPE_MAP[type] || type;
  return t(key);
}

/**
 * 获取消息类型图标
 */
export function getMessageTypeIcon(type: string): typeof Info {
  return MESSAGE_TYPE_ICONS[type] || Info;
}

/**
 * 获取消息类型图标颜色
 */
export function getMessageTypeIconColor(type: string): string {
  return MESSAGE_TYPE_ICON_COLORS[type] || 'text-muted-foreground';
}

/**
 * 判断消息类型是否属于团队消息
 */
export function isTeamMessageType(type: string): boolean {
  return TEAM_MESSAGE_TYPES.includes(type);
}
