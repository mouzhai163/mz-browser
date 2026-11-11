import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { RunLogEntry, RunStatus } from '../components/task-editor/run-log-panel';
import type { StepRunInfo } from '../components/task-editor/step-list';
import { connectBoundRpaEnvironment } from '../runtime/bound-environment';
import type { BrowserAdapter } from '../runtime/browser-adapter';
import { createBrowserAdapter } from '../runtime/create-browser-adapter';
import { RpaDebugSession } from '../runtime/debug-session';
import { describeRunError, isStopError } from '../runtime/errors';
import { isEnvironmentBusy } from '../runtime/execution-manager';
import { RpaRunner, type RpaRunnerOptions, type RpaRunnerStepEvent } from '../runtime/runner';
import type { RpaCapturedSelector, RpaWorkflowSchema, RpaWorkflowStep } from '../types';

export interface StepPreview {
  value?: string;
  screenshot?: string;
}

function findWorkflowStep(steps: RpaWorkflowStep[], id: string): RpaWorkflowStep | null {
  for (const step of steps) {
    if (step.id === id) return step;
    for (const list of [step.then, step.else, step.body]) {
      const found = list ? findWorkflowStep(list, id) : null;
      if (found) return found;
    }
  }
  return null;
}

/** 编辑器里的运行：完整测试、单步、从某步开始、拾取元素，结果都留在编辑器里 */
export function useEditorRun(stepName: (id: string) => string) {
  const { t } = useTranslation('rpa');
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [log, setLog] = useState<RunLogEntry[]>([]);
  const [runInfo, setRunInfo] = useState<Record<string, StepRunInfo>>({});
  const [previews, setPreviews] = useState<Record<string, StepPreview>>({});
  const [picking, setPicking] = useState(false);
  const debug = useRef(new RpaDebugSession());
  const fullRun = useRef<BrowserAdapter | null>(null);
  const abort = useRef<AbortController | null>(null);
  const stepNameRef = useRef(stepName);
  stepNameRef.current = stepName;

  useEffect(() => {
    const session = debug.current;
    return () => {
      abort.current?.abort();
      fullRun.current?.close();
      session.dispose();
    };
  }, []);

  const busy = runStatus === 'starting' || runStatus === 'running' || runStatus === 'stopping';

  const handlers = useCallback((): RpaRunnerOptions => {
    const started = new Map<string, number>();
    const translate = (error: unknown) => describeRunError(error, t);
    return {
      signal: abort.current?.signal,
      onStepStatusChange: (event: RpaRunnerStepEvent) => {
        const error = event.error ? translate(event.error) : undefined;
        setRunStatus((status) => (status === 'starting' ? 'running' : status));
        setRunInfo((current) => ({
          ...current,
          [event.stepId]: {
            status: event.status,
            error,
            loopIteration: event.loopIteration ?? current[event.stepId]?.loopIteration,
            loopTotal: event.loopTotal ?? current[event.stepId]?.loopTotal,
          },
        }));
        setLog((current) => {
          if (event.status === 'running') {
            // 循环每一轮、条件选分支都会再发一次 running，只有第一次新开一行
            if (started.has(event.stepId)) return current;
            const startedAt = Date.now();
            started.set(event.stepId, startedAt);
            return [
              ...current,
              { key: `${event.stepId}-${startedAt}-${current.length}`, stepId: event.stepId, name: stepNameRef.current(event.stepId), status: 'running', startedAt },
            ];
          }
          const startedAt = started.get(event.stepId);
          started.delete(event.stepId);
          if (startedAt === undefined) {
            const now = Date.now();
            return [
              ...current,
              { key: `${event.stepId}-${now}-${current.length}`, stepId: event.stepId, name: stepNameRef.current(event.stepId), status: event.status, startedAt: now },
            ];
          }
          return current.map((entry) =>
            entry.stepId === event.stepId && entry.status === 'running'
              ? { ...entry, status: event.status, durationMs: Date.now() - startedAt, error }
              : entry
          );
        });
      },
      onDataExtracted: (event) => {
        setPreviews((current) => ({ ...current, [event.stepId]: { ...current[event.stepId], value: event.value } }));
        setLog((current) => {
          const index = current.map((entry) => entry.stepId).lastIndexOf(event.stepId);
          return index < 0 ? current : current.map((entry, i) => (i === index ? { ...entry, value: event.value } : entry));
        });
      },
      onScreenshotCaptured: (event) => {
        setPreviews((current) => ({
          ...current,
          [event.stepId]: { ...current[event.stepId], screenshot: `data:image/png;base64,${event.screenshot}` },
        }));
      },
    };
  }, [t]);

  const execute = useCallback(
    async (envUuid: string, work: () => Promise<void>) => {
      if (isEnvironmentBusy(envUuid)) {
        toast.warning(t('editor.errors.environmentBusy'));
        return;
      }
      abort.current = new AbortController();
      setLog([]);
      setRunInfo({});
      setRunStatus('starting');
      try {
        await work();
        setRunStatus('success');
      } catch (error) {
        if (isStopError(error) || abort.current?.signal.aborted) {
          setRunStatus('stopped');
        } else {
          setRunStatus('failed');
          toast.error(describeRunError(error, t));
        }
      } finally {
        fullRun.current = null;
      }
    },
    [t]
  );

  const runAll = useCallback(
    (workflow: RpaWorkflowSchema) =>
      execute(workflow.environments[0], async () => {
        // 完整测试从干净的状态开始，不沿用调试会话的页面和变量
        debug.current.dispose();
        const endpoint = await connectBoundRpaEnvironment(workflow.environments[0]);
        const adapter = createBrowserAdapter(endpoint.browser_ws_url || '');
        fullRun.current = adapter;
        await new RpaRunner(adapter).run(
          workflow,
          { envUuid: endpoint.env_uuid, browserWsUrl: endpoint.browser_ws_url || '' },
          handlers()
        );
      }),
    [execute, handlers]
  );

  const runStep = useCallback(
    (workflow: RpaWorkflowSchema, id: string) =>
      execute(workflow.environments[0], async () => {
        const step = findWorkflowStep(workflow.steps, id);
        if (step) await debug.current.runStep(workflow.environments[0], workflow, step, handlers());
      }),
    [execute, handlers]
  );

  const runFrom = useCallback(
    (workflow: RpaWorkflowSchema, id: string) =>
      execute(workflow.environments[0], () => debug.current.runFrom(workflow.environments[0], workflow, id, handlers())),
    [execute, handlers]
  );

  const stop = useCallback(() => {
    setRunStatus('stopping');
    abort.current?.abort();
    // 断开连接让正在等待的命令立刻结束；环境继续开着
    fullRun.current?.close();
    debug.current.dispose();
  }, []);

  const pick = useCallback(
    async (workflow: RpaWorkflowSchema): Promise<RpaCapturedSelector | null> => {
      setPicking(true);
      try {
        return await debug.current.pick(workflow.environments[0], workflow);
      } catch (error) {
        toast.error(describeRunError(error, t));
        return null;
      } finally {
        setPicking(false);
      }
    },
    [t]
  );

  const reset = useCallback(() => {
    setLog([]);
    setRunInfo({});
    setPreviews({});
    setRunStatus('idle');
  }, []);

  return { runStatus, busy, log, runInfo, previews, picking, runAll, runStep, runFrom, stop, pick, reset };
}
