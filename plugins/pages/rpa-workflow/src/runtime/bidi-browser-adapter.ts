import type {
  BrowserAdapter,
  BrowserConditionCheck,
  BrowserExtractOptions,
  BrowserExtractResult,
  BrowserScriptResult,
  BrowserSession,
} from './browser-adapter';
import {
  CLEAR_CLICK_CAPTURE,
  INSTALL_CLICK_CAPTURE,
  READ_CLICK_CAPTURE,
  buildClickExpression,
  buildConditionExpression,
  buildExecuteScriptExpression,
  buildExtractExpression,
  buildFillExpression,
  buildScreenshotClipExpression,
  buildScrollExpression,
  buildUploadTargetExpression,
  buildWaitForExpression,
} from './page-scripts';
import type { RpaCapturedSelector, RpaWorkflowSelector } from '../types';
import { closeEnvironmentRpaTab, selectEnvironmentRpaTab } from './tauri';

/**
 * Firefox 内核的 RPA 适配器（WebDriver BiDi）。
 *
 * 连的是运行时的共用会话转发地址（一个 Firefox 只能有一个 BiDi 会话）。页面里执行的脚本和
 * Chromium 版完全相同（page-scripts.ts），只是换成 BiDi 的命令发出去。
 */

interface BidiResponse {
  id?: number;
  type?: string;
  result?: unknown;
  error?: string;
  message?: string;
}

/** BiDi 的序列化值（RemoteValue） */
interface RemoteValue {
  type: string;
  value?: unknown;
  sharedId?: string;
}

class BidiClient {
  private socket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();

  private readonly timeoutMs = 60000;

  async connect(url: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url);
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('BIDI_CONNECTION_TIMEOUT'));
      }, 15000);
      socket.addEventListener(
        'open',
        () => {
          clearTimeout(timer);
          this.socket = socket;
          resolve();
        },
        { once: true }
      );
      socket.addEventListener(
        'error',
        () => {
          clearTimeout(timer);
          reject(new Error('Failed to connect to the browser'));
        },
        { once: true }
      );
      socket.addEventListener('message', (event) => this.handle(event));
      socket.addEventListener('close', () => {
        if (this.socket === socket) this.socket = null;
        for (const [, pending] of this.pending) {
          clearTimeout(pending.timer);
          pending.reject(new Error('BIDI_CONNECTION_CLOSED'));
        }
        this.pending.clear();
      });
    });
  }

  send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Browser connection is not open'));
    }
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`BIDI_REQUEST_TIMEOUT: ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  private handle(event: MessageEvent<string>): void {
    let message: BidiResponse;
    try {
      message = JSON.parse(event.data) as BidiResponse;
    } catch {
      return;
    }
    if (typeof message.id !== 'number' || message.type === 'event') return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.type === 'success') {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error(message.message || message.error || 'BIDI_COMMAND_FAILED'));
    }
  }
}

/** 把 BiDi 的序列化值转回普通的 JS 值（节点保留 sharedId） */
function fromRemote(value: RemoteValue | undefined): unknown {
  if (!value) return undefined;
  switch (value.type) {
    case 'undefined':
      return undefined;
    case 'null':
      return null;
    case 'string':
    case 'boolean':
      return value.value;
    case 'number':
      return typeof value.value === 'number' ? value.value : Number(value.value);
    case 'array':
      return ((value.value as RemoteValue[]) ?? []).map(fromRemote);
    case 'object':
      return Object.fromEntries(
        ((value.value as [string | RemoteValue, RemoteValue][]) ?? []).map(([key, item]) => [
          typeof key === 'string' ? key : String(fromRemote(key)),
          fromRemote(item),
        ])
      );
    case 'node':
      return { sharedId: value.sharedId };
    default:
      return value.value;
  }
}

interface EvaluateResult {
  type: 'success' | 'exception';
  result?: RemoteValue;
  exceptionDetails?: { text?: string };
}

export class BidiBrowserAdapter implements BrowserAdapter {
  private readonly client = new BidiClient();
  private session: BrowserSession | null = null;
  private context: string | null = null;

  async connect(session: BrowserSession): Promise<void> {
    this.session = session;
    await this.client.connect(session.browserWsUrl);
  }

  async goto(url: string, options?: { waitUntil?: string }): Promise<void> {
    this.assertConnected();
    // 和 Chromium 版一样，每次打开网页都开一个新标签页
    const created = await this.client.send<{ context: string }>('browsingContext.create', { type: 'tab' });
    this.context = created.context;
    await this.client.send('browsingContext.navigate', {
      context: created.context,
      url,
      wait: options?.waitUntil === 'commit' ? 'none' : 'complete',
    });
  }

  async selectTab(index: number): Promise<void> {
    this.assertConnected();
    if (!Number.isInteger(index) || index < 1) {
      throw new Error('TAB_INDEX_INVALID');
    }
    const selection = await selectEnvironmentRpaTab(this.session!.envUuid, index);
    this.context = this.requireContext(selection.target_id);
  }

  async closeTab(index: number): Promise<void> {
    this.assertConnected();
    if (!Number.isInteger(index) || index < 1) {
      throw new Error('TAB_INDEX_INVALID');
    }
    const result = await closeEnvironmentRpaTab(this.session!.envUuid, index);
    // 关掉之后当前的是运行时报告的活动标签页
    const tree = await this.client.send<{ contexts: { context: string }[] }>('browsingContext.getTree', { maxDepth: 0 });
    const active = tree.contexts[result.active_position];
    this.context = active?.context ?? tree.contexts[0]?.context ?? null;
    if (!this.context) {
      throw new Error('TAB_TARGET_UNAVAILABLE');
    }
  }

  async screenshot(options?: { fullPage?: boolean; target?: RpaWorkflowSelector }): Promise<string> {
    const context = this.assertContext();
    const params: Record<string, unknown> = {
      context,
      origin: options?.fullPage === true || options?.target ? 'document' : 'viewport',
    };
    if (options?.target) {
      const clip = (await this.evaluate(buildScreenshotClipExpression(options.target))) as Record<string, unknown> | null;
      const [x, y, width, height] = [clip?.x, clip?.y, clip?.width, clip?.height].map(Number);
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        throw new Error(`Failed to resolve screenshot area: ${JSON.stringify(options.target)}`);
      }
      params.clip = { type: 'box', x, y, width, height };
    }
    const result = await this.client.send<{ data?: string }>('browsingContext.captureScreenshot', params);
    return result.data ?? '';
  }

  async click(target: RpaWorkflowSelector): Promise<void> {
    if (!(await this.evaluate(buildClickExpression(target)))) {
      throw new Error(`Failed to click target: ${JSON.stringify(target)}`);
    }
  }

  async captureClickTarget(timeoutMs = 60000): Promise<RpaCapturedSelector> {
    await this.evaluate(INSTALL_CLICK_CAPTURE);
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const value = (await this.evaluate(READ_CLICK_CAPTURE)) as Record<string, unknown> | null;
      if (value && typeof value.xpath === 'string' && value.xpath.trim()) {
        await this.evaluate(CLEAR_CLICK_CAPTURE).catch(() => undefined);
        const primary: RpaWorkflowSelector = { by: 'xpath', value: value.xpath.trim() };
        const text = (key: string) => (typeof value[key] === 'string' ? (value[key] as string) : '');
        return {
          primary,
          candidates: [primary],
          snapshot: {
            tag: text('tag'),
            text: text('text'),
            id: text('id'),
            className: text('className'),
            role: text('role'),
            name: text('name'),
            placeholder: text('placeholder'),
            ariaLabel: text('ariaLabel'),
          },
        };
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    await this.evaluate(CLEAR_CLICK_CAPTURE).catch(() => undefined);
    throw new Error('Timed out waiting for a browser click');
  }

  async fill(target: RpaWorkflowSelector, value: string): Promise<void> {
    if (!(await this.evaluate(buildFillExpression(target, value)))) {
      throw new Error(`Failed to fill target: ${JSON.stringify(target)}`);
    }
  }

  async uploadFile(target: RpaWorkflowSelector, filePath: string): Promise<void> {
    const context = this.assertContext();
    const input = (await this.evaluate(buildUploadTargetExpression(target))) as { sharedId?: string } | null;
    if (!input?.sharedId) {
      throw new Error(`Failed to resolve upload target: ${JSON.stringify(target)}`);
    }
    // input.setFiles 自己会触发 input 和 change 事件
    await this.client.send('input.setFiles', { context, element: { sharedId: input.sharedId }, files: [filePath] });
  }

  async extract(options: BrowserExtractOptions): Promise<BrowserExtractResult> {
    const value = await this.evaluate(buildExtractExpression(options));
    return { value: typeof value === 'string' ? value : String(value ?? '') };
  }

  async executeScript(script: string): Promise<BrowserScriptResult> {
    const value = (await this.evaluate(buildExecuteScriptExpression(script))) as
      | { ok?: boolean; value?: unknown; error?: unknown }
      | undefined;
    if (!value?.ok) {
      throw new Error(typeof value?.error === 'string' ? value.error : 'SCRIPT_EXECUTION_FAILED');
    }
    return { value: typeof value.value === 'string' ? value.value : String(value.value ?? '') };
  }

  async scroll(options: {
    mode: 'to_element' | 'by_viewport' | 'to_edge';
    target?: RpaWorkflowSelector;
    direction?: 'down' | 'up';
    viewportCount?: number;
    edge?: 'top' | 'bottom';
    block?: 'start' | 'center' | 'end' | 'nearest';
  }): Promise<void> {
    if (!(await this.evaluate(buildScrollExpression(options)))) {
      throw new Error(`Failed to scroll with options: ${JSON.stringify(options)}`);
    }
  }

  async waitFor(target: RpaWorkflowSelector, timeoutMs = 10000): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (await this.evaluate(buildWaitForExpression(target))) {
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    throw new Error(`Timed out waiting for target: ${JSON.stringify(target)}`);
  }

  async evaluateCondition(condition: BrowserConditionCheck): Promise<boolean> {
    return Boolean(await this.evaluate(buildConditionExpression(condition)));
  }

  close(): void {
    this.client.close();
    this.session = null;
    this.context = null;
  }

  /** 在页面里执行表达式（和 Chromium 版一样在页面自己的环境里，脚本能用页面的变量） */
  private async evaluate(expression: string): Promise<unknown> {
    const context = this.assertContext();
    const result = await this.client.send<EvaluateResult>('script.evaluate', {
      expression,
      target: { context },
      awaitPromise: true,
      resultOwnership: 'none',
      serializationOptions: { maxDomDepth: 0, maxObjectDepth: 4 },
    });
    if (result.type === 'exception') {
      throw new Error(result.exceptionDetails?.text || 'SCRIPT_EXECUTION_FAILED');
    }
    return fromRemote(result.result);
  }

  private requireContext(value: unknown): string {
    const context = typeof value === 'string' ? value.trim() : '';
    if (!context) {
      throw new Error('TAB_TARGET_UNAVAILABLE');
    }
    return context;
  }

  private assertConnected(): void {
    if (!this.session) {
      throw new Error('Browser session has not been connected');
    }
  }

  private assertContext(): string {
    if (!this.context) {
      throw new Error('OPEN_PAGE_REQUIRED');
    }
    return this.context;
  }
}
