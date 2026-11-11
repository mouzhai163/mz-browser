import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, CircleSlash, Image as ImageIcon, Loader2, SkipForward } from 'lucide-react';
import { formatDuration } from '../lib/format';
import type { RpaRunLogEntry } from '../runtime/execution-manager';

function StepIcon({ status }: { status: RpaRunLogEntry['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />;
    case 'skipped':
      return <SkipForward className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    case 'stopped':
      return <CircleSlash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    default:
      return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />;
  }
}

/** 按执行顺序显示每一步：耗时、提取值、错误。运行进度和运行记录共用 */
export function RunStepLog({
  entries,
  onOpenScreenshot,
}: {
  entries: RpaRunLogEntry[];
  onOpenScreenshot?: (file: string) => void;
}) {
  const { t } = useTranslation('rpa');

  if (entries.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">{t('runs.noSteps')}</p>;
  }

  return (
    <ol className="space-y-1">
      {entries.map((entry, index) => (
        <li key={`${entry.stepId}-${index}`} className="rounded-md border border-border/60 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <StepIcon status={entry.status} />
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            {entry.screenshot && onOpenScreenshot ? (
              <button
                type="button"
                title={t('runs.viewScreenshot')}
                aria-label={t('runs.viewScreenshot')}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onOpenScreenshot(entry.screenshot!)}
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <span className="shrink-0 text-muted-foreground">{formatDuration(entry.durationMs)}</span>
          </div>
          {entry.value ? <div className="mt-1 break-all pl-5 text-muted-foreground">{entry.value}</div> : null}
          {entry.error ? <div className="mt-1 break-all pl-5 text-destructive">{entry.error}</div> : null}
        </li>
      ))}
    </ol>
  );
}
