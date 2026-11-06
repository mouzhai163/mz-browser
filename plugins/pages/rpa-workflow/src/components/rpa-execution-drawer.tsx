import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { AlertCircle, CheckCircle2, Clock3, Loader2, PlayCircle, Square, X } from 'lucide-react';
import type { RpaExecutionState } from '../hooks/use-rpa-execution';
import { RpaExecutionGraph } from './rpa-execution-graph';

interface RpaExecutionDrawerProps {
  open: boolean;
  execution: RpaExecutionState | null;
  onOpenChange: (open: boolean) => void;
  onStop: () => Promise<void> | void;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'running':
      return '执行中';
    case 'stopping':
      return '停止中';
    case 'success':
      return '已完成';
    case 'failed':
      return '失败';
    case 'stopped':
      return '已停止';
    case 'starting':
      return '启动中';
    case 'awaiting_input':
      return '等待操作';
    case 'pending':
      return '等待中';
    default:
      return status;
  }
}

function formatTime(value?: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function RpaExecutionDrawer({ open, execution, onOpenChange, onStop }: RpaExecutionDrawerProps) {
  const latestError = execution?.environmentRuns.find((item) => item.error)?.error;
  const activeEnvironment =
    execution?.environmentRuns.find((item) => item.envUuid === execution.currentEnvUuid) ?? execution?.environmentRuns[0];

  return (
    <Drawer open={open} direction="right" onOpenChange={onOpenChange}>
      <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-[48vw] my-auto mr-4 rounded-md max-w-[1100px] h-[96%] gap-0 p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 px-5 py-4 border-b border-border/50">
          <DrawerHeader className="space-y-1 p-0">
            <DrawerTitle className="text-base font-semibold flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-blue-500" />
              {execution?.taskName || '执行任务'}
              {execution ? <Badge variant="outline">{statusLabel(execution.status)}</Badge> : null}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground">
              当前步骤：{execution?.currentStepName || '等待开始'}
            </DrawerDescription>
          </DrawerHeader>
        </div>

        <div className="p-4 space-y-3 flex-1 min-h-0 overflow-hidden flex flex-col">
          <RpaExecutionGraph
            steps={execution?.workflow.steps ?? []}
            currentStepId={execution?.currentStepId}
            activeEnvironment={activeEnvironment}
          />

          {latestError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">最近错误</div>
                <div className="mt-0.5 break-all">{latestError}</div>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-border/50 overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="px-4 py-3 border-b border-border/50 bg-muted/20 text-xs font-medium text-muted-foreground">
              环境执行状态
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
              {execution?.environmentRuns.map((item) => (
                <div key={item.envUuid} className="rounded-lg border border-border/50 bg-background px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        当前步骤：{item.currentStepName || '等待开始'}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        更新时间：{formatTime(item.finishedAt || item.startedAt)}
                      </div>
                      {item.error ? <div className="mt-2 text-xs text-destructive break-all">{item.error}</div> : null}
                    </div>
                    <Badge variant="outline" className="shrink-0 gap-1">
                      {item.status === 'success' ? <CheckCircle2 className="h-3 w-3" /> : null}
                      {item.status === 'running' || item.status === 'starting' || item.status === 'awaiting_input' ? (
                        <Clock3 className="h-3 w-3" />
                      ) : null}
                      {statusLabel(item.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DrawerFooter className="px-5 py-3 bg-muted/30 border-t border-border/50 gap-2 flex-row items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="mr-1.5 h-4 w-4" />
            关闭
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void onStop()}
            disabled={
              !execution ||
              execution.status === 'stopping' ||
              execution.status === 'success' ||
              execution.status === 'failed' ||
              execution.status === 'stopped'
            }
          >
            {execution?.status === 'stopping' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Square className="mr-1.5 h-4 w-4" />
            )}
            停止执行
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
