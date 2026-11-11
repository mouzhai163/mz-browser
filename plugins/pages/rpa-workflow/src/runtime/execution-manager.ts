import i18n from 'i18next';
import { createStore } from 'zustand/vanilla';
import { stopEnvironmentRuntime, getEnvironmentDetail, startEnvironmentRuntime } from '../../../../services/environment/src';
import { finishRpaRun, getRpaTaskDetail, setRpaTaskStatus, startRpaRun } from '../api';
import { mapTaskDetailToEditorState } from '../components/task-editor/workflow-mapper';
import { countSteps, findStep, type EditorStep } from '../lib/step-tree';
import type { RpaWorkflowSchema } from '../types';
import { waitForCdpEndpoint } from './bound-environment';
import type { BrowserAdapter } from './browser-adapter';
import { createBrowserAdapter } from './create-browser-adapter';
import { describeRunError, isStopError, RpaError } from './errors';
import { RpaRunner, type RpaRunnerStepEvent } from './runner';
import {
  deleteRpaRunFiles,
  getEnvironmentStatus,
  saveRpaRunScreenshot,
  sendRpaNotification,
} from './tauri';
import { validateSteps } from './validate-workflow';

export type RpaExecutionStatus = 'running' | 'stopping' | 'success' | 'failed' | 'stopped';
export type RpaEnvRunStatus = 'pending' | 'starting' | 'running' | 'retrying' | 'success' | 'failed' | 'stopped';
export type RpaTriggerSource = 'manual' | 'scheduled' | 'mcp';

export interface RpaRunLogEntry {
  stepId: string;
  name: string;
  type: string;
  status: RpaRunnerStepEvent['status'];
  attempt: number;
  startedAt: number;
  durationMs?: number;
  error?: string;
  value?: string;
  screenshot?: string;
}

export interface RpaExtractedItem {
  stepId: string;
  stepName: string;
  key: string;
  value: string;
}

export interface RpaEnvRun {
  envUuid: string;
  name: string;
  status: RpaEnvRunStatus;
  attempt: number;
  currentStepName?: string;
  error?: string;
  log: RpaRunLogEntry[];
}

export interface RpaExecution {
  taskId: string;
  taskName: string;
  status: RpaExecutionStatus;
  trigger: RpaTriggerSource;
  startedAt: number;
  finishedAt?: number;
  environments: RpaEnvRun[];
}

interface ExecutionState {
  executions: Record<string, RpaExecution>;
  /** 每次有任务开始或结束都加一，列表页据此刷新 */
  revision: number;
  /** 任务被 MCP 修改的时间，打开着的编辑器据此重新加载 */
  externalEdits: Record<string, number>;
}

/** 模块级：离开页面后运行和状态都还在 */
export const rpaExecutionStore = createStore<ExecutionState>(() => ({
  executions: {},
  revision: 0,
  externalEdits: {},
}));

/** 任务在编辑器之外被修改（MCP）后调用 */
export function markRpaTaskEdited(taskId: string): void {
  rpaExecutionStore.setState((state) => ({
    revision: state.revision + 1,
    externalEdits: { ...state.externalEdits, [taskId]: Date.now() },
  }));
}

interface ActiveExecution {
  controller: AbortController;
}

const active = new Map<string, ActiveExecution>();

/** 同一个环境同一时间只被一个运行占用，后来的排队 */
const busyEnvironments = new Set<string>();
const environmentWaiters = new Map<string, Array<() => void>>();

export function isEnvironmentBusy(envUuid: string): boolean {
  return busyEnvironments.has(envUuid);
}

async function acquireEnvironment(envUuid: string, signal: AbortSignal): Promise<void> {
  while (busyEnvironments.has(envUuid)) {
    await new Promise<void>((resolve) => {
      const waiters = environmentWaiters.get(envUuid) ?? [];
      waiters.push(resolve);
      environmentWaiters.set(envUuid, waiters);
      signal.addEventListener('abort', () => resolve(), { once: true });
    });
    if (signal.aborted) throw new RpaError('RUN_STOPPED');
  }
  busyEnvironments.add(envUuid);
}

function releaseEnvironment(envUuid: string): void {
  busyEnvironments.delete(envUuid);
  const waiters = environmentWaiters.get(envUuid) ?? [];
  environmentWaiters.delete(envUuid);
  for (const wake of waiters) wake();
}

function translate(key: string, options?: Record<string, unknown>): string {
  return i18n.getFixedT(null, 'rpa')(key, options ?? {}) as string;
}

function describe(error: unknown): string {
  return describeRunError(error, translate);
}

function patchExecution(taskId: string, patch: (execution: RpaExecution) => RpaExecution): void {
  rpaExecutionStore.setState((state) => {
    const current = state.executions[taskId];
    return current ? { executions: { ...state.executions, [taskId]: patch(current) } } : state;
  });
}

function patchEnv(taskId: string, envUuid: string, patch: (env: RpaEnvRun) => RpaEnvRun): void {
  patchExecution(taskId, (execution) => ({
    ...execution,
    environments: execution.environments.map((env) => (env.envUuid === envUuid ? patch(env) : env)),
  }));
}

function bumpRevision(): void {
  rpaExecutionStore.setState((state) => ({ revision: state.revision + 1 }));
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new RpaError('RUN_STOPPED'));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
}

interface RunPlan {
  taskId: string;
  trigger: RpaTriggerSource;
  workflow: RpaWorkflowSchema;
  steps: EditorStep[];
  closeBrowser: boolean;
}

type EnvOutcome = 'success' | 'failed' | 'stopped';

/** 在一个环境上跑完这个任务（含重试），并写入一条运行记录 */
async function runOnEnvironment(plan: RunPlan, envUuid: string, signal: AbortSignal): Promise<EnvOutcome> {
  const { taskId, workflow } = plan;
  const { retry_count: retryCount, retry_interval_seconds: retryInterval, timeout_seconds: timeoutSeconds } = workflow.settings;

  let holdsEnvironment = false;
  let startedByRun = false;
  let runUuid: string | null = null;
  let log: RpaRunLogEntry[] = [];
  let extracted: RpaExtractedItem[] = [];
  const pendingScreenshots: Array<Promise<void>> = [];
  const startedAt = Date.now();
  let outcome: EnvOutcome = 'failed';
  let errorMessage: string | undefined;

  const publishLog = () => patchEnv(taskId, envUuid, (env) => ({ ...env, log: [...log] }));

  try {
    await acquireEnvironment(envUuid, signal);
    holdsEnvironment = true;

    const detail = await getEnvironmentDetail(envUuid);
    const name = detail.environment?.name?.trim() || envUuid;
    patchEnv(taskId, envUuid, (env) => ({ ...env, name, status: 'starting', error: undefined }));

    const started = await startRpaRun({
      task_uuid: taskId,
      environment_uuid: envUuid,
      environment_name: name,
      trigger_source: plan.trigger,
      total_steps: countSteps(plan.steps),
    });
    runUuid = started.uuid;
    bumpRevision();
    if (started.pruned.length > 0) void deleteRpaRunFiles(taskId, started.pruned).catch(() => undefined);

    for (let attempt = 1; ; attempt += 1) {
      // 每次重试都从头开始，日志只保留最后一次
      log = [];
      extracted = [];
      const runningRows = new Map<string, RpaRunLogEntry>();
      const attemptController = new AbortController();
      const abortAttempt = () => attemptController.abort();
      signal.addEventListener('abort', abortAttempt, { once: true });
      let timedOut = false;
      let adapter: BrowserAdapter | null = null;
      const timer =
        timeoutSeconds > 0
          ? window.setTimeout(() => {
              timedOut = true;
              attemptController.abort();
              adapter?.close();
            }, timeoutSeconds * 1000)
          : undefined;
      const closeOnStop = () => adapter?.close();
      signal.addEventListener('abort', closeOnStop, { once: true });

      try {
        patchEnv(taskId, envUuid, (env) => ({ ...env, status: 'starting', attempt, log: [], error: undefined }));

        if ((await getEnvironmentStatus(envUuid)) !== 'running') {
          await startEnvironmentRuntime(envUuid);
          startedByRun = true;
        }
        if (attemptController.signal.aborted) throw new RpaError('RUN_STOPPED');

        const endpoint = await waitForCdpEndpoint(envUuid);
        adapter = createBrowserAdapter(endpoint.browser_ws_url || '');
        patchEnv(taskId, envUuid, (env) => ({ ...env, status: 'running' }));

        await new RpaRunner(adapter).run(
          workflow,
          { envUuid, browserWsUrl: endpoint.browser_ws_url || '' },
          {
            signal: attemptController.signal,
            onStepStatusChange: (event) => {
              const step = findStep(plan.steps, event.stepId);
              const stepName = step?.name ?? event.stepType;
              if (event.status === 'running') {
                // 循环每轮和条件选分支都会再发一次 running，只有第一次新开一行
                if (runningRows.has(event.stepId)) return;
                const row: RpaRunLogEntry = {
                  stepId: event.stepId,
                  name: stepName,
                  type: event.stepType,
                  status: 'running',
                  attempt,
                  startedAt: Date.now(),
                };
                runningRows.set(event.stepId, row);
                log.push(row);
                patchEnv(taskId, envUuid, (env) => ({ ...env, currentStepName: stepName, log: [...log] }));
                return;
              }
              const row = runningRows.get(event.stepId);
              runningRows.delete(event.stepId);
              const error = event.error ? describe(event.error) : undefined;
              if (row) {
                row.status = event.status;
                row.durationMs = Date.now() - row.startedAt;
                row.error = error;
              } else {
                log.push({
                  stepId: event.stepId,
                  name: stepName,
                  type: event.stepType,
                  status: event.status,
                  attempt,
                  startedAt: Date.now(),
                  error,
                });
              }
              publishLog();
            },
            onDataExtracted: (event) => {
              const step = findStep(plan.steps, event.stepId);
              extracted.push({
                stepId: event.stepId,
                stepName: step?.name ?? event.stepType,
                key: event.output ?? '',
                value: event.value,
              });
              const row = [...log].reverse().find((entry) => entry.stepId === event.stepId);
              if (row) row.value = event.value;
              publishLog();
            },
            onScreenshotCaptured: (event) => {
              const row = [...log].reverse().find((entry) => entry.stepId === event.stepId);
              if (!runUuid || !row) return;
              pendingScreenshots.push(
                saveRpaRunScreenshot(taskId, runUuid, event.screenshot)
                  .then((file) => {
                    row.screenshot = file;
                  })
                  .catch(() => undefined)
              );
            },
          }
        );
        outcome = 'success';
        errorMessage = undefined;
        break;
      } catch (error) {
        if (signal.aborted) {
          outcome = 'stopped';
          errorMessage = undefined;
          break;
        }
        const failure = timedOut ? new RpaError('RUN_TIMEOUT') : error;
        errorMessage = describe(failure);
        if (!timedOut && isStopError(error)) {
          outcome = 'stopped';
          errorMessage = undefined;
          break;
        }
        if (attempt > retryCount) {
          outcome = 'failed';
          break;
        }
        patchEnv(taskId, envUuid, (env) => ({ ...env, status: 'retrying', error: errorMessage }));
        await delay(retryInterval * 1000, signal);
      } finally {
        window.clearTimeout(timer);
        signal.removeEventListener('abort', abortAttempt);
        signal.removeEventListener('abort', closeOnStop);
        adapter?.close();
      }
    }
  } catch (error) {
    if (signal.aborted || isStopError(error)) {
      outcome = 'stopped';
      errorMessage = undefined;
    } else {
      outcome = 'failed';
      errorMessage = describe(error);
    }
  } finally {
    await Promise.allSettled(pendingScreenshots);

    // 只关本次运行启动的环境；用户自己打开的环境不动
    if (startedByRun && (plan.closeBrowser || outcome === 'stopped')) {
      await stopEnvironmentRuntime(envUuid).catch(() => undefined);
    }
    if (holdsEnvironment) releaseEnvironment(envUuid);

    patchEnv(taskId, envUuid, (env) => ({
      ...env,
      status: outcome,
      error: errorMessage,
      currentStepName: undefined,
      log: [...log],
    }));

    if (runUuid) {
      await finishRpaRun({
        uuid: runUuid,
        status: outcome === 'success' ? 'completed' : outcome,
        completed_steps: log.filter((entry) => entry.status === 'success').length,
        failed_steps: log.filter((entry) => entry.status === 'failed').length,
        duration_ms: Date.now() - startedAt,
        result_summary: JSON.stringify({ extracted }),
        error_message: errorMessage,
        logs: log,
      }).catch((error) => console.warn('[rpa] Failed to save run record:', error));
    }
  }
  return outcome;
}

async function runPlan(plan: RunPlan, controller: AbortController): Promise<void> {
  const { taskId, workflow } = plan;
  const { signal } = controller;
  const { run_mode: runMode, concurrency, stop_on_error: stopOnError } = workflow.settings;
  const queue = [...workflow.environments];
  const limit = runMode === 'parallel' ? Math.max(1, concurrency) : 1;
  const outcomes: EnvOutcome[] = [];
  let halted = false;

  const worker = async () => {
    while (queue.length > 0 && !halted && !signal.aborted) {
      const envUuid = queue.shift()!;
      const outcome = await runOnEnvironment(plan, envUuid, signal);
      outcomes.push(outcome);
      if (outcome === 'failed' && stopOnError) halted = true;
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));

  // 没轮到的环境标记为已停止
  for (const envUuid of queue) patchEnv(taskId, envUuid, (env) => ({ ...env, status: 'stopped' }));

  const failed = outcomes.includes('failed');
  const status: RpaExecutionStatus = signal.aborted ? 'stopped' : failed ? 'failed' : 'success';
  patchExecution(taskId, (execution) => ({ ...execution, status, finishedAt: Date.now() }));
  active.delete(taskId);

  await setRpaTaskStatus(taskId, status === 'success' ? 'completed' : status === 'failed' ? 'failed' : 'idle').catch(
    () => undefined
  );
  bumpRevision();

  const { notify_on_complete: notifyOnComplete, notify_on_error: notifyOnError } = workflow.settings;
  if (status === 'success' && notifyOnComplete) {
    void sendRpaNotification(workflow.name, translate('execution.notifySuccess')).catch(() => undefined);
  } else if (status === 'failed' && notifyOnError) {
    const execution = rpaExecutionStore.getState().executions[taskId];
    const firstError = execution?.environments.find((env) => env.error)?.error ?? '';
    void sendRpaNotification(workflow.name, translate('execution.notifyFailed', { error: firstError })).catch(
      () => undefined
    );
  }
}

export interface StartRpaExecutionOptions {
  trigger?: RpaTriggerSource;
  variables?: Record<string, string>;
}

/** 启动任务。任务已在运行、没绑定环境、步骤不完整时抛出错误，消息可以直接显示 */
export async function startRpaExecution(taskId: string, options: StartRpaExecutionOptions = {}): Promise<void> {
  if (active.has(taskId)) throw new Error(translate('execution.alreadyRunning'));
  // 加载详情期间先占位，防止连点启动两次
  const controller = new AbortController();
  active.set(taskId, { controller });

  try {
    const state = mapTaskDetailToEditorState(await getRpaTaskDetail(taskId));
    const overrides = options.variables ?? {};
    const workflow: RpaWorkflowSchema = {
      ...state.workflow,
      variables: state.workflow.variables.map((variable) =>
        Object.prototype.hasOwnProperty.call(overrides, variable.name)
          ? { ...variable, value: overrides[variable.name] ?? '' }
          : variable
      ),
    };

    if (workflow.environments.length === 0) throw new Error(translate('dialog.run.environmentRequired'));
    if (state.steps.length === 0) throw new Error(translate('editor.errors.stepsRequired'));
    const [issue] = validateSteps(workflow.steps);
    if (issue) {
      const step = findStep(state.steps, issue.stepId);
      throw new Error(`${step?.name ?? issue.stepId}: ${translate(`editor.validation.${issue.code}`)}`);
    }

    const execution: RpaExecution = {
      taskId,
      taskName: workflow.name,
      status: 'running',
      trigger: options.trigger ?? 'manual',
      startedAt: Date.now(),
      environments: workflow.environments.map((envUuid) => ({
        envUuid,
        name: envUuid,
        status: 'pending',
        attempt: 1,
        log: [],
      })),
    };
    rpaExecutionStore.setState((current) => ({
      executions: { ...current.executions, [taskId]: execution },
      revision: current.revision + 1,
    }));

    void runPlan(
      {
        taskId,
        trigger: execution.trigger,
        workflow,
        steps: state.steps,
        closeBrowser: state.config.closeBrowserOnComplete,
      },
      controller
    ).catch((error) => {
      console.error('[rpa] Execution crashed:', error);
      active.delete(taskId);
      patchExecution(taskId, (current) => ({ ...current, status: 'failed', finishedAt: Date.now() }));
      bumpRevision();
    });
  } catch (error) {
    active.delete(taskId);
    throw error;
  }
}

export function stopRpaExecution(taskId: string): void {
  const entry = active.get(taskId);
  if (!entry) return;
  patchExecution(taskId, (execution) => ({ ...execution, status: 'stopping' }));
  entry.controller.abort();
}

export function isRpaTaskActive(taskId: string): boolean {
  return active.has(taskId);
}
