import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Loader2,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createProxy } from '../api';
import { selectAndReadProxyFile } from '../utils/import-export';

interface ProxyBatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

interface ParsedProxyRow {
  id: number;
  type: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username: string;
  password: string;
  remark: string;
  valid: boolean;
  error?: string;
  checkStatus: 'idle' | 'testing' | 'healthy' | 'failed';
  exitIp?: string;
  country?: string;
  city?: string;
  latencyMs?: number;
  checkError?: string;
}

interface BackendProxyTestResult {
  success: boolean;
  latency_ms?: number | null;
  error?: string | null;
  ip_info?: {
    ip?: string;
    country?: string;
    country_code?: string;
    city?: string;
  } | null;
}

const PLACEHOLDER_TEXT = [
  'http://user:pass@ip:port {备注}',
  'https://user:pass@ip:port {备注}',
  'socks5://user:pass@ip:port {备注}',
  '每行一个，备注跟在代理后面用空格分隔',
].join('\n');

function parseProxyLines(rawText: string): ParsedProxyRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  return lines.map((line, index) => {
    const firstSpace = line.search(/\s+/);
    const addrPart = firstSpace === -1 ? line : line.slice(0, firstSpace).trim();
    const remark = firstSpace === -1 ? '' : line.slice(firstSpace).trim();

    const makeInvalid = (error: string): ParsedProxyRow => ({
      id: index + 1,
      type: 'http',
      host: addrPart,
      port: 0,
      username: '',
      password: '',
      remark,
      valid: false,
      error,
      checkStatus: 'idle',
    });

    // 格式 1: scheme://[user:pass@]host:port
    const schemeMatch = addrPart.match(/^(https?|socks5h?|socks):\/\/(.+)$/i);
    if (schemeMatch) {
      const rawScheme = schemeMatch[1].toLowerCase();
      const type: 'http' | 'https' | 'socks5' =
        rawScheme.startsWith('socks') ? 'socks5' : rawScheme === 'https' ? 'https' : 'http';
      const rest = schemeMatch[2].replace(/\/+$/, '');

      let username = '';
      let password = '';
      let hostPort = rest;

      const atIdx = rest.lastIndexOf('@');
      if (atIdx !== -1) {
        const authPart = rest.slice(0, atIdx);
        hostPort = rest.slice(atIdx + 1);
        const colonIdx = authPart.indexOf(':');
        if (colonIdx !== -1) {
          username = decodeSafe(authPart.slice(0, colonIdx));
          password = decodeSafe(authPart.slice(colonIdx + 1));
        } else {
          username = decodeSafe(authPart);
        }
      }

      const hp = splitHostPort(hostPort);
      if (!hp) return makeInvalid('地址或端口格式无效');
      return {
        id: index + 1,
        type,
        host: hp.host,
        port: hp.port,
        username,
        password,
        remark,
        valid: true,
        checkStatus: 'idle',
      };
    }

    // 格式 2: host:port[:user:pass]
    const parts = addrPart.split(':');
    if (parts.length === 2 || parts.length === 4) {
      const host = parts[0].trim();
      const port = Number(parts[1]);
      if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
        return makeInvalid('地址或端口格式无效');
      }
      return {
        id: index + 1,
        type: 'http',
        host,
        port,
        username: parts[2]?.trim() || '',
        password: parts[3]?.trim() || '',
        remark,
        valid: true,
        checkStatus: 'idle',
      };
    }

    return makeInvalid('无法识别代理格式');
  });
}

function splitHostPort(input: string): { host: string; port: number } | null {
  const cleaned = input.trim();
  let host = '';
  let portStr = '';
  if (cleaned.startsWith('[')) {
    const idx = cleaned.lastIndexOf(']:');
    if (idx === -1) return null;
    host = cleaned.slice(1, idx);
    portStr = cleaned.slice(idx + 2);
  } else {
    const idx = cleaned.lastIndexOf(':');
    if (idx === -1) return null;
    host = cleaned.slice(0, idx);
    portStr = cleaned.slice(idx + 1);
  }
  const port = Number(portStr);
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return { host, port };
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function ProxyBatchImportDialog({
  open,
  onOpenChange,
  onComplete,
}: ProxyBatchImportDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawText, setRawText] = useState('');
  const [rows, setRows] = useState<ParsedProxyRow[]>([]);
  const [testingAll, setTestingAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validRows = useMemo(() => rows.filter((r) => r.valid), [rows]);
  const failedOrInvalidCount = useMemo(
    () => rows.filter((r) => !r.valid || r.checkStatus === 'failed').length,
    [rows]
  );

  const resetAll = () => {
    setStep(1);
    setRawText('');
    setRows([]);
    setTestingAll(false);
    setSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (testingAll || submitting)) return;
    if (!nextOpen) resetAll();
    onOpenChange(nextOpen);
  };

  const handleParseList = () => {
    const parsed = parseProxyLines(rawText);
    if (parsed.length === 0) {
      toast.warning('请先输入至少一条代理内容');
      return;
    }
    setRows(parsed);
    setStep(2);
  };

  const handleImportFromFile = async () => {
    const fileItems = await selectAndReadProxyFile();
    if (!fileItems || fileItems.length === 0) return;

    const converted: ParsedProxyRow[] = fileItems.map((item, idx) => ({
      id: idx + 1,
      type:
        item.type === 'https' || item.type === 'socks5'
          ? item.type
          : 'http',
      host: item.host,
      port: Number(item.port) || 0,
      username: item.username || '',
      password: item.password || '',
      remark: item.name && item.name !== `${item.host}:${item.port}` ? item.name : '',
      valid: item.valid,
      error: item.error,
      checkStatus: 'idle',
    }));

    setRows(converted);
    setStep(2);
    toast.success(`已从文件读取 ${converted.length} 条代理`);
  };

  const handleCleanProxies = () => {
    if (step === 1) {
      setRawText('');
      return;
    }
    if (failedOrInvalidCount > 0) {
      setRows((prev) => prev.filter((r) => r.valid && r.checkStatus !== 'failed'));
      toast.success(`已清理 ${failedOrInvalidCount} 条无效或不可用代理`);
    } else {
      setRows([]);
      setRawText('');
      setStep(1);
      toast.info('已清空代理列表');
    }
  };

  const handleDetectAll = async () => {
    if (validRows.length === 0 || testingAll) return;
    setTestingAll(true);

    setRows((prev) =>
      prev.map((row) => (row.valid ? { ...row, checkStatus: 'testing', checkError: undefined } : row))
    );

    const queue = [...validRows];
    const concurrency = 4;

    const worker = async () => {
      while (queue.length > 0) {
        const target = queue.shift();
        if (!target) break;

        try {
          const result = await invoke<BackendProxyTestResult>('test_proxy', {
            config: {
              proxy_type: target.type,
              host: target.host,
              port: target.port,
              username: target.username || null,
              password: target.password ? { value: target.password, encrypted: false } : null,
            },
          });

          setRows((prev) =>
            prev.map((row) => {
              if (row.id !== target.id) return row;
              if (result.success) {
                return {
                  ...row,
                  checkStatus: 'healthy',
                  exitIp: result.ip_info?.ip,
                  country: result.ip_info?.country || result.ip_info?.country_code,
                  city: result.ip_info?.city,
                  latencyMs: result.latency_ms ?? undefined,
                  checkError: undefined,
                };
              }
              return {
                ...row,
                checkStatus: 'failed',
                checkError: result.error || '连接失败',
              };
            })
          );
        } catch (err) {
          setRows((prev) =>
            prev.map((row) =>
              row.id === target.id
                ? {
                    ...row,
                    checkStatus: 'failed',
                    checkError: err instanceof Error ? err.message : String(err),
                  }
                : row
            )
          );
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
    setTestingAll(false);
    setStep(3);
  };

  const handleSubmitImport = async () => {
    const candidates = rows.filter((r) => r.valid);
    if (candidates.length === 0) {
      toast.warning('没有可导入的有效代理');
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    for (const row of candidates) {
      try {
        await createProxy({
          name: row.remark || `${row.host}:${row.port}`,
          host: row.host,
          port: row.port,
          proxy_type: row.type,
          username: row.username || undefined,
          password: row.password || undefined,
          country: row.country || undefined,
        });
        successCount += 1;
      } catch {
        // 单条失败继续导入其余条
      }
    }

    setSubmitting(false);
    if (successCount > 0) {
      toast.success(`成功导入 ${successCount} 条代理`);
      resetAll();
      onOpenChange(false);
      onComplete?.();
    } else {
      toast.error('代理导入失败，请检查代理格式或稍后重试');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl gap-5 p-6">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base font-semibold">批量导入</DialogTitle>
          {step === 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mr-6 h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => void handleImportFromFile()}
            >
              <FileUp className="mr-1.5 h-3.5 w-3.5" />
              导入 CSV / JSON 文件
            </Button>
          )}
        </DialogHeader>

        {/* 顶部三步向导条 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { num: 1 as const, label: '1 解析列表' },
            { num: 2 as const, label: '2 检测归属地' },
            { num: 3 as const, label: '3 提交导入' },
          ].map((item) => {
            const active = step === item.num;
            const completed = step > item.num;
            return (
              <button
                key={item.num}
                type="button"
                disabled={item.num > 1 && rows.length === 0}
                onClick={() => {
                  if (item.num === 1 || rows.length > 0) setStep(item.num);
                }}
                className={cn(
                  'flex h-10 items-center justify-center rounded-xl border text-sm font-medium transition-all',
                  active
                    ? 'border-violet-400/70 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                    : completed
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                      : 'border-border/70 bg-background text-muted-foreground'
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* 主体内容区 */}
        {step === 1 ? (
          <div className="relative pt-1">
            <span className="pointer-events-none absolute -top-1.5 left-3.5 z-10 bg-background px-1.5 text-xs font-medium text-muted-foreground">
              代理内容
            </span>
            <textarea
              rows={11}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={PLACEHOLDER_TEXT}
              className="w-full resize-none rounded-xl border border-border/80 bg-background px-4 py-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/75 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
              <span>
                共解析 <strong className="text-foreground">{rows.length}</strong> 条，有效{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">{validRows.length}</strong>{' '}
                条
                {failedOrInvalidCount > 0 && (
                  <>
                    ，异常{' '}
                    <strong className="text-rose-600 dark:text-rose-400">
                      {failedOrInvalidCount}
                    </strong>{' '}
                    条
                  </>
                )}
              </span>
              <button
                type="button"
                className="text-violet-600 hover:underline dark:text-violet-400"
                onClick={() => setStep(1)}
              >
                返回编辑文本
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/60 text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 font-medium">协议</th>
                    <th className="px-3 py-2 font-medium">代理地址</th>
                    <th className="px-3 py-2 font-medium">备注</th>
                    <th className="px-3 py-2 font-medium">归属地 / 出口 IP</th>
                    <th className="px-3 py-2 font-medium">状态</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-accent/30">
                      <td className="px-3 py-2 font-mono uppercase text-muted-foreground">
                        {row.type}
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground">
                        {row.valid ? `${row.host}:${row.port}` : row.host}
                        {row.username && (
                          <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                            认证
                          </span>
                        )}
                      </td>
                      <td className="max-w-32 truncate px-3 py-2 text-muted-foreground">
                        {row.remark || '-'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.country || row.exitIp ? (
                          <span>
                            {[row.country, row.city].filter(Boolean).join(' · ')}
                            {row.exitIp && (
                              <span className="ml-1 font-mono opacity-75">({row.exitIp})</span>
                            )}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {!row.valid ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {row.error || '格式错误'}
                          </span>
                        ) : row.checkStatus === 'testing' ? (
                          <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            检测中
                          </span>
                        ) : row.checkStatus === 'healthy' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {row.latencyMs != null ? `${row.latencyMs}ms` : '可用'}
                          </span>
                        ) : row.checkStatus === 'failed' ? (
                          <span
                            className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"
                            title={row.checkError}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            不可用
                          </span>
                        ) : (
                          <span className="text-muted-foreground">待检测</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="移除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 底部操作栏（对照图 1） */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          <Button
            type="button"
            variant="outline"
            className="rounded-full px-4 text-xs"
            disabled={testingAll || submitting || (step === 1 && !rawText.trim())}
            onClick={handleParseList}
          >
            解析列表
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full px-4 text-xs"
            disabled={testingAll || submitting || (step === 1 ? !rawText.trim() : rows.length === 0)}
            onClick={handleCleanProxies}
          >
            清理代理IP
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full px-4 text-xs"
            disabled={testingAll || submitting || validRows.length === 0}
            onClick={() => void handleDetectAll()}
          >
            {testingAll ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-3.5 w-3.5" />
            )}
            {testingAll ? '检测中...' : '检测全部'}
          </Button>
          <Button
            type="button"
            className="rounded-full bg-violet-600 px-5 text-xs text-white hover:bg-violet-700"
            disabled={testingAll || submitting || validRows.length === 0}
            onClick={() => void handleSubmitImport()}
          >
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            提交导入
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
