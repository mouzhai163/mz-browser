import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { save } from '@tauri-apps/plugin-dialog';
import { ArrowLeft, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { getRpaRunDetail, listRpaRuns, type RpaRunDto } from '../api';
import type { RpaExtractedItem, RpaRunLogEntry } from '../runtime/execution-manager';
import { readRpaRunScreenshot } from '../runtime/tauri';
import { formatDuration } from '../lib/format';
import { RunStepLog } from './rpa-run-step-log';

const PAGE_SIZE = 50;
const BOM = String.fromCharCode(0xfeff);

interface RpaRunsDrawerProps {
  task: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}

function parseExtracted(summary?: string | null): RpaExtractedItem[] {
  if (!summary) return [];
  try {
    const parsed = JSON.parse(summary) as { extracted?: RpaExtractedItem[] };
    return Array.isArray(parsed.extracted) ? parsed.extracted : [];
  } catch {
    return [];
  }
}

/** 提取全部匹配项的结果是 JSON 数组，导出时一项一行 */
function listItems(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
  } catch {
    // 不是 JSON，就是普通文本
  }
  return [value];
}

function csvCell(value: string): string {
  // 以公式字符开头的内容加单引号，防止表格软件把页面提取到的内容当公式执行
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function statusClass(status: string): string {
  if (status === 'completed') return 'text-emerald-500 border-emerald-500/30';
  if (status === 'failed') return 'text-destructive border-destructive/30';
  if (status === 'running') return 'text-amber-500 border-amber-500/30';
  return 'text-muted-foreground';
}

export function RpaRunsDrawer({ task, onOpenChange }: RpaRunsDrawerProps) {
  const { t } = useTranslation('rpa');
  const [runs, setRuns] = useState<RpaRunDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<RpaRunDto | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const taskId = task?.id;

  const load = useCallback(
    async (id: string, page: number) => {
      setLoading(true);
      try {
        const result = await listRpaRuns(id, page, PAGE_SIZE);
        setRuns((current) => (page === 1 ? result.items : [...current, ...result.items]));
        setTotal(result.total);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setDetail(null);
    setScreenshot(null);
    setRuns([]);
    setTotal(0);
    if (taskId) void load(taskId, 1);
  }, [load, taskId]);

  const openDetail = async (run: RpaRunDto) => {
    try {
      setScreenshot(null);
      setDetail(await getRpaRunDetail(run.uuid));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const openScreenshot = async (file: string) => {
    if (!detail) return;
    try {
      setScreenshot(`data:image/png;base64,${await readRpaRunScreenshot(detail.task_uuid, detail.uuid, file)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const extracted = parseExtracted(detail?.result_summary);
  const logs = (Array.isArray(detail?.logs) ? detail.logs : []) as RpaRunLogEntry[];

  const exportCsv = async () => {
    if (!detail || extracted.length === 0) return;
    const filePath = await save({
      defaultPath: `${task?.name ?? 'rpa'}-${detail.uuid.slice(0, 8)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (!filePath) return;
    const header = [t('runs.csv.step'), t('runs.csv.variable'), t('runs.csv.value')];
    const rows = extracted.flatMap((item) => listItems(item.value).map((value) => [item.stepName, item.key, value]));
    // 带 BOM，Excel 才能正确识别中文
    const content = `${BOM}${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    try {
      await invoke('write_text_file', { path: filePath, content });
      toast.success(t('runs.exported'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const formatTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : '-');
  const statusLabel = (status: string) => t(`runs.status.${status}`);

  return (
    <Drawer open={task !== null} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="ml-auto h-full w-[620px] max-w-[92vw]">
        <DrawerHeader className="border-b border-border">
          <DrawerTitle className="flex items-center gap-2 text-sm">
            {detail ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={t('runs.back')}
                onClick={() => setDetail(null)}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <span className="truncate">{detail ? detail.environment_name || t('runs.detail') : t('runs.title')}</span>
          </DrawerTitle>
          <DrawerDescription className="truncate text-xs">{task?.name}</DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className={statusClass(detail.status)}>
                  {statusLabel(detail.status)}
                </Badge>
                <span>{t(`runs.trigger.${detail.trigger_source}`)}</span>
                <span>{formatTime(detail.started_at)}</span>
                <span>{formatDuration(detail.duration_ms)}</span>
              </div>
              {detail.error_message ? (
                <div className="break-all rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  {detail.error_message === 'INTERRUPTED' ? t('runs.interrupted') : detail.error_message}
                </div>
              ) : null}
              <RunStepLog entries={logs} onOpenScreenshot={(file) => void openScreenshot(file)} />
              {screenshot ? <img src={screenshot} alt="" className="block h-auto w-full rounded-md border border-border" /> : null}
              {extracted.length > 0 ? (
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold">{t('runs.extracted')}</h4>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void exportCsv()}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      {t('runs.exportCsv')}
                    </Button>
                  </div>
                  <ul className="space-y-1">
                    {extracted.map((item, index) => (
                      <li key={`${item.stepId}-${index}`} className="rounded-md border border-border/60 px-3 py-2 text-xs">
                        <div className="font-medium">{item.key || item.stepName}</div>
                        <div className="mt-0.5 break-all text-muted-foreground">{item.value}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : runs.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">{loading ? t('loading') : t('runs.empty')}</p>
          ) : (
            <div className="space-y-1">
              {runs.map((run) => (
                <button
                  key={run.uuid}
                  type="button"
                  onClick={() => void openDetail(run)}
                  className="flex w-full items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                >
                  <Badge variant="outline" className={`shrink-0 ${statusClass(run.status)}`}>
                    {statusLabel(run.status)}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate font-medium">{run.environment_name || '-'}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {run.completed_steps}/{run.total_steps}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{formatDuration(run.duration_ms)}</span>
                  <span className="shrink-0 text-muted-foreground">{formatTime(run.started_at)}</span>
                </button>
              ))}
              {runs.length < total && taskId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  disabled={loading}
                  onClick={() => void load(taskId, Math.floor(runs.length / PAGE_SIZE) + 1)}
                >
                  {t('runs.loadMore')}
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <DrawerFooter className="flex-row justify-end border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            {t('runs.close')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
