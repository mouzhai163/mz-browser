/**
 * 团队 API
 */
import { post, isSuccess } from '@/lib/request';

// API 端点配置
const API_ENDPOINTS = {
  GET_MY_TEAMS: 'teams/my-teams',
  SWITCH_TEAM: 'teams/switch',
} as const;

/**
 * 团队项
 */
export interface TeamItem {
  uuid: string;
  name: string;
  description?: string;
  role: string;
  members_count: number;
  is_current: boolean;
}

/**
 * 团队列表响应
 */
export interface TeamListResponse {
  current_team_uuid: string | null;
  teams: TeamItem[];
}

/**
 * 切换团队请求
 */
export interface SwitchTeamRequest {
  team_uuid: string;
}

/**
 * 获取我的团队列表
 */
export async function getMyTeams(): Promise<TeamListResponse> {
  const result = await post<TeamListResponse>(API_ENDPOINTS.GET_MY_TEAMS, {});
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取团队列表失败');
  }
  return result.data!;
}

/**
 * 切换团队
 */
export async function switchTeam(request: SwitchTeamRequest): Promise<void> {
  const result = await post(API_ENDPOINTS.SWITCH_TEAM, request);
  if (!isSuccess(result)) {
    throw new Error(result.message || '切换团队失败');
  }
}
