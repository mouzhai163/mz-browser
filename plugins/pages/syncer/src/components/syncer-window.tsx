import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@/lib/tauri';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { ChevronUp, ChevronDown, X, Play, Square, MousePointer2, LayoutGrid } from 'lucide-react';
import { post, isSuccess } from '@/lib/request';

interface RunningEnvironment {
  uuid: string;
  name: string;
  status: 'running' | 'stopped';
}

// 与后端 WindowLayoutCell 对应，用于一键排列布局测试
interface WindowLayoutCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 同步器窗口 - 悬浮窗口用于同步多个浏览器操作
 */
// 收起时的高度（仅显示标题栏）
const COLLAPSED_HEIGHT = 40;
// 展开时的默认高度
const EXPANDED_HEIGHT = 480;

export function SyncerWindow() {
  const [environments, setEnvironments] = useState<RunningEnvironment[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedEnvs, setSelectedEnvs] = useState<Set<string>>(new Set());
  const [masterEnvId, setMasterEnvId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const previousHeightRef = useRef<number>(EXPANDED_HEIGHT);

  // 获取正在运行的环境列表，并从 API 解析真实名称
  const fetchRunningEnvironments = useCallback(async () => {
    try {
      // 1. 获取已连接的环境 UUID 列表
      const connectedEnvs = await invoke<RunningEnvironment[]>('get_running_environments');
      if (!connectedEnvs || connectedEnvs.length === 0) {
        setEnvironments([]);
        return;
      }

      // 2. 从 API 获取环境列表（携带名称），用于匹配 UUID → 名称
      let nameMap: Record<string, string> = {};
      try {
        const apiResult = await post<{
          items: Array<{ environment: { uuid: string; name: string } }>;
          total: number;
        }>('environments/list', {
          page: 1,
          page_size: 200,
        });
        if (isSuccess(apiResult) && apiResult.data?.items) {
          for (const item of apiResult.data.items) {
            if (item.environment?.uuid && item.environment?.name) {
              nameMap[item.environment.uuid] = item.environment.name;
            }
          }
        }
      } catch {
        // API 调用失败时仍使用 UUID 作为名称兜底
        console.warn('获取环境名称失败，将使用 UUID 显示');
      }

      // 3. 合并：用 API 名称替换 UUID 兜底名
      const envs = connectedEnvs.map((env) => ({
        ...env,
        name: nameMap[env.uuid] || env.uuid,
      }));

      setEnvironments(envs);
    } catch (error) {
      console.error('获取运行中环境失败:', error);
    }
  }, []);

  // 初始化和监听环境连接状态变化
  useEffect(() => {
    fetchRunningEnvironments();

    // 监听 EventBus 连接/断开事件，实时更新列表
    const unlistenPromise = listen<{ env_id: string; status: string }>(
      'env-connection-status',
      () => {
        fetchRunningEnvironments();
      }
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [fetchRunningEnvironments]);

  // 显示窗口
  useEffect(() => {
    const showWindow = async () => {
      try {
        const window = getCurrentWindow();
        await window.show();
        await window.setFocus();
      } catch (error) {
        console.error('显示窗口失败:', error);
      }
    };
    showWindow();
  }, []);

  // 关闭窗口
  const handleClose = async () => {
    try {
      const window = getCurrentWindow();
      await window.close();
    } catch (error) {
      console.error('关闭窗口失败:', error);
    }
  };

  // 收起/展开窗口
  const toggleCollapse = async () => {
    try {
      const appWindow = getCurrentWindow();
      
      if (isCollapsed) {
        // 展开 - 恢复之前的高度
        await appWindow.setMinSize(new LogicalSize(280, 360));
        await appWindow.setSize(new LogicalSize(320, previousHeightRef.current));
        setIsCollapsed(false);
      } else {
        // 收起 - 先保存当前高度
        const size = await appWindow.innerSize();
        previousHeightRef.current = size.height;
        // 设置最小高度为收起高度，然后调整窗口大小
        await appWindow.setMinSize(new LogicalSize(280, COLLAPSED_HEIGHT));
        await appWindow.setSize(new LogicalSize(320, COLLAPSED_HEIGHT));
        setIsCollapsed(true);
      }
    } catch (error) {
      console.error('切换窗口状态失败:', error);
    }
  };

  // 切换同步状态：开启时主控=第一个选中，从控=其余选中；关闭时调用 stop_sync
  const toggleSync = async () => {
    if (isSyncing) {
      try {
        await invoke('stop_sync');
        setIsSyncing(false);
        setMasterEnvId(null);
      } catch (error) {
        console.error('停止同步失败:', error);
      }
      return;
    }
    const list = Array.from(selectedEnvs);
    if (list.length === 0) return;
    const master = list[0];
    const slaveEnvIds = list.slice(1);
    try {
      await invoke('start_sync', {
        params: {
          masterEnvId: master,
          slaveEnvIds,
        },
      });
      setIsSyncing(true);
      setMasterEnvId(master);
    } catch (error) {
      console.error('开启同步失败:', error);
    }
  };

  // 一键排列：将选中的环境 UUID 列表发送给 Tauri，由后端计算并下发布局指令
  const handleArrange = async () => {
    if (selectedEnvs.size === 0) return;

    try {
      // 调用后端一键排列命令，直接对这些环境下发窗口布局
      const envIds = Array.from(selectedEnvs);
      await invoke('arrange_environments', { envIds });

      // 为方便调试，在前端打印一下参与排列的环境列表
      console.log('[Syncer] Arrange environments:', envIds);
    } catch (error) {
      console.error('一键排列失败:', error);
    }
  };

  // 切换环境选择
  const toggleEnvSelection = (uuid: string) => {
    const newSelected = new Set(selectedEnvs);
    if (newSelected.has(uuid)) {
      newSelected.delete(uuid);
    } else {
      newSelected.add(uuid);
    }
    setSelectedEnvs(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedEnvs.size === environments.length) {
      setSelectedEnvs(new Set());
    } else {
      setSelectedEnvs(new Set(environments.map((e) => e.uuid)));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground select-none">
      {/* 标题栏 - 可拖拽 */}
      <header
        className="h-10 flex items-center justify-between px-3 border-b border-border bg-muted/50"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <MousePointer2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">同步器</span>
          {isSyncing && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded">
              同步中
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void toggleCollapse()}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors"
            title={isCollapsed ? '展开' : '收起'}
          >
            {isCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* 工具栏 - 收起时隐藏 */}
      <div className={`h-10 flex items-center justify-between px-3 border-b border-border ${isCollapsed ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void toggleSync()}
            disabled={!isSyncing && selectedEnvs.size === 0}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              isSyncing
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isSyncing ? (
              <>
                <Square className="h-3.5 w-3.5" />
                停止同步
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                开始同步
              </>
            )}
          </button>
          <button
            onClick={handleArrange}
            disabled={selectedEnvs.size === 0}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            title="一键排列已选浏览器窗口"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 环境列表 - 收起时隐藏 */}
      <div className={`flex-1 overflow-auto p-2 ${isCollapsed ? 'hidden' : ''}`}>
        {environments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MousePointer2 className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs">暂无运行中的浏览器</p>
            <p className="text-[10px] mt-1">请先在环境管理中启动浏览器</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* 全选按钮 */}
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={selectedEnvs.size === environments.length && environments.length > 0}
                onChange={toggleSelectAll}
                className="h-3.5 w-3.5 rounded border-muted-foreground/50"
              />
              <span>全选 ({selectedEnvs.size}/{environments.length})</span>
            </div>

            {/* 环境项 */}
            {environments.map((env) => (
              <div
                key={env.uuid}
                className={`flex items-center gap-2 px-2 py-2 rounded text-xs cursor-pointer transition-colors ${
                  selectedEnvs.has(env.uuid)
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-accent border border-transparent'
                }`}
                onClick={() => toggleEnvSelection(env.uuid)}
              >
                <input
                  type="checkbox"
                  checked={selectedEnvs.has(env.uuid)}
                  onChange={() => toggleEnvSelection(env.uuid)}
                  className="h-3.5 w-3.5 rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    {env.name}
                    {isSyncing && env.uuid === masterEnvId && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded">
                        主控
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 状态栏 - 收起时隐藏 */}
      <footer className={`h-6 flex items-center justify-between px-3 border-t border-border text-[10px] text-muted-foreground ${isCollapsed ? 'hidden' : ''}`}>
        <span>已选择 {selectedEnvs.size} 个浏览器</span>
        <span>{isSyncing ? '同步模式已启用' : '同步模式已关闭'}</span>
      </footer>
    </div>
  );
}
