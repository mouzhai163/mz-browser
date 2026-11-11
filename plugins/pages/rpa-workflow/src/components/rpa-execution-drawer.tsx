import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, CircleSlash, Clock3, Loader2, RotateCw, Square, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import type { RpaEnvRun, RpaExecution } from '../runtime/execution-manager';
import { RunStepLog } from './rpa-run-step-log';

interface RpaExecutionDrawerProps {
  open: boolean;
  execution: RpaExecution | null;
  onOpenChange: (open: boolean) => void;
  onStop: () => void;
}

function StatusIcon({ status }: { status: RpaEnvRun['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    case 'stopped':
      return <CircleSlash className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'retrying':
      return <RotateCw className="h-3.5 w-3.5 text-amber-500" />;
    case 'pending':
      return <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  }
}

export function RpaExecutionDrawer({ open, execution, onOpenChange, onStop }: RpaExecutionDrawerProps) {
  const { t } = useTranslation('rpa');
  const [selected, setSelected] = useState<{ taskId: string; envUuid: string } | null>(null);
  const taskId = execution?.taskId;
  const selectedEnv = selected?.taskId === taskId ? selected?.envUuid : null;

  // 没手动选时跟着正在运行的环境走
  const shown =
    execution?.environments.find((env) => env.envUuid === selectedEnv) ??
    execution?.environments.find((env) => env.status === 'running' || env.status === 'starting' || env.status === 'retrying') ??
    execution?.environments[0];
  const active = execution?.status === 'running' || execution?.status === 'stopping';

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="ml-auto h-full w-[560px] max-w-[92vw]">
        <DrawerHeader className="border-b border-border">
          <DrawerTitle className="flex items-center gap-2 text-sm">
            <span className="truncate">{execution?.taskName}</span>
            {execution ? (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {t(`execution.status.${execution.status}`)}
              </Badge>
            ) : null}
          </DrawerTitle>
          <DrawerDescription className="text-xs">
            {execution ? t(`runs.trigger.${execution.trigger}`) : ''}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
          <div className="max-h-48 shrink-0 space-y-1 overflow-y-auto">
            {execution?.environments.map((env) => (
              <button
                key={env.envUuid}
                type="button"
                onClick={() => setSelected({ taskId: execution.taskId, envUuid: env.envUuid })}
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  shown?.envUuid === env.envUuid ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-accent'
                }`}
              >
                <StatusIcon status={env.status} />
                <span className="min-w-0 flex-1 truncate font-medium">{env.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {env.currentStepName || t(`execution.envStatus.${env.status}`)}
                </span>
                {env.attempt > 1 ? (
                  <span className="shrink-0 text-amber-500">{t('execution.attempt', { count: env.attempt })}</span>
                ) : null}
              </button>
            ))}
          </div>

          {shown?.error ? (
            <div className="shrink-0 break-all rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {shown.error}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <RunStepLog entries={shown?.log ?? []} />
          </div>
        </div>

        <DrawerFooter className="flex-row justify-end border-t border-border">
          {active ? (
            <Button variant="outline" size="sm" disabled={execution?.status === 'stopping'} onClick={onStop}>
              <Square className="mr-1.5 h-3.5 w-3.5" />
              {t(execution?.status === 'stopping' ? 'execution.status.stopping' : 'table.actions.stop')}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            {t('runs.close')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
