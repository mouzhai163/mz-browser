import { listen } from '@tauri-apps/api/event';
import i18n from 'i18next';
import { invoke } from '@/lib/tauri';
import { createRpaTask, deleteRpaTask, duplicateRpaTask, getRpaTaskDetail, updateRpaTask } from '../api';
import type { TaskConfig, TaskVariable } from '../components/task-editor/task-settings-form';
import { buildTaskPayload, buildWorkflowSchema, mapTaskDetailToEditorState } from '../components/task-editor/workflow-mapper';
import type { EditorStep } from '../lib/step-tree';
import { markRpaTaskEdited, rpaExecutionStore, startRpaExecution, stopRpaExecution, stopRpaExecutionAndWait } from './execution-manager';
import { normalizeSteps } from './mcp-steps';
import { deleteRpaTaskFiles } from './tauri';
import { validateSteps } from './validate-workflow';

type Payload = Record<string, unknown>;

const translate = (key: string) => i18n.getFixedT(null, 'rpa')(key) as string;

const stepName = (type: string) => translate(`editor.stepTypes.${type}`);

const SETTING_KEYS: Array<keyof TaskConfig> = [
  'name', 'description', 'tags', 'triggerType', 'schedule', 'cronExpression', 'selectedEnvironments', 'runMode',
  'retryCount', 'retryInterval', 'timeout', 'concurrency', 'stopOnError', 'closeBrowserOnComplete',
  'notifyOnComplete', 'notifyOnError', 'speed',
];

function applySettings(base: TaskConfig, settings: unknown): TaskConfig {
  const input = (settings ?? {}) as Payload;
  const next = { ...base } as Record<string, unknown>;
  for (const key of SETTING_KEYS) {
    if (input[key] !== undefined && input[key] !== null) next[key] = input[key];
  }
  if (Array.isArray(input.globalVariables)) {
    next.globalVariables = (input.globalVariables as Payload[]).map(
      (variable): TaskVariable => ({
        id: crypto.randomUUID(),
        name: String(variable.name ?? ''),
        value: String(variable.value ?? ''),
        promptOnRun: variable.promptOnRun === true,
        required: variable.required === true,
      })
    );
  }
  return next as unknown as TaskConfig;
}

function issuesOf(config: TaskConfig, steps: EditorStep[]) {
  return validateSteps(buildWorkflowSchema(config, steps).steps).map((issue) => ({
    stepId: issue.stepId,
    code: issue.code,
    message: translate(`editor.validation.${issue.code}`),
  }));
}

const NEW_TASK: Omit<TaskConfig, 'name'> = {
  description: '',
  tags: [],
  triggerType: 'manual',
  selectedEnvironments: [],
  runMode: 'sequential',
  globalVariables: [],
  retryCount: 0,
  retryInterval: 5,
  timeout: 300,
  concurrency: 1,
  stopOnError: true,
  closeBrowserOnComplete: false,
  notifyOnComplete: false,
  notifyOnError: true,
  speed: 'normal',
};

const handlers: Record<string, (payload: Payload) => Promise<unknown>> = {
  async get({ taskUuid }) {
    const state = mapTaskDetailToEditorState(await getRpaTaskDetail(String(taskUuid)));
    return { uuid: taskUuid, settings: state.config, steps: state.steps, issues: issuesOf(state.config, state.steps) };
  },
  async create({ name, steps, settings }) {
    const config = applySettings({ ...NEW_TASK, name: String(name ?? '') }, settings);
    if (!config.name.trim()) throw new Error(translate('editor.errors.nameRequired'));
    const tree = normalizeSteps((steps as unknown[]) ?? [], stepName);
    const uuid = await createRpaTask(buildTaskPayload(config, tree));
    markRpaTaskEdited(uuid);
    return { uuid, issues: issuesOf(config, tree) };
  },
  async update({ taskUuid, steps, settings }) {
    const uuid = String(taskUuid);
    const state = mapTaskDetailToEditorState(await getRpaTaskDetail(uuid));
    const config = applySettings(state.config, settings);
    const tree = Array.isArray(steps) ? normalizeSteps(steps, stepName) : state.steps;
    await updateRpaTask({ ...buildTaskPayload(config, tree), uuid });
    markRpaTaskEdited(uuid);
    return { uuid, issues: issuesOf(config, tree) };
  },
  async duplicate({ taskUuid }) {
    const uuid = await duplicateRpaTask(String(taskUuid));
    markRpaTaskEdited(uuid);
    return { uuid };
  },
  async delete({ taskUuid }) {
    const uuid = String(taskUuid);
    await stopRpaExecutionAndWait(uuid);
    await deleteRpaTask(uuid);
    void deleteRpaTaskFiles([uuid]).catch(() => undefined);
    markRpaTaskEdited(uuid);
    return { uuid };
  },
  async run({ taskUuid, variables }) {
    await startRpaExecution(String(taskUuid), {
      trigger: 'mcp',
      variables: (variables as Record<string, string> | null) ?? undefined,
    });
    return { started: true };
  },
  async stop({ taskUuid }) {
    stopRpaExecution(String(taskUuid));
    return { stopping: true };
  },
  async execution({ taskUuid }) {
    return rpaExecutionStore.getState().executions[String(taskUuid)] ?? { status: 'none', environments: [] };
  },
};

interface McpRpaRequest {
  id: string;
  action: string;
  payload: Payload;
}

let started = false;

/** 接收 MCP 的 RPA 请求。保存格式转换和运行都在前端，所以由这里处理 */
export function startRpaMcpBridge(): void {
  if (started) return;
  started = true;
  const listening = listen<McpRpaRequest>('mcp-rpa-request', async ({ payload: request }) => {
    try {
      const handler = handlers[request.action];
      if (!handler) throw new Error(`Unknown action: ${request.action}`);
      await invoke('mcp_rpa_respond', { id: request.id, data: (await handler(request.payload)) ?? null, error: null });
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const message = raw.includes('INVALID_CRON') ? translate('editor.errors.invalidCron') : raw;
      await invoke('mcp_rpa_respond', { id: request.id, data: null, error: message }).catch(() => undefined);
    }
  });
  // 开发时热更新会重新执行这个模块，旧的监听不卸掉，一个请求会被处理多次
  import.meta.hot?.dispose(() => void listening.then((unlisten) => unlisten()));
}
