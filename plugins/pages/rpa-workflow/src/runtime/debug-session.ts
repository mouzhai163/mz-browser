import type { RpaCapturedSelector, RpaWorkflowSchema, RpaWorkflowStep } from '../types';
import type { BrowserAdapter } from './browser-adapter';
import { connectBoundRpaEnvironment } from './bound-environment';
import { createBrowserAdapter } from './create-browser-adapter';
import { RpaRunner, type RpaRunContext, type RpaRunnerOptions } from './runner';

/**
 * 编辑器的调试会话：单步运行和拾取元素之间保持和环境的连接、当前标签、变量，
 * 这样运行第 3 步时第 1、2 步打开的页面和提取的变量还在。
 */
export class RpaDebugSession {
  private adapter: BrowserAdapter | null = null;
  private runner: RpaRunner | null = null;
  private context: RpaRunContext | null = null;
  private envUuid: string | null = null;

  private async ensure(envUuid: string, workflow: RpaWorkflowSchema): Promise<RpaRunner> {
    if (this.runner && this.envUuid === envUuid) return this.runner;
    this.dispose();
    const endpoint = await connectBoundRpaEnvironment(envUuid);
    const adapter = createBrowserAdapter(endpoint.browser_ws_url || '');
    await adapter.connect(
      { envUuid: endpoint.env_uuid, browserWsUrl: endpoint.browser_ws_url || '' },
      { speed: workflow.settings.speed }
    );
    this.adapter = adapter;
    this.runner = new RpaRunner(adapter);
    this.envUuid = envUuid;
    return this.runner;
  }

  /** 准备一次调试运行：变量沿用上一次的，任务里新增的变量补进去 */
  private prepare(runner: RpaRunner, workflow: RpaWorkflowSchema, options: RpaRunnerOptions): RpaRunContext {
    const fresh = runner.createContext(workflow, options);
    this.context = { variables: { ...fresh.variables, ...this.context?.variables }, options };
    return this.context;
  }

  async runStep(
    envUuid: string,
    workflow: RpaWorkflowSchema,
    step: RpaWorkflowStep,
    options: RpaRunnerOptions
  ): Promise<void> {
    const runner = await this.ensure(envUuid, workflow);
    await runner.runSingle(step, this.prepare(runner, workflow, options));
  }

  async runFrom(
    envUuid: string,
    workflow: RpaWorkflowSchema,
    stepId: string,
    options: RpaRunnerOptions
  ): Promise<void> {
    const runner = await this.ensure(envUuid, workflow);
    await runner.runFrom(workflow.steps, stepId, this.prepare(runner, workflow, options));
  }

  async pick(envUuid: string, workflow: RpaWorkflowSchema): Promise<RpaCapturedSelector> {
    await this.ensure(envUuid, workflow);
    return this.adapter!.pickElement();
  }

  get variables(): Record<string, unknown> {
    return this.context?.variables ?? {};
  }

  /** 断开连接（环境继续开着） */
  dispose(): void {
    this.adapter?.close();
    this.adapter = null;
    this.runner = null;
    this.context = null;
    this.envUuid = null;
  }
}
