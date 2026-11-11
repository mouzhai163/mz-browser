import { BaseBrowserAdapter, type KeySpec, type MouseEventSpec, type PageInfo, type World } from './base-browser-adapter';
import type { BrowserSession } from './browser-adapter';
import { CdpClient } from './cdp-client';
import { RpaError } from './errors';

interface TargetInfo {
  targetId: string;
  type: string;
  url: string;
}

interface EvaluateResult {
  result?: { value?: unknown; objectId?: string };
  exceptionDetails?: { text?: string; exception?: { description?: string } };
}

const MODIFIER_CTRL = 2;
const MODIFIER_SHIFT = 8;

/** Chromium 内核的 RPA 适配器（CDP）：只实现协议层的基本动作，行为在 BaseBrowserAdapter 里 */
export class CdpBrowserAdapter extends BaseBrowserAdapter {
  private readonly client = new CdpClient();
  private readonly sessions = new Map<string, string>();
  /** 隔离环境的 id，页面跳转后失效，用到时重新创建 */
  private readonly worlds = new Map<string, number>();
  private buttons = 0;

  protected async connectClient(session: BrowserSession): Promise<void> {
    await this.client.connect(session.browserWsUrl);
    // 页面的 alert/confirm 会卡住后续所有命令，出现就自动确认
    this.client.on('Page.javascriptDialogOpening', (_params, sessionId) => {
      void this.client.send('Page.handleJavaScriptDialog', { accept: true }, sessionId).catch(() => undefined);
    });
  }

  protected closeClient(): void {
    for (const sessionId of this.sessions.values()) {
      void this.client.send('Target.detachFromTarget', { sessionId }).catch(() => undefined);
    }
    this.client.close();
    this.sessions.clear();
    this.worlds.clear();
  }

  protected async listPages(): Promise<PageInfo[]> {
    const result = await this.client.send<{ targetInfos: TargetInfo[] }>('Target.getTargets');
    return result.targetInfos
      .filter((target) => target.type === 'page' && !target.url.startsWith('devtools://'))
      .map((target) => ({ id: target.targetId, url: target.url }));
  }

  protected async createPage(): Promise<string> {
    const result = await this.client.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
    return result.targetId;
  }

  protected async activatePage(id: string): Promise<void> {
    await this.client.send('Target.activateTarget', { targetId: id });
  }

  protected async closePage(id: string): Promise<void> {
    await this.client.send('Target.closeTarget', { targetId: id });
    const sessionId = this.sessions.get(id);
    if (sessionId) this.worlds.delete(sessionId);
    this.sessions.delete(id);
  }

  protected async navigatePage(id: string, url: string): Promise<void> {
    const sessionId = await this.attach(id);
    this.worlds.delete(sessionId);
    const result = await this.client.send<{ errorText?: string }>('Page.navigate', { url }, sessionId);
    if (result.errorText) throw new RpaError('NAVIGATION_FAILED', `${url} (${result.errorText})`);
  }

  protected async evaluateIn(id: string, expression: string, world: World): Promise<unknown> {
    const result = await this.runtimeEvaluate(id, expression, world, true);
    return result.result?.value;
  }

  private async runtimeEvaluate(
    id: string,
    expression: string,
    world: World,
    returnByValue: boolean
  ): Promise<EvaluateResult> {
    const sessionId = await this.attach(id);
    const params: Record<string, unknown> = { expression, returnByValue, awaitPromise: true };
    if (world === 'isolated') params.contextId = await this.isolatedWorld(sessionId);
    let result: EvaluateResult;
    try {
      result = await this.client.send<EvaluateResult>('Runtime.evaluate', params, sessionId);
    } catch (error) {
      // 页面跳转后隔离环境没了：清掉，下次重建（上层会重试）
      this.worlds.delete(sessionId);
      throw error;
    }
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluate failed');
    }
    return result;
  }

  private async isolatedWorld(sessionId: string): Promise<number> {
    const cached = this.worlds.get(sessionId);
    if (cached !== undefined) return cached;
    const tree = await this.client.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree', undefined, sessionId);
    const created = await this.client.send<{ executionContextId: number }>(
      'Page.createIsolatedWorld',
      { frameId: tree.frameTree.frame.id, worldName: '' },
      sessionId
    );
    this.worlds.set(sessionId, created.executionContextId);
    return created.executionContextId;
  }

  private async attach(id: string): Promise<string> {
    const existing = this.sessions.get(id);
    if (existing) return existing;
    const attached = await this.client.send<{ sessionId: string }>('Target.attachToTarget', { targetId: id, flatten: true });
    // 不调用 Runtime.enable：它是最常用的 CDP 检测特征。Runtime.evaluate 不依赖它。
    await this.client.send('Page.enable', undefined, attached.sessionId);
    await this.client.send('DOM.enable', undefined, attached.sessionId);
    this.sessions.set(id, attached.sessionId);
    return attached.sessionId;
  }

  protected async dispatchMouse(id: string, event: MouseEventSpec): Promise<void> {
    const sessionId = await this.attach(id);
    if (event.type === 'wheel') {
      await this.client.send(
        'Input.dispatchMouseEvent',
        { type: 'mouseWheel', x: event.x, y: event.y, deltaX: 0, deltaY: event.deltaY },
        sessionId
      );
      return;
    }
    if (event.type === 'move') {
      await this.client.send(
        'Input.dispatchMouseEvent',
        { type: 'mouseMoved', x: event.x, y: event.y, button: 'none', buttons: this.buttons },
        sessionId
      );
      return;
    }
    const mask = event.button === 'right' ? 2 : 1;
    this.buttons = event.type === 'down' ? this.buttons | mask : this.buttons & ~mask;
    await this.client.send(
      'Input.dispatchMouseEvent',
      {
        type: event.type === 'down' ? 'mousePressed' : 'mouseReleased',
        x: event.x,
        y: event.y,
        button: event.button,
        buttons: this.buttons,
        clickCount: event.clickCount,
      },
      sessionId
    );
  }

  protected async dispatchKey(id: string, key: KeySpec): Promise<void> {
    const sessionId = await this.attach(id);
    const send = (params: Record<string, unknown>) => this.client.send('Input.dispatchKeyEvent', params, sessionId);
    if (key.kind === 'select_all') {
      const base = { key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: MODIFIER_CTRL };
      await send({ type: 'rawKeyDown', ...base, commands: ['selectAll'] });
      await send({ type: 'keyUp', ...base });
      return;
    }
    if (key.kind === 'named') {
      const base = {
        key: key.key.key,
        code: key.key.code,
        windowsVirtualKeyCode: key.key.vk,
        nativeVirtualKeyCode: key.key.vk,
      };
      await send({ type: key.key.text ? 'keyDown' : 'rawKeyDown', ...base, ...(key.key.text ? { text: key.key.text } : {}) });
      await send({ type: 'keyUp', ...base });
      return;
    }
    const base = {
      key: key.description.key,
      code: key.description.code,
      windowsVirtualKeyCode: key.description.vk,
      nativeVirtualKeyCode: key.description.vk,
      modifiers: key.description.shift ? MODIFIER_SHIFT : 0,
    };
    await send({ type: 'keyDown', ...base, text: key.text, unmodifiedText: key.text });
    await send({ type: 'keyUp', ...base });
  }

  protected async insertText(id: string, text: string): Promise<void> {
    await this.client.send('Input.insertText', { text }, await this.attach(id));
  }

  protected async setInputFiles(id: string, elementExpression: string, filePath: string): Promise<boolean> {
    const result = await this.runtimeEvaluate(id, elementExpression, 'isolated', false);
    const objectId = result.result?.objectId;
    if (!objectId) return false;
    // DOM.setFileInputFiles 自己会触发 input 和 change 事件
    await this.client.send('DOM.setFileInputFiles', { files: [filePath], objectId }, await this.attach(id));
    return true;
  }

  protected async captureScreenshot(
    id: string,
    options: { fullPage: boolean; clip?: { x: number; y: number; width: number; height: number } }
  ): Promise<string> {
    const result = await this.client.send<{ data?: string }>(
      'Page.captureScreenshot',
      {
        format: 'png',
        captureBeyondViewport: options.fullPage,
        ...(options.clip ? { clip: { ...options.clip, scale: 1 } } : {}),
      },
      await this.attach(id)
    );
    return result.data ?? '';
  }
}
