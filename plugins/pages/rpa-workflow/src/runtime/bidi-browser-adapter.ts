import { BaseBrowserAdapter, type KeySpec, type MouseEventSpec, type PageInfo, type World } from './base-browser-adapter';
import type { BrowserSession } from './browser-adapter';

/**
 * Firefox 内核的 RPA 适配器（WebDriver BiDi）。
 *
 * 连的是运行时的共用会话转发地址（一个 Firefox 只能有一个 BiDi 会话）。这里只实现协议层的基本动作，
 * 等待、拟人轨迹、标签管理在 BaseBrowserAdapter 里，和 Chromium 完全一致。
 */

interface BidiMessage {
  id?: number;
  type?: string;
  method?: string;
  params?: Record<string, unknown>;
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
  onEvent: ((method: string, params: Record<string, unknown>) => void) | null = null;

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
    let message: BidiMessage;
    try {
      message = JSON.parse(event.data) as BidiMessage;
    } catch {
      return;
    }
    if (message.type === 'event') {
      if (message.method) this.onEvent?.(message.method, message.params ?? {});
      return;
    }
    if (typeof message.id !== 'number') return;
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

const SANDBOX = 'mz';
const CONTROL_KEY = '';
const SHIFT_KEY = '';

export class BidiBrowserAdapter extends BaseBrowserAdapter {
  private readonly client = new BidiClient();

  protected async connectClient(session: BrowserSession): Promise<void> {
    await this.client.connect(session.browserWsUrl);
    // 页面的 alert/confirm 会卡住后续命令，出现就自动确认
    this.client.onEvent = (method, params) => {
      if (method === 'browsingContext.userPromptOpened') {
        void this.client
          .send('browsingContext.handleUserPrompt', { context: params.context, accept: true })
          .catch(() => undefined);
      }
    };
    await this.client.send('session.subscribe', { events: ['browsingContext.userPromptOpened'] }).catch(() => undefined);
  }

  protected closeClient(): void {
    this.client.close();
  }

  protected async listPages(): Promise<PageInfo[]> {
    const tree = await this.client.send<{ contexts: { context: string; url: string }[] }>('browsingContext.getTree', {
      maxDepth: 0,
    });
    return tree.contexts.map((item) => ({ id: item.context, url: item.url }));
  }

  protected async createPage(): Promise<string> {
    const created = await this.client.send<{ context: string }>('browsingContext.create', { type: 'tab' });
    return created.context;
  }

  protected async activatePage(id: string): Promise<void> {
    await this.client.send('browsingContext.activate', { context: id });
  }

  protected async closePage(id: string): Promise<void> {
    await this.client.send('browsingContext.close', { context: id });
  }

  protected async navigatePage(id: string, url: string, commitOnly: boolean): Promise<void> {
    await this.client.send('browsingContext.navigate', {
      context: id,
      url,
      wait: commitOnly ? 'none' : 'interactive',
    });
  }

  protected async evaluateIn(id: string, expression: string, world: World): Promise<unknown> {
    return fromRemote(await this.evaluateRemote(id, expression, world));
  }

  private async evaluateRemote(id: string, expression: string, world: World): Promise<RemoteValue | undefined> {
    const result = await this.client.send<EvaluateResult>('script.evaluate', {
      expression,
      target: world === 'isolated' ? { context: id, sandbox: SANDBOX } : { context: id },
      awaitPromise: true,
      resultOwnership: 'none',
      serializationOptions: { maxDomDepth: 0, maxObjectDepth: 4 },
    });
    if (result.type === 'exception') {
      throw new Error(result.exceptionDetails?.text || 'evaluate failed');
    }
    return result.result;
  }

  private perform(id: string, source: Record<string, unknown>): Promise<unknown> {
    return this.client.send('input.performActions', { context: id, actions: [source] });
  }

  protected async dispatchMouse(id: string, event: MouseEventSpec): Promise<void> {
    const x = Math.round(event.x);
    const y = Math.round(event.y);
    if (event.type === 'wheel') {
      await this.perform(id, {
        type: 'wheel',
        id: 'mz-wheel',
        actions: [{ type: 'scroll', x, y, deltaX: 0, deltaY: Math.round(event.deltaY) }],
      });
      return;
    }
    const pointer = { type: 'pointer', id: 'mz-mouse', parameters: { pointerType: 'mouse' } };
    if (event.type === 'move') {
      await this.perform(id, { ...pointer, actions: [{ type: 'pointerMove', x, y, duration: 0, origin: 'viewport' }] });
      return;
    }
    const button = event.button === 'right' ? 2 : 0;
    await this.perform(id, { ...pointer, actions: [{ type: event.type === 'down' ? 'pointerDown' : 'pointerUp', button }] });
  }

  /** BiDi 按两次是否算双击取决于同一动作序列，所以一次发完 */
  protected async dispatchDoubleClick(id: string, point: { x: number; y: number }, button: 'left' | 'right'): Promise<void> {
    const code = button === 'right' ? 2 : 0;
    const press = [
      { type: 'pointerDown', button: code },
      { type: 'pause', duration: 70 },
      { type: 'pointerUp', button: code },
    ];
    await this.perform(id, {
      type: 'pointer',
      id: 'mz-mouse',
      parameters: { pointerType: 'mouse' },
      actions: [
        { type: 'pointerMove', x: Math.round(point.x), y: Math.round(point.y), duration: 0, origin: 'viewport' },
        ...press,
        { type: 'pause', duration: 90 },
        ...press,
      ],
    });
  }

  protected async dispatchKey(id: string, key: KeySpec): Promise<void> {
    const press = (value: string) => [
      { type: 'keyDown', value },
      { type: 'keyUp', value },
    ];
    const keyboard = (actions: unknown[]) => this.perform(id, { type: 'key', id: 'mz-keyboard', actions });
    if (key.kind === 'select_all') {
      await keyboard([{ type: 'keyDown', value: CONTROL_KEY }, ...press('a'), { type: 'keyUp', value: CONTROL_KEY }]);
    } else if (key.kind === 'named') {
      await keyboard(press(key.key.bidi));
    } else if (key.description.shift) {
      await keyboard([{ type: 'keyDown', value: SHIFT_KEY }, ...press(key.text), { type: 'keyUp', value: SHIFT_KEY }]);
    } else {
      await keyboard(press(key.text));
    }
  }

  protected async insertText(id: string, text: string): Promise<void> {
    const actions = Array.from(text).flatMap((value) => [
      { type: 'keyDown', value },
      { type: 'keyUp', value },
    ]);
    await this.perform(id, { type: 'key', id: 'mz-keyboard', actions });
  }

  protected async setInputFiles(id: string, elementExpression: string, filePath: string): Promise<boolean> {
    const remote = await this.evaluateRemote(id, elementExpression, 'isolated');
    if (!remote?.sharedId) return false;
    // input.setFiles 自己会触发 input 和 change 事件
    await this.client.send('input.setFiles', { context: id, element: { sharedId: remote.sharedId }, files: [filePath] });
    return true;
  }

  protected async captureScreenshot(
    id: string,
    options: { fullPage: boolean; clip?: { x: number; y: number; width: number; height: number } }
  ): Promise<string> {
    const result = await this.client.send<{ data?: string }>('browsingContext.captureScreenshot', {
      context: id,
      origin: options.fullPage ? 'document' : 'viewport',
      ...(options.clip ? { clip: { type: 'box', ...options.clip } } : {}),
    });
    return result.data ?? '';
  }
}
