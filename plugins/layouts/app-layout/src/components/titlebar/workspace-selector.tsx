import { useState, useEffect } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../../../../services/store/src/stores/auth';
import { useWorkspaceStore } from '../../../../../services/store/src/stores/workspace';
import { useRefreshStore } from '../../../../../services/store/src/stores/refresh';
import { getMyWorkspaces } from '../../api/workspaces';
import { WorkspaceSwitchDialog } from './workspace-switch-dialog';

/**
 * 工作空间选择器组件
 * 显示在顶部导航栏，点击打开切换工作空间弹窗
 */
export function WorkspaceSelector() {
  const { setCurrentWorkspace } = useAuthStore();
  const { workspaces, updateFromResponse, setLoading } = useWorkspaceStore();
  const workspacesRefreshKey = useRefreshStore((state) => state.workspaces);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 加载工作空间列表（仅在刷新标识变化时加载）
  useEffect(() => {
    const loadWorkspaces = async () => {
      setLoading(true);
      try {
        const response = await getMyWorkspaces();
        updateFromResponse(response);
        // 同步到 auth store
        if (response.current_workspace_uuid) {
          setCurrentWorkspace(response.current_workspace_uuid);
        }
      } catch (e) {
        console.error('Failed to load workspaces:', e);
      } finally {
        setLoading(false);
      }
    };
    void loadWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacesRefreshKey]);

  // 获取当前工作空间
  const currentWorkspace = workspaces.find((ws) => ws.is_current);

  if (!currentWorkspace) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="flex items-center gap-2 px-5 h-8 text-[10px] text-foreground bg-muted hover:bg-primary/10 hover:text-foreground transition-all cursor-pointer outline-none rounded-sm mx-2"
      >
        <Building2 className="w-4 h-4 text-primary shrink-0" />
        <span className="font-mono tracking-tight text-[12px] max-w-[120px] truncate">
          {currentWorkspace.name}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
      </button>

      <WorkspaceSwitchDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
