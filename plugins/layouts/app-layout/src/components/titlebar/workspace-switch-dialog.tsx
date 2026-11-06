import { useState, useEffect, useMemo } from 'react';
import { Building2, Loader2, Sparkles, Plus, Edit, Trash2, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TextareaInput } from '@/components/textarea-input';
import { useWorkspaceStore } from '../../../../../services/store/src/stores/workspace';
import { useAuthStore } from '../../../../../services/store/src/stores/auth';
import { useRefreshStore } from '../../../../../services/store/src/stores/refresh';
import {
  getMyWorkspaces,
  switchWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from '../../api/workspaces';
import { getWorkspaceQuota } from '../../api/workspace-quotas';
import type { WorkspaceItem } from '../../api/workspaces.types';
import type { WorkspaceQuotaDto } from '../../api/workspace-quotas';

interface WorkspaceSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 工作空间卡片数据（包含配额信息）
 */
interface WorkspaceCardData extends WorkspaceItem {
  quota?: WorkspaceQuotaDto;
}

/**
 * 工作空间卡片组件
 */
const WorkspaceCard: React.FC<{
  workspace: WorkspaceCardData;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
  t: (key: string) => string;
}> = ({ workspace, isSelected, onSelect, onEdit, onDelete, canDelete, t }) => {
  const isCurrent = workspace.is_current;

  return (
    <div
      className={`group relative border rounded-lg p-4 transition-all cursor-pointer ${isCurrent
          ? 'border-primary bg-primary/5'
          : isSelected
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
        }`}
      onClick={onSelect}
    >
      {/* 单选按钮 */}
      <div className="absolute top-4 left-4">
        <RadioGroupItem
          value={workspace.uuid}
          checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4"
        />
      </div>

      {/* 卡片内容 */}
      <div className="pl-10">
        {/* 头部：图标和名称 */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isCurrent
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground group-hover:text-foreground'
                }`}
            >
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground truncate">{workspace.name}</h3>
                {isCurrent && (
                  <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/15 text-primary">
                    {t('workspace.current') || '当前'}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {workspace.uuid.slice(0, 8)}
              </p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title={t('common.edit') || '编辑'}
            >
              <Edit className="h-4 w-4" />
            </Button>
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title={t('common.delete') || '删除'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* 配额信息 */}
        {workspace.quota && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t('workspace.quota.environments') || '环境'}
                </span>
                <span className="font-mono font-medium text-foreground">
                  {workspace.quota.used_environments}/{workspace.quota.max_environments}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t('workspace.quota.proxies') || '代理'}
                </span>
                <span className="font-mono font-medium text-foreground">
                  {workspace.quota.used_proxies}/{workspace.quota.max_proxies}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 工作空间切换和管理弹窗
 */
export function WorkspaceSwitchDialog({ open, onOpenChange }: WorkspaceSwitchDialogProps) {
  const { t } = useTranslation('appLayout');
  const { workspaces, currentWorkspaceUuid, isLoading, setLoading, updateFromResponse } =
    useWorkspaceStore();
  const { setCurrentWorkspace } = useAuthStore();
  const { refreshWorkspaces, refreshAll } = useRefreshStore();

  // 状态管理
  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceCards, setWorkspaceCards] = useState<WorkspaceCardData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceItem | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [switching, setSwitching] = useState(false);

  const loadWorkspaces = async () => {
    setLoading(true);
    try {
      const response = await getMyWorkspaces();
      updateFromResponse(response);
      if (response.current_workspace_uuid) {
        setCurrentWorkspace(response.current_workspace_uuid);
        setSelectedId(response.current_workspace_uuid);
      } else {
        setCurrentWorkspace(null);
        setSelectedId(null);
      }

      const cardsWithQuota = await Promise.all(
        response.workspaces.map(async (workspace) => {
          try {
            const quota = await getWorkspaceQuota({ workspace_uuid: workspace.uuid });
            return { ...workspace, quota };
          } catch {
            return { ...workspace, quota: undefined };
          }
        })
      );
      setWorkspaceCards(cardsWithQuota);
    } catch (e) {
      console.error('Failed to load workspaces:', e);
      toast.error(t('workspace.loadFailed') || '加载工作空间失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载工作空间列表和配额
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedId(null);
      return;
    }
    void loadWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 过滤工作空间
  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery.trim()) return workspaceCards;
    const query = searchQuery.toLowerCase();
    return workspaceCards.filter((ws) => ws.name.toLowerCase().includes(query));
  }, [workspaceCards, searchQuery]);

  // 处理切换工作空间（选择即切换）
  const handleSwitch = async (workspaceUuid: string) => {
    if (workspaceUuid === currentWorkspaceUuid || switching) return;

    setSwitching(true);
    try {
      await switchWorkspace({ workspace_uuid: workspaceUuid });
      setCurrentWorkspace(workspaceUuid);
      setSelectedId(workspaceUuid);
      updateFromResponse({
        current_workspace_uuid: workspaceUuid,
        workspaces: workspaces.map((ws) => ({
          ...ws,
          is_current: ws.uuid === workspaceUuid,
        })),
      });
      toast.success(t('workspace.switchSuccess') || '切换工作空间成功');
      refreshWorkspaces();
      refreshAll();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('workspace.switchFailed') || '切换工作空间失败'
      );
    } finally {
      setSwitching(false);
    }
  };

  // 打开创建对话框
  const handleCreate = () => {
    setFormData({ name: '' });
    setCreateDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (workspace: WorkspaceItem) => {
    setSelectedWorkspace(workspace);
    setFormData({ name: workspace.name });
    setEditDialogOpen(true);
  };

  // 打开删除对话框
  const handleDelete = (workspace: WorkspaceItem) => {
    setSelectedWorkspace(workspace);
    setDeleteDialogOpen(true);
  };

  // 保存创建/编辑
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error(t('workspace.nameRequired') || '请输入工作空间名称');
      return;
    }

    setSubmitting(true);
    try {
      if (createDialogOpen) {
        await createWorkspace({
          name: formData.name,
          workspace_type: 'personal', // 默认个人类型
        });
        toast.success(t('workspace.createSuccess') || '创建工作空间成功');
        setCreateDialogOpen(false);
        await loadWorkspaces();
        refreshWorkspaces();
        refreshAll();
      } else if (editDialogOpen && selectedWorkspace) {
        await updateWorkspace({
          uuid: selectedWorkspace.uuid,
          name: formData.name,
        });
        toast.success(t('workspace.updateSuccess') || '更新工作空间成功');
        setEditDialogOpen(false);
        // 更新本地状态中的工作空间名称
        setWorkspaceCards((prev) =>
          prev.map((ws) =>
            ws.uuid === selectedWorkspace.uuid ? { ...ws, name: formData.name } : ws
          )
        );
        // 更新 store 中的工作空间名称
        updateFromResponse({
          current_workspace_uuid: currentWorkspaceUuid,
          workspaces: workspaces.map((ws) =>
            ws.uuid === selectedWorkspace.uuid ? { ...ws, name: formData.name } : ws
          ),
        });
        refreshWorkspaces();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('workspace.saveFailed') || '保存工作空间失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!selectedWorkspace) return;

    setDeleting(true);
    try {
      await deleteWorkspace({ uuid: selectedWorkspace.uuid });
      toast.success(t('workspace.deleteSuccess') || '删除工作空间成功');
      setDeleteDialogOpen(false);
      setSelectedWorkspace(null);
      await loadWorkspaces();
      refreshWorkspaces();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('workspace.deleteFailed') || '删除工作空间失败'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <FormattedDialog
        open={open}
        onOpenChange={onOpenChange}
        header={{
          icon: Building2,
          title: t('workspace.switchTitle') || '切换工作空间',
          description: t('workspace.switchDescription') || '选择要切换的工作空间',
        }}
        minWidth="min-w-[600px]"
        overlayClose={false}
      >
        {/* 功能描述 */}
        <div className="mb-4 p-3 rounded-lg bg-linear-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 border border-blue-500/20">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground mb-1">
                {t('workspace.featureTitle') || '工作空间功能'}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('workspace.featureDescription') ||
                  '工作空间帮助您将不同的项目和团队环境进行隔离管理。每个工作空间拥有独立的配额、团队和资源，让您的工作更加有序高效。'}
              </p>
            </div>
          </div>
        </div>

        {/* 搜索栏和创建按钮 */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="relative group flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              placeholder={t('workspace.searchPlaceholder') || '搜索工作空间...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm bg-muted/30 border-border/50 rounded-lg focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-9 border-dashed hover:border-primary/50 hover:bg-primary/5"
            onClick={handleCreate}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t('workspace.create') || '创建工作空间'}
          </Button>
        </div>

        {/* 卡片区域 */}
        {workspaceCards.length === 0 && !isLoading ? (
          <div className="rounded-lg border border-border/50 flex-1 min-h-0 flex items-center justify-center py-10">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-blue-500/60" />
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1">
                {t('workspace.noWorkspaces') || '暂无工作空间'}
              </h4>
              <p className="text-xs text-muted-foreground text-center mb-4 max-w-[240px]">
                {t('workspace.noWorkspacesDescription') || '您还没有任何工作空间'}
              </p>
              <Button
                size="sm"
                onClick={handleCreate}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {t('workspace.createFirst') || '创建第一个工作空间'}
              </Button>
            </div>
          </div>
        ) : filteredWorkspaces.length === 0 && !isLoading ? (
          <div className="rounded-lg border border-border/50 flex-1 min-h-0 flex items-center justify-center py-10">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-blue-500/60" />
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1">
                {t('workspace.noMatch') || '没有找到匹配的工作空间'}
              </h4>
              <p className="text-xs text-muted-foreground text-center max-w-[240px]">
                {t('workspace.noMatchDescription') || '请尝试其他搜索关键词'}
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="rounded-lg border border-border/50 flex-1 min-h-0 flex items-center justify-center py-10">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                {t('workspace.loading') || '加载中...'}
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] -mx-1 px-1">
            <RadioGroup
              value={selectedId || undefined}
              onValueChange={(value) => {
                setSelectedId(value);
                handleSwitch(value);
              }}
              className="space-y-3"
            >
              {filteredWorkspaces.map((workspace) => {
                // 如果只有一个工作空间，不允许删除
                const canDelete = workspaceCards.length > 1;
                return (
                  <WorkspaceCard
                    key={workspace.uuid}
                    workspace={workspace}
                    isSelected={selectedId === workspace.uuid}
                    onSelect={() => {
                      setSelectedId(workspace.uuid);
                      handleSwitch(workspace.uuid);
                    }}
                    onEdit={() => handleEdit(workspace)}
                    onDelete={() => handleDelete(workspace)}
                    canDelete={canDelete}
                    t={t}
                  />
                );
              })}
            </RadioGroup>
          </ScrollArea>
        )}
      </FormattedDialog>

      {/* 创建工作空间对话框 */}
      <FormattedDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        header={{
          icon: Building2,
          title: t('workspace.create') || '创建工作空间',
          description: t('workspace.createDescription') || '创建一个新的工作空间',
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">{t('workspace.name') || '工作空间名称'}</Label>
            <Input
              id="create-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('workspace.namePlaceholder') || '请输入工作空间名称'}
              disabled={submitting}
            />
          </div>
        </div>

        <FormattedDialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateDialogOpen(false)}
            disabled={submitting}
          >
            {t('common.cancel') || '取消'}
          </Button>
          <Button
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            onClick={handleSave}
            disabled={submitting || !formData.name.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {t('workspace.creating') || '创建中...'}
              </>
            ) : (
              t('workspace.create') || '创建'
            )}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>

      {/* 编辑工作空间对话框 */}
      <FormattedDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        header={{
          icon: Edit,
          title: t('workspace.edit') || '编辑工作空间',
          description: t('workspace.editDescription') || '修改工作空间信息',
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-xs text-muted-foreground">
              {t('workspace.name') || '工作空间名称'}
            </Label>
            <TextareaInput
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="text-sm min-h-9"
              disabled={submitting}
            />
          </div>
        </div>

        <FormattedDialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditDialogOpen(false)}
            disabled={submitting}
          >
            {t('common.cancel') || '取消'}
          </Button>
          <Button
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            onClick={handleSave}
            disabled={submitting || !formData.name.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {t('workspace.saving') || '保存中...'}
              </>
            ) : (
              t('common.save') || '保存'
            )}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>

      {/* 删除确认对话框 */}
      <FormattedDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        header={{
          icon: Trash2,
          iconColor: 'text-destructive',
          title: t('workspace.delete') || '删除工作空间',
          description: selectedWorkspace
            ? t('workspace.deleteDescription', { name: selectedWorkspace.name }) ||
            `确定要删除工作空间 "${selectedWorkspace.name}" 吗？`
            : '',
          gradient: 'bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10',
          className: 'border-b border-destructive/20',
        }}
        contentPadding="p-5"
      >
        {selectedWorkspace && (
          <div className="bg-muted/50 rounded-md p-3 border border-border/50">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{selectedWorkspace.name}</p>
            </div>
          </div>
        )}

        <FormattedDialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDeleteDialogOpen(false);
              setSelectedWorkspace(null);
            }}
            disabled={deleting}
          >
            <X className="h-4 w-4 mr-1.5" />
            {t('common.cancel') || '取消'}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={deleting}>
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                {t('workspace.deleting') || '删除中...'}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1.5" />
                {t('workspace.deleteConfirm') || '确认删除'}
              </>
            )}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>
    </>
  );
}
