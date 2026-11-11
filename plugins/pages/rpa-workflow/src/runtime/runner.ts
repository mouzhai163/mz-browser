import type { RpaStepBranch, RpaWorkflowSchema, RpaWorkflowStep } from '../types';
import type { BrowserAdapter, BrowserExtractType, BrowserSession } from './browser-adapter';
import { RpaError, isStopError } from './errors';
import { executeLocalRpaScript } from './tauri';

export type RpaRunnerStepStatus = 'running' | 'success' | 'failed' | 'skipped' | 'stopped';

export interface RpaRunnerStepEvent {
  stepId: string;
  stepType: string;
  status: RpaRunnerStepStatus;
  error?: unknown;
  loopIteration?: number;
  loopTotal?: number;
  /** 条件走了哪个分支 */
  branch?: 'then' | 'else';
}

export interface RpaRunnerOptions {
  signal?: AbortSignal;
  /** 运行时变量的初始值（覆盖任务里定义的默认值） */
  variables?: Record<string, unknown>;
  onStepStatusChange?: (event: RpaRunnerStepEvent) => void;
  onScreenshotCaptured?: (event: { stepId: string; stepType: string; screenshot: string }) => void;
  onDataExtracted?: (event: { stepId: string; stepType: string; value: string; output?: string }) => void;
}

/** 运行里的 break 信号，不是错误 */
const BREAK = Symbol('break');
type Flow = typeof BREAK | void;

const asNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const asString = (value: unknown) => (typeof value === 'string' ? value : '');

export interface RpaRunContext {
  variables: Record<string, unknown>;
  options?: RpaRunnerOptions;
}

export class RpaRunner {
  private readonly adapter: BrowserAdapter;

  constructor(adapter: BrowserAdapter) {
    this.adapter = adapter;
  }

  /** 完整运行：连接、执行全部步骤、收尾、断开 */
  async run(
    workflow: RpaWorkflowSchema,
    session: BrowserSession,
    options?: RpaRunnerOptions
  ): Promise<Record<string, unknown>> {
    await this.adapter.connect(session, { speed: workflow.settings.speed });
    const context = this.createContext(workflow, options);
    try {
      await this.runList(workflow.steps, context);
      return context.variables;
    } finally {
      await this.adapter.finishRun().catch(() => undefined);
      this.adapter.close();
    }
  }

  /** 调试用：在已连接的适配器上执行，变量由调用方保持 */
  createContext(workflow: Pick<RpaWorkflowSchema, 'variables'>, options?: RpaRunnerOptions): RpaRunContext {
    const variables: Record<string, unknown> = {};
    for (const variable of workflow.variables ?? []) {
      const name = asString(variable?.name).trim();
      if (name) variables[name] = variable.value;
    }
    return { variables: { ...variables, ...options?.variables }, options };
  }

  /** 只运行这一步（条件和循环连同子步骤一起） */
  async runSingle(step: RpaWorkflowStep, context: RpaRunContext): Promise<void> {
    await this.runOne(step, context);
  }

  /** 从 stepId 开始往后运行：本层剩余步骤，然后逐层回到外层继续 */
  async runFrom(steps: RpaWorkflowStep[], stepId: string, context: RpaRunContext): Promise<void> {
    const path = findPath(steps, stepId);
    if (!path) throw new RpaError('STEP_NOT_SUPPORTED', stepId);
    for (let depth = path.length - 1; depth >= 0; depth -= 1) {
      const { list, index } = path[depth];
      // 最内层从目标步骤本身开始，外层从包含它的条件或循环的下一步开始
      const flow = await this.runList(list.slice(depth === path.length - 1 ? index : index + 1), context);
      if (flow === BREAK) break;
    }
  }

  private throwIfStopped(context: RpaRunContext): void {
    if (context.options?.signal?.aborted) throw new RpaError('RUN_STOPPED');
  }

  private async runList(steps: RpaWorkflowStep[], context: RpaRunContext): Promise<Flow> {
    for (const step of steps) {
      this.throwIfStopped(context);
      const flow = await this.runOne(step, context);
      if (flow === BREAK) return BREAK;
    }
  }

  private async runOne(step: RpaWorkflowStep, context: RpaRunContext): Promise<Flow> {
    const notify = context.options?.onStepStatusChange;
    if (step.enabled === false) {
      notify?.({ stepId: step.id, stepType: step.type, status: 'skipped' });
      return;
    }
    notify?.({ stepId: step.id, stepType: step.type, status: 'running' });
    try {
      const flow = await this.execute(step, context);
      notify?.({ stepId: step.id, stepType: step.type, status: 'success' });
      return flow;
    } catch (error) {
      const stopped = isStopError(error) || context.options?.signal?.aborted;
      notify?.({
        stepId: step.id,
        stepType: step.type,
        status: stopped ? 'stopped' : 'failed',
        error: stopped ? undefined : error,
      });
      throw stopped ? new RpaError('RUN_STOPPED') : error;
    }
  }

  private async execute(step: RpaWorkflowStep, context: RpaRunContext): Promise<Flow> {
    const { variables, options } = context;
    const config = step.config ?? {};
    const timeoutMs = asNumber(step.timeout_ms, 10000);
    const render = (value: unknown) => renderTemplate(asString(value), variables);
    const target = step.target;

    switch (step.type) {
      case 'goto':
        await this.adapter.goto(render(step.url), {
          waitUntil: step.wait_until,
          newTab: step.new_tab !== false,
          reuseKey: step.id,
        });
        return;
      case 'reload':
        await this.adapter.reload();
        return;
      case 'go_back':
        await this.adapter.goBack();
        return;
      case 'go_forward':
        await this.adapter.goForward();
        return;
      case 'select_tab':
        await this.adapter.selectTab(Math.trunc(asNumber(config.tabIndex, NaN)));
        return;
      case 'close_tab':
        await this.adapter.closeTab(Math.trunc(asNumber(config.tabIndex, NaN)));
        return;
      case 'click':
        await this.adapter.click(target!, {
          button: step.click_type === 'right' ? 'right' : 'left',
          clickCount: step.click_type === 'double' ? 2 : 1,
          timeoutMs,
        });
        return;
      case 'hover':
        await this.adapter.hover(target!, { timeoutMs });
        return;
      case 'fill':
        await this.adapter.fill(target!, render(step.value), { clearFirst: step.clear_first !== false, timeoutMs });
        return;
      case 'press_key':
        await this.adapter.pressKey(asString(config.key));
        return;
      case 'select_option':
        await this.adapter.selectOption(
          target!,
          { by: config.optionBy === 'value' ? 'value' : 'label', value: render(config.optionValue) },
          { timeoutMs }
        );
        return;
      case 'upload':
        await this.adapter.uploadFile(target!, render(config.filePath).trim(), { timeoutMs });
        return;
      case 'delay':
        await this.delay(asNumber(step.duration_ms, 1000), context);
        return;
      case 'wait_for':
        await this.adapter.waitFor(target!, timeoutMs);
        return;
      case 'scroll': {
        const mode =
          config.scrollMode === 'by_viewport' || config.scrollMode === 'to_edge' ? config.scrollMode : 'to_element';
        await this.adapter.scroll({
          mode,
          target: mode === 'to_element' ? target : undefined,
          direction: config.direction === 'up' ? 'up' : 'down',
          viewportCount: asNumber(config.viewportCount, 1),
          edge: config.edge === 'top' ? 'top' : 'bottom',
          block: config.block === 'start' || config.block === 'end' || config.block === 'nearest' ? config.block : 'center',
          timeoutMs,
        });
        return;
      }
      case 'screenshot': {
        const screenshot = await this.adapter.screenshot({
          fullPage: step.screenshot_mode === 'full_page',
          target: step.screenshot_mode === 'element' ? target : undefined,
          timeoutMs,
        });
        options?.onScreenshotCaptured?.({ stepId: step.id, stepType: step.type, screenshot });
        return;
      }
      case 'extract_text': {
        const value = await this.adapter.extract({
          target: target!,
          extractType: (config.extractType as BrowserExtractType) || 'text',
          attribute: asString(config.attribute),
          all: config.extractAll === true,
          timeoutMs,
        });
        this.storeOutput(step, value, context);
        return;
      }
      case 'execute_js': {
        const script = renderScript(asString(step.script).trim(), variables);
        const value =
          config.executionMode === 'local'
            ? (await executeLocalRpaScript(script, variables)).value
            : await this.adapter.executeScript(script);
        this.storeOutput(step, value, context);
        return;
      }
      case 'set_variable':
        variables[asString(config.variableName).trim()] = render(config.variableValue);
        return;
      case 'condition':
        return this.runCondition(step, context);
      case 'loop':
        return this.runLoop(step, context);
      case 'break_loop':
        return BREAK;
      default:
        throw new RpaError('STEP_NOT_SUPPORTED', step.type);
    }
  }

  private async runCondition(step: RpaWorkflowStep, context: RpaRunContext): Promise<Flow> {
    const config = step.config ?? {};
    const render = (value: unknown) => renderTemplate(asString(value), context.variables).trim();
    const matched = await this.adapter.evaluateCondition(
      config.conditionType === 'text_present'
        ? { type: 'text_present', text: render(config.expectedText) }
        : config.conditionType === 'url_contains'
          ? { type: 'url_contains', value: render(config.urlFragment) }
          : { type: 'element_visible', target: step.target! }
    );
    const branch = matched ? 'then' : 'else';
    context.options?.onStepStatusChange?.({ stepId: step.id, stepType: step.type, status: 'running', branch });
    return this.runList(step[branch] ?? [], context);
  }

  private async runLoop(step: RpaWorkflowStep, context: RpaRunContext): Promise<Flow> {
    const total = Math.max(1, Math.floor(asNumber(step.config?.iterations, 3)));
    const outer = context.variables.loop;
    try {
      for (let index = 1; index <= total; index += 1) {
        this.throwIfStopped(context);
        context.variables.loop = { index, total };
        context.options?.onStepStatusChange?.({
          stepId: step.id,
          stepType: step.type,
          status: 'running',
          loopIteration: index,
          loopTotal: total,
        });
        if ((await this.runList(step.body ?? [], context)) === BREAK) break;
      }
    } finally {
      context.variables.loop = outer;
    }
  }

  private async delay(durationMs: number, context: RpaRunContext): Promise<void> {
    const signal = context.options?.signal;
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new RpaError('RUN_STOPPED'));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, Math.max(durationMs, 0));
      if (signal?.aborted) onAbort();
      else signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private storeOutput(step: RpaWorkflowStep, value: string, context: RpaRunContext): void {
    const output = asString(step.output).trim();
    if (output) context.variables[output] = value;
    context.options?.onDataExtracted?.({ stepId: step.id, stepType: step.type, value, output: output || undefined });
  }
}

/** 从根到目标步骤的路径，每层是它所在的列表和下标 */
function findPath(
  steps: RpaWorkflowStep[],
  stepId: string
): Array<{ list: RpaWorkflowStep[]; index: number }> | null {
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (step.id === stepId) return [{ list: steps, index }];
    for (const branch of ['then', 'else', 'body'] as RpaStepBranch[]) {
      const inner = step[branch] ? findPath(step[branch]!, stepId) : null;
      if (inner) return [{ list: steps, index }, ...inner];
    }
  }
  return null;
}

// ---------- 变量模板

function parsePath(expression: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  for (const match of expression.matchAll(/([\p{L}_][\p{L}\p{N}_-]*)|\[(\d+)\]/gu)) {
    tokens.push(match[1] ?? Number(match[2]));
  }
  return tokens;
}

function normalize(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

export function resolveVariable(expression: string, variables: Record<string, unknown>): unknown {
  const tokens = parsePath(expression);
  if (tokens.length === 0) return undefined;
  let current = normalize(variables[String(tokens[0])]);
  for (const token of tokens.slice(1)) {
    if (current == null) return undefined;
    if ((typeof current === 'string' || Array.isArray(current)) && token === 'length') return current.length;
    if (typeof current !== 'object') return undefined;
    current = normalize((current as Record<string | number, unknown>)[token]);
  }
  return current;
}

const TEMPLATE = /\{\{\s*([^}]+?)\s*\}\}/g;

export function renderTemplate(value: string, variables: Record<string, unknown>): string {
  return value.replace(TEMPLATE, (_, expression: string) => {
    const resolved = resolveVariable(expression, variables);
    if (resolved == null) return '';
    return typeof resolved === 'object' ? JSON.stringify(resolved) : String(resolved);
  });
}

/** 脚本里的变量按 JS 字面量替换 */
function renderScript(value: string, variables: Record<string, unknown>): string {
  return value.replace(TEMPLATE, (_, expression: string) => {
    const resolved = resolveVariable(expression, variables);
    return resolved === undefined ? 'undefined' : JSON.stringify(resolved);
  });
}

