import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleSlash,
  Loader2,
  Square,
} from 'lucide-react';

export type RunStatus = 'idle' | 'starting' | 'running' | 'success' | 'failed' | 'stopping' | 'stopped';

export interface RunLogEntry {
  key: string;
  stepId: string;
  name: string;
  status: 'running' | 'success' | 'failed' | 'skipped' | 'stopped';
  startedAt: number;
  durationMs?: number;
  error?: string;
  value?: string;
  loopIteration?: number;
}

function StatusIcon({ status }: { status: RunLogEntry['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    case 'skipped':
      return <CircleSlash className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'stopped':
      return <Square className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  }
}

const clock = (time: number) => new Date(time).toLocaleTimeString([], { hour12: false });
const duration = (ms?: number) => (ms === undefined ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

/** 按执行顺序列出每一步的时间、耗时、结果 */
export function RunLogPanel({
  entries,
  runStatus,
  onSelectStep,
}: {
  entries: RunLogEntry[];
  runStatus: RunStatus;
  onSelectStep: (id: string) => void;
}) {
  const { t } = useTranslation('rpa');
  const [open, setOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const [lastStatus, setLastStatus] = useState(runStatus);
  if (lastStatus !== runStatus) {
    setLastStatus(runStatus);
    if (runStatus === 'starting' || runStatus === 'running' || runStatus === 'failed') setOpen(true);
  }

  useEffect(() => {
    if (open && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [entries.length, open]);

  const counts = useMemo(
    () => ({
      success: entries.filter((entry) => entry.status === 'success').length,
      failed: entries.filter((entry) => entry.status === 'failed').length,
    }),
    [entries]
  );

  if (runStatus === 'idle' && entries.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-full items-center justify-between px-4 text-xs hover:bg-muted"
      >
        <span className="flex items-center gap-3">
          <span className="font-semibold text-foreground">{t('editor.runLog.title')}</span>
          <span className="text-foreground">{t(`editor.runLog.status.${runStatus}`)}</span>
          <span className="text-muted-foreground">
            {t('editor.runLog.summary', { success: counts.success, failed: counts.failed })}
          </span>
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {open ? (
        <div ref={scroller} className="max-h-48 overflow-y-auto border-t border-border">
          {entries.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">{t('editor.runLog.empty')}</div>
          ) : (
            entries.map((entry) => (
              <button
                type="button"
                key={entry.key}
                onClick={() => onSelectStep(entry.stepId)}
                className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-1.5 text-left text-xs last:border-b-0 hover:bg-muted"
              >
                <span className="mt-0.5 shrink-0">
                  <StatusIcon status={entry.status} />
                </span>
                <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{clock(entry.startedAt)}</span>
                <span className="w-44 shrink-0 truncate text-foreground">
                  {entry.name}
                  {entry.loopIteration ? ` #${entry.loopIteration}` : ''}
                </span>
                <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{duration(entry.durationMs)}</span>
                <span
                  className={`min-w-0 flex-1 break-words ${entry.error ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {entry.error ?? entry.value ?? ''}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
