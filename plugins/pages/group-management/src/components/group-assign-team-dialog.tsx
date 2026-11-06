import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, Check, Loader2 } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { TextareaInput } from '@/components/textarea-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { post, isSuccess } from '@/lib/request';
import type { Group } from '../types';

/**
 * 团队项
 */
interface TeamItem {
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
interface TeamListResponse {
  current_team_uuid: string | null;
  teams: TeamItem[];
}

/**
 * 获取我的团队列表
 */
async function getMyTeams(): Promise<TeamListResponse> {
  const result = await post<TeamListResponse>('teams/my-teams', {});
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取团队列表失败');
  }
  return result.data!;
}

interface GroupAssignTeamDialogProps {
  open: boolean;
  group: Group | null;
  selectedTeamId: string;
  onOpenChange: (open: boolean) => void;
  onTeamIdChange: (teamId: string) => void;
  onSubmit: () => void;
}

/**
 * 团队卡片组件
 */
const TeamCard: React.FC<{
  team: TeamItem;
  isSelected: boolean;
  onClick: () => void;
}> = ({ team, isSelected, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors duration-150 ${
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/80'
      }`}
    >
      <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center bg-muted text-muted-foreground group-hover:text-foreground transition-colors duration-150">
        <Users className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{team.name}</span>
          {team.is_current && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              当前
            </span>
          )}
        </div>
        {team.description && (
          <div className="mt-0.5 text-xs text-muted-foreground truncate">{team.description}</div>
        )}
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {team.members_count} 位成员 ·{' '}
          {team.role === 'owner' ? '所有者' : team.role === 'admin' ? '管理员' : '成员'}
        </div>
      </div>
      <div
        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${
          isSelected
            ? 'bg-primary border-primary'
            : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'
        }`}
      >
        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
    </div>
  );
};

/**
 * 空状态组件
 */
const EmptyState: React.FC<{
  title: string;
  description: string;
}> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      <Users className="h-8 w-8 text-blue-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{title}</h4>
    <p className="text-xs text-muted-foreground text-center max-w-[260px]">{description}</p>
  </div>
);

/**
 * 加载状态组件
 */
const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <Loader2 className="h-8 w-8 animate-spin text-primary/60 mb-4" />
    <p className="text-xs text-muted-foreground">加载团队列表...</p>
  </div>
);

/**
 * 划分到团队对话框组件
 */
export function GroupAssignTeamDialog({
  open,
  group,
  selectedTeamId,
  onOpenChange,
  onTeamIdChange,
  onSubmit,
}: GroupAssignTeamDialogProps) {
  const { t } = useTranslation('groups');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 加载团队列表
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setLoadingTeams(true);
      setLoadError(null);
      getMyTeams()
        .then((response) => {
          setTeams(response.teams);
        })
        .catch((e) => {
          setLoadError(e instanceof Error ? e.message : '加载团队失败');
        })
        .finally(() => {
          setLoadingTeams(false);
        });
    }
  }, [open]);

  // 根据搜索过滤团队
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teams;
    const query = searchQuery.toLowerCase();
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(query) ||
        (team.description && team.description.toLowerCase().includes(query))
    );
  }, [teams, searchQuery]);

  const handleSubmit = async () => {
    if (!selectedTeamId) return;
    setSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    onTeamIdChange('');
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          onTeamIdChange('');
        }
      }}
      header={{
        icon: Users,
        title: group ? t('dialog.assignToTeam.title', { name: group.name }) : '',
        description: t('dialog.assignToTeam.description'),
      }}
    >
      {/* 搜索框 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <TextareaInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('dialog.assignToTeam.searchPlaceholder', { defaultValue: '搜索团队...' })}
          className="pl-9 text-sm"
          disabled={loadingTeams}
        />
      </div>

      {/* 团队列表 */}
      <ScrollArea className="h-[240px] -mx-1 px-1">
        {loadingTeams ? (
          <LoadingState />
        ) : loadError ? (
          <EmptyState
            title={t('dialog.assignToTeam.loadError', { defaultValue: '加载失败' })}
            description={loadError}
          />
        ) : filteredTeams.length === 0 ? (
          <EmptyState
            title={
              searchQuery
                ? t('dialog.assignToTeam.noSearchResults', { defaultValue: '未找到匹配的团队' })
                : t('dialog.assignToTeam.noTeams', { defaultValue: '暂无可用团队' })
            }
            description={
              searchQuery
                ? t('dialog.assignToTeam.noSearchResultsDescription', {
                    defaultValue: '请尝试其他搜索关键词',
                  })
                : t('dialog.assignToTeam.noTeamsDescription', {
                    defaultValue: '联系管理员创建团队',
                  })
            }
          />
        ) : (
          <div className="space-y-1">
            {filteredTeams.map((team) => (
              <TeamCard
                key={team.uuid}
                team={team}
                isSelected={selectedTeamId === team.uuid}
                onClick={() => onTeamIdChange(team.uuid)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" className="text-xs" onClick={handleClose}>
          {t('dialog.assignToTeam.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={submitting || !selectedTeamId || loadingTeams}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.assignToTeam.submitting', { defaultValue: '提交中...' })}
            </>
          ) : (
            t('dialog.assignToTeam.submit')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
