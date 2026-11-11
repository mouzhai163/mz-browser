import type { RpaTaskDetailDto, RpaTaskStepDto, UpsertRpaTaskRequest } from '../../api';
import type { PortableRpaTaskDocument } from '../../lib/rpa-transfer';
import {
  branchesOf,
  cloneWithNewIds,
  graphToTree,
  type EditorStep,
  type GraphNode,
} from '../../lib/step-tree';
import type { RpaSpeed, RpaStepBranch, RpaWorkflowSchema, RpaWorkflowSelector, RpaWorkflowStep } from '../../types';
import type { TaskConfig, TaskVariable } from './task-settings-form';

export const WORKFLOW_VERSION = 2;

export interface EditorState {
  config: TaskConfig;
  steps: EditorStep[];
  /** 旧文件转换时放到末尾并禁用的步骤数 */
  orphaned: number;
  workflow: RpaWorkflowSchema;
}

interface StoredWorkflowStep {
  id?: string;
  type?: string;
  name?: string;
  enabled?: boolean;
  next?: string | null;
  branches?: Record<string, string | null>;
  click_type?: string;
  clear_first?: boolean;
  duration_ms?: number;
  timeout_ms?: number;
  output?: string;
  script?: string;
  url?: string;
  value?: string;
  target?: RpaWorkflowSelector;
  config?: Record<string, unknown>;
  ui?: {
    source_type?: string;
    position?: { x?: number; y?: number };
    parent_id?: string | null;
    branch?: RpaStepBranch | null;
  };
}

interface StoredWorkflowMeta {
  workflow_version?: number;
  start_step_id?: string | null;
  global_variables?: Array<{ name?: string; value?: string; prompt_on_run?: boolean; required?: boolean }>;
  close_browser_on_complete?: boolean;
  speed?: RpaSpeed;
}

/** 运行时才有的预览数据，不进存储 */
const TRANSIENT_CONFIG = ['previewValue', 'lastScreenshot', 'waitForElement', 'typeSlowly', 'loopWidth', 'loopHeight', 'branches'];

const asNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const asText = (value: unknown) => (typeof value === 'string' ? value : '');

function detectSelectorType(value: string): RpaWorkflowSelector['by'] {
  return value.startsWith('/') || value.startsWith('(') ? 'xpath' : 'css';
}

function buildSelector(config: Record<string, unknown>): RpaWorkflowSelector | undefined {
  const value = asText(config.selector).trim();
  if (!value) return undefined;
  const by = (config.selectorBy as RpaWorkflowSelector['by'] | undefined) ?? detectSelectorType(value);
  const candidates = Array.isArray(config.selectorCandidates)
    ? (config.selectorCandidates as RpaWorkflowSelector[]).filter((item) => item.value !== value)
    : [];
  const frames = Array.isArray(config.selectorFrames) ? (config.selectorFrames as string[]) : [];
  return {
    by,
    value,
    ...(candidates.length ? { candidates: candidates.map(({ by: b, value: v }) => ({ by: b, value: v })) } : {}),
    ...(frames.length ? { frames } : {}),
  };
}

function runnerType(step: EditorStep): string {
  switch (step.type) {
    case 'navigate':
      return 'goto';
    case 'input':
      return 'fill';
    case 'wait':
      return step.config.waitType === 'element' ? 'wait_for' : 'delay';
    case 'extract':
      return 'extract_text';
    case 'script':
      return 'execute_js';
    default:
      return step.type;
  }
}

function buildWorkflowStep(step: EditorStep): RpaWorkflowStep {
  const type = runnerType(step);
  const config = step.config;
  const built: RpaWorkflowStep = {
    id: step.id,
    type,
    name: step.name,
    enabled: step.enabled,
    ui: { source_type: step.type },
    config: { ...config },
  };
  const timeoutMs = asNumber(config.timeout, 10000);

  switch (type) {
    case 'goto':
      built.url = asText(config.url).trim();
      built.wait_until = config.waitForLoad === false ? 'commit' : 'load';
      built.new_tab = config.newTab !== false;
      break;
    case 'click':
      built.target = buildSelector(config);
      built.click_type = asText(config.clickType) || 'single';
      built.timeout_ms = timeoutMs;
      break;
    case 'hover':
    case 'select_option':
    case 'upload':
      built.target = buildSelector(config);
      built.timeout_ms = timeoutMs;
      break;
    case 'fill':
      built.target = buildSelector(config);
      built.value = asText(config.text);
      built.clear_first = config.clearFirst !== false;
      built.timeout_ms = timeoutMs;
      break;
    case 'delay':
      built.duration_ms = asNumber(config.duration, 1000);
      break;
    case 'wait_for':
      built.target = buildSelector(config);
      built.timeout_ms = timeoutMs;
      break;
    case 'scroll':
      built.target = (config.scrollMode ?? 'to_element') === 'to_element' ? buildSelector(config) : undefined;
      built.config = { ...built.config, scrollMode: config.scrollMode ?? 'to_element' };
      built.timeout_ms = timeoutMs;
      break;
    case 'extract_text':
      built.target = buildSelector(config);
      built.output = asText(config.outputKey) || undefined;
      built.timeout_ms = timeoutMs;
      break;
    case 'execute_js':
      built.script = asText(config.script);
      built.output = asText(config.outputKey) || undefined;
      break;
    case 'condition':
      built.target = (config.conditionType ?? 'element_visible') === 'element_visible' ? buildSelector(config) : undefined;
      built.then = (step.then ?? []).map(buildWorkflowStep);
      built.else = (step.else ?? []).map(buildWorkflowStep);
      break;
    case 'loop':
      built.body = (step.body ?? []).map(buildWorkflowStep);
      break;
    case 'screenshot':
      built.screenshot_mode = asText(config.captureMode) || 'viewport';
      built.target = built.screenshot_mode === 'element' ? buildSelector(config) : undefined;
      built.timeout_ms = timeoutMs;
      break;
    default:
      break;
  }
  return built;
}

export function buildWorkflowSteps(steps: EditorStep[]): RpaWorkflowStep[] {
  return steps.map(buildWorkflowStep);
}

export function buildWorkflowSchema(config: TaskConfig, steps: EditorStep[]): RpaWorkflowSchema {
  return {
    schema_version: '2.0',
    name: config.name.trim(),
    description: config.description,
    tags: config.tags,
    trigger: { type: config.triggerType, schedule: config.schedule, cron_expression: config.cronExpression },
    environments: config.selectedEnvironments,
    settings: {
      run_mode: config.runMode,
      retry_count: config.retryCount,
      retry_interval_seconds: config.retryInterval,
      timeout_seconds: config.timeout,
      concurrency: config.concurrency,
      stop_on_error: config.stopOnError,
      notify_on_complete: config.notifyOnComplete,
      notify_on_error: config.notifyOnError,
      speed: config.speed,
    },
    variables: config.globalVariables
      .map((variable) => ({ name: variable.name.trim(), value: variable.value }))
      .filter((variable) => variable.name),
    steps: buildWorkflowSteps(steps),
  };
}

/** 步骤树摊平成一行一步（存储沿用扁平表，父子关系放在 ui 里） */
function flatten(
  steps: RpaWorkflowStep[],
  parentId: string | null,
  branch: RpaStepBranch | null,
  out: RpaWorkflowStep[]
): void {
  for (const step of steps) {
    const { then: thenSteps, else: elseSteps, body, ...rest } = step;
    out.push({ ...rest, ui: { ...step.ui, parent_id: parentId, branch } });
    if (thenSteps) flatten(thenSteps, step.id, 'then', out);
    if (elseSteps) flatten(elseSteps, step.id, 'else', out);
    if (body) flatten(body, step.id, 'body', out);
  }
}

export function buildTaskPayload(config: TaskConfig, steps: EditorStep[]): UpsertRpaTaskRequest {
  const workflow = buildWorkflowSchema(config, steps);
  const rows: RpaWorkflowStep[] = [];
  flatten(workflow.steps, null, null, rows);
  const meta: StoredWorkflowMeta = {
    workflow_version: WORKFLOW_VERSION,
    global_variables: config.globalVariables
      .map((variable) => ({
        name: variable.name.trim(),
        value: variable.value,
        prompt_on_run: variable.promptOnRun === true,
        required: variable.promptOnRun === true && variable.required === true,
      }))
      .filter((variable) => variable.name),
    close_browser_on_complete: config.closeBrowserOnComplete === true,
    speed: config.speed,
  };

  return {
    name: workflow.name,
    description: workflow.description ?? '',
    tags: workflow.tags,
    trigger_type: workflow.trigger.type,
    schedule: workflow.trigger.schedule ?? '',
    cron_expression: workflow.trigger.cron_expression ?? '',
    run_mode: workflow.settings.run_mode,
    retry_count: workflow.settings.retry_count,
    retry_interval: workflow.settings.retry_interval_seconds,
    timeout: workflow.settings.timeout_seconds,
    concurrency: workflow.settings.concurrency,
    stop_on_error: workflow.settings.stop_on_error,
    notify_on_complete: workflow.settings.notify_on_complete,
    notify_on_error: workflow.settings.notify_on_error,
    environment_uuids: workflow.environments,
    steps: rows.map((step, index) => ({
      step_type: step.type,
      name: step.name,
      config: { workflow_step: step, workflow_meta: meta },
      enabled: step.enabled,
      sort_order: index,
    })),
  };
}

function cleanConfig(config: Record<string, unknown>): Record<string, unknown> {
  const clean = { ...config };
  for (const key of TRANSIENT_CONFIG) delete clean[key];
  return clean;
}

/** 存储的一步还原成编辑器的配置（旧版字段散在外层，这里统一收进 config） */
function restoreStep(stored: StoredWorkflowStep): EditorStep {
  const type = stored.ui?.source_type ?? stored.type ?? 'click';
  const config = cleanConfig(stored.config ?? {});
  if (!config.selector && stored.target?.value) config.selector = stored.target.value;
  if (stored.target?.by && !config.selectorBy) config.selectorBy = stored.target.by;
  if (stored.target?.candidates && !config.selectorCandidates) config.selectorCandidates = stored.target.candidates;
  if (stored.target?.frames && !config.selectorFrames) config.selectorFrames = stored.target.frames;
  if (!config.url && stored.url) config.url = stored.url;
  if (!config.clickType && stored.click_type) config.clickType = stored.click_type;
  if (!config.text && stored.value) config.text = stored.value;
  if (config.clearFirst === undefined && stored.clear_first !== undefined) config.clearFirst = stored.clear_first;
  if (!config.duration && stored.duration_ms) config.duration = stored.duration_ms;
  if (!config.timeout && stored.timeout_ms) config.timeout = stored.timeout_ms;
  if (!config.outputKey && stored.output) config.outputKey = stored.output;
  if (!config.script && stored.script) config.script = stored.script;
  if (stored.type === 'delay' && !config.waitType) config.waitType = 'time';
  if (stored.type === 'wait_for' && !config.waitType) config.waitType = 'element';

  const step: EditorStep = {
    id: String(stored.id),
    type,
    name: stored.name ?? type,
    config,
    enabled: stored.enabled !== false,
  };
  for (const branch of branchesOf(type)) step[branch] = [];
  return step;
}

function buildTree(rows: StoredWorkflowStep[]): EditorStep[] {
  const steps = new Map(rows.map((row) => [String(row.id), restoreStep(row)]));
  const root: EditorStep[] = [];
  for (const row of rows) {
    const step = steps.get(String(row.id))!;
    const parent = row.ui?.parent_id ? steps.get(row.ui.parent_id) : null;
    if (parent && row.ui?.branch) (parent[row.ui.branch] ??= []).push(step);
    else root.push(step);
  }
  return root;
}

function toGraphNode(stored: StoredWorkflowStep, startId: string | null, index: number): GraphNode {
  const step = restoreStep(stored);
  const branches = stored.branches ?? (stored.config?.branches as Record<string, string | null> | undefined) ?? {};
  const position = stored.ui?.position;
  return {
    ...step,
    nextStepId: typeof stored.next === 'string' ? stored.next : null,
    parentLoopId: typeof stored.ui?.parent_id === 'string' ? stored.ui.parent_id : null,
    isStart: startId ? step.id === startId : index === 0,
    branchTargets: { true: branches.true, false: branches.false },
    position: position ? { x: position.x ?? 0, y: position.y ?? 0 } : undefined,
  };
}

function restoreSteps(sorted: RpaTaskStepDto[], meta: StoredWorkflowMeta | undefined): { steps: EditorStep[]; orphaned: number } {
  const stored = sorted.map((row, index): StoredWorkflowStep => {
    const value = row.config?.workflow_step;
    if (value && typeof value === 'object') return value as StoredWorkflowStep;
    // 最早的数据只有扁平步骤，按顺序接起来
    return {
      id: row.uuid,
      type: row.step_type,
      name: row.name,
      enabled: row.enabled ?? true,
      next: row.next_step_uuid ?? sorted[index + 1]?.uuid ?? null,
      branches: (row.branch_config as Record<string, string | null> | null) ?? undefined,
      config: row.config ?? {},
    };
  });
  if (meta?.workflow_version === WORKFLOW_VERSION) {
    return { steps: buildTree(stored), orphaned: 0 };
  }
  const startId = typeof meta?.start_step_id === 'string' ? meta.start_step_id : null;
  return graphToTree(stored.map((step, index) => toGraphNode(step, startId, index)));
}

function mapVariables(variables: StoredWorkflowMeta['global_variables']): TaskVariable[] {
  if (!Array.isArray(variables)) return [];
  return variables
    .map((variable, index) => ({
      id: `var-${index}`,
      name: asText(variable?.name),
      value: asText(variable?.value),
      promptOnRun: variable?.prompt_on_run === true,
      required: variable?.required === true,
    }))
    .filter((variable) => variable.name.trim());
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

type TaskFields = Pick<
  RpaTaskDetailDto['task'],
  | 'name'
  | 'description'
  | 'tags'
  | 'trigger_type'
  | 'schedule'
  | 'cron_expression'
  | 'run_mode'
  | 'retry_count'
  | 'retry_interval'
  | 'timeout'
  | 'concurrency'
  | 'stop_on_error'
  | 'notify_on_complete'
  | 'notify_on_error'
>;

function buildConfig(task: TaskFields, environments: string[], meta: StoredWorkflowMeta | undefined): TaskConfig {
  return {
    name: task.name,
    description: task.description ?? '',
    tags: toStringArray(task.tags),
    triggerType: task.trigger_type === 'scheduled' ? 'scheduled' : 'manual',
    schedule: task.schedule ?? undefined,
    cronExpression: task.cron_expression ?? undefined,
    selectedEnvironments: environments,
    runMode: task.run_mode === 'parallel' ? 'parallel' : 'sequential',
    globalVariables: mapVariables(meta?.global_variables),
    retryCount: task.retry_count ?? 0,
    retryInterval: task.retry_interval ?? 5,
    timeout: task.timeout ?? 300,
    concurrency: task.concurrency ?? 1,
    stopOnError: task.stop_on_error ?? true,
    closeBrowserOnComplete: meta?.close_browser_on_complete === true,
    notifyOnComplete: task.notify_on_complete ?? false,
    notifyOnError: task.notify_on_error ?? true,
    speed: meta?.speed ?? 'normal',
  };
}

function sortRows<T extends { sort_order?: number | null }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER)
  );
}

function metaOf(rows: Array<{ config: Record<string, unknown> }>): StoredWorkflowMeta | undefined {
  return rows.find((row) => row.config?.workflow_meta)?.config.workflow_meta as StoredWorkflowMeta | undefined;
}

export function mapTaskDetailToEditorState(detail: RpaTaskDetailDto): EditorState {
  const rows = sortRows(detail.steps);
  const meta = metaOf(rows);
  const { steps, orphaned } = restoreSteps(rows, meta);
  const config = buildConfig(detail.task, detail.environment_uuids || [], meta);
  return { config, steps, orphaned, workflow: buildWorkflowSchema(config, steps) };
}

export function mapPortableTaskToEditorState(document: PortableRpaTaskDocument): EditorState {
  const rows = sortRows(document.task.steps) as RpaTaskStepDto[];
  const meta = metaOf(rows);
  const { steps: restored, orphaned } = restoreSteps(rows, meta);
  // 导入的是一份新任务，步骤换新 id
  const steps = restored.map((step) => cloneWithNewIds(step));
  const config = buildConfig(document.task, document.task.environment_uuids || [], meta);
  return { config, steps, orphaned, workflow: buildWorkflowSchema(config, steps) };
}
