import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Circle, Loader2 } from 'lucide-react';

export interface RunLogItem {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'awaiting_input' | 'success' | 'failed';
  error?: string;
  loopIteration?: number;
  loopTotal?: number;
}

interface RunLogPanelProps {
  items: RunLogItem[];
  runStatus: 'idle' | 'starting' | 'running' | 'success' | 'failed' | 'stopping' | 'stopped';
  onSelectStep: (id: string) => void;
}

function StatusIcon({ status }: { status: RunLogItem['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    case 'running':
    case 'awaiting_input':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground/60" />;
  }
}

/**
 * 画布下方的运行日志：运行状态原来只显示在节点上，这里按步骤列成一张表，
 * 失败原因一眼可见，点一行可以定位到对应节点。
 */
export function RunLogPanel({ items, runStatus, onSelectStep }: RunLogPanelProps) {
  const { t } = useTranslation('rpa');
  const [open, setOpen] = useState(false);
  const active = runStatus !== 'idle';

  // 开始运行时自动展开；失败时保持展开
  useEffect(() => {
    if (runStatus === 'starting' || runStatus === 'running' || runStatus === 'failed') {
      setOpen(true);
    }
  }, [runStatus]);

  const counts = useMemo(
    () => ({
      success: items.filter((item) => item.status === 'success').length,
      failed: items.filter((item) => item.status === 'failed').length,
    }),
    [items]
  );

  if (!active && items.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-full items-center justify-between px-4 text-xs hover:bg-muted"
      >
        <span className="flex items-center gap-3">
          <span className="font-semibold text-foreground">
            {t('editor.runLog.title', { defaultValue: '运行日志' })}
          </span>
          <span className="text-muted-foreground">
            {t('editor.runLog.summary', {
              defaultValue: '成功 {{success}} · 失败 {{failed}}',
              success: counts.success,
              failed: counts.failed,
            })}
          </span>
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {open ? (
        <div className="max-h-44 overflow-y-auto border-t border-border">
          {items.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              {t('editor.runLog.empty', { defaultValue: '运行后这里会列出每一步的结果' })}
            </div>
          ) : (
            items.map((item, index) => (
              <button
                type="button"
                key={`${item.id}-${index}`}
                onClick={() => onSelectStep(item.id)}
                className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-1.5 text-left text-xs last:border-b-0 hover:bg-muted"
              >
                <span className="mt-0.5 shrink-0">
                  <StatusIcon status={item.status} />
                </span>
                <span className="w-6 shrink-0 text-muted-foreground">{index + 1}</span>
                <span className="w-48 shrink-0 truncate text-foreground">{item.name}</span>
                {item.loopTotal ? (
                  <span className="shrink-0 text-muted-foreground">
                    {item.loopIteration ?? 0}/{item.loopTotal}
                  </span>
                ) : null}
                {item.error ? (
                  <span className="min-w-0 flex-1 break-words text-destructive">{item.error}</span>
                ) : (
                  <span className="flex-1" />
                )}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
