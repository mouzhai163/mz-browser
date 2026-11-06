import { useTranslation } from 'react-i18next';
import { UserPlus, RefreshCw, ChevronDown, Check, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TeamLeaveDialog } from './team-leave-dialog';
import { useTeamDialogStore, useTeamFiltersStore } from '../stores';
import { useRefreshStore, useAuthStore } from '../../../../services/store/src';
import { getMyTeams, switchTeam, leaveTeam } from '../api';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { RoleFilter } from '../types';
import type { TeamItem } from '../api';

interface TeamHeaderProps {
  onTeamSwitched?: () => void;
}

export function TeamHeader({ onTeamSwitched }: TeamHeaderProps) {
  const { t } = useTranslation('team');
  const dialogStore = useTeamDialogStore();
  const filtersStore = useTeamFiltersStore();

  // 团队列表状态
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [currentTeamUuid, setCurrentTeamUuid] = useState<string | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // 退出团队对话框状态
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  // 监听团队数据刷新标识
  const teamsRefreshKey = useRefreshStore((state) => state.teams);
  const { refreshTeams } = useRefreshStore();

  // 加载团队列表（当 teamsRefreshKey 变化时也会重新加载）
  useEffect(() => {
    const loadTeams = async () => {
      setLoadingTeams(true);
      try {
        const response = await getMyTeams();
        setTeams(response.teams || []);
        setCurrentTeamUuid(response.current_team_uuid || null);
      } catch (e) {
        console.error('Failed to load teams:', e);
      } finally {
        setLoadingTeams(false);
      }
    };
    void loadTeams();
  }, [teamsRefreshKey]);

  const handleInvite = () => {
    dialogStore.openInviteDialog();
  };

  const { setCurrentTeam } = useAuthStore();

  // 切换团队
  const handleTeamChange = async (teamUuid: string) => {
    if (teamUuid === currentTeamUuid) return;
    try {
      await switchTeam(teamUuid);
      setCurrentTeamUuid(teamUuid);
      setCurrentTeam(teamUuid);
      // 更新 teams 列表中的 is_current 状态
      setTeams((prev) =>
        prev.map((team) => ({
          ...team,
          is_current: team.uuid === teamUuid,
        }))
      );
      toast.success('切换团队成功');
      // 刷新数据以加载新团队的数据
      onTeamSwitched?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '切换团队失败');
    }
  };

  const handleRoleFilterChange = (value: RoleFilter) => {
    filtersStore.setRoleFilter(value);
  };

  // 退出团队
  const handleLeaveTeam = async () => {
    await leaveTeam();
    toast.success(t('header.leaveTeamSuccess'));
    setLeaveDialogOpen(false);
    // 触发团队数据刷新
    refreshTeams();
    // 刷新当前页面数据
    onTeamSwitched?.();
  };

  const roleFilters: { value: RoleFilter; key: string }[] = [
    { value: 'all', key: 'tabs.all' },
    { value: 'admin', key: 'tabs.admin' },
    { value: 'editor', key: 'tabs.editor' },
    { value: 'viewer', key: 'tabs.viewer' },
  ];

  // 获取当前团队
  const currentTeam = teams.find((t) => t.is_current);

  // 判断当前用户是否是团队所有者
  const isOwner = currentTeam?.role === 'owner';

  return (
    <header className="border-b border-border flex items-center justify-between px-6 py-2 bg-background/10 backdrop-blur-2xl">
      <div className="flex items-center gap-4">
        {/* 角色过滤按钮组 */}
        <div className="flex items-center gap-1">
          {roleFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => handleRoleFilterChange(filter.value)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md transition-all duration-200',
                filtersStore.roleFilter === filter.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {t(filter.key)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* 退出团队按钮（非所有者可见） */}
        {currentTeam && !isOwner && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLeaveDialogOpen(true)}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-md border border-border"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('header.leaveTeam')}</TooltipContent>
          </Tooltip>
        )}

        <button
          onClick={handleInvite}
          className="flex items-center gap-1.5 bg-transparent text-foreground text-xs font-semibold px-4 py-2 hover:bg-accent transition-colors border border-border rounded-md"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t('header.invite')}
        </button>
        {/* 切换团队下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 hover:bg-primary/90 transition-colors border border-primary rounded-md">
              <RefreshCw className="h-3.5 w-3.5" />
              {currentTeam ? currentTeam.name : t('header.switchTeam')}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {loadingTeams ? (
              <DropdownMenuItem disabled className="cursor-default">
                <span className="text-xs text-muted-foreground">加载中...</span>
              </DropdownMenuItem>
            ) : teams.length === 0 ? (
              <DropdownMenuItem disabled className="cursor-default">
                <span className="text-xs text-muted-foreground">暂无团队</span>
              </DropdownMenuItem>
            ) : (
              teams.map((team) => {
                const isActive = team.is_current;
                return (
                  <DropdownMenuItem
                    key={team.uuid}
                    onClick={() => handleTeamChange(team.uuid)}
                    className={cn('cursor-pointer', isActive && 'bg-accent')}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs">{team.name}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 退出团队确认对话框 */}
      <TeamLeaveDialog
        open={leaveDialogOpen}
        teamName={currentTeam?.name || null}
        onOpenChange={setLeaveDialogOpen}
        onConfirm={handleLeaveTeam}
      />
    </header>
  );
}
