import type { BrowserAdapter, BrowserConditionCheck, BrowserExtractOptions, BrowserExtractResult, BrowserScriptResult, BrowserSession } from './browser-adapter';
import { CdpClient } from './cdp-client';
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

interface CdpCreateTargetResult {
  targetId: string;
}

interface CdpAttachToTargetResult {
  sessionId: string;
}

interface CdpScreenshotResult {
  data?: string;
}

interface CdpNavigateResult {
  errorText?: string;
}

interface RuntimeEvaluateResult {
  result?: {
    value?: unknown;
    objectId?: string;
    type?: string;
    subtype?: string;
  };
}

interface DomDocumentResult {
  root?: {
    nodeId: number;
  };
}

interface DomQuerySelectorResult {
  nodeId: number;
}

export class CdpBrowserAdapter implements BrowserAdapter {
  private readonly client = new CdpClient();
  private session: BrowserSession | null = null;
  private targetSessionId: string | null = null;
  private readonly targets: Array<{ targetId: string; sessionId: string }> = [];

  async connect(session: BrowserSession): Promise<void> {
    this.session = session;
    await this.client.connect(session.browserWsUrl);
  }

  async goto(url: string, options?: { waitUntil?: string }): Promise<void> {
    this.assertConnected();
    const waitUntil = options?.waitUntil === 'commit' ? 'commit' : 'load';
    const sessionId = await this.createPageSession();

    // Subscribe before sending Page.navigate: a fast page can fire its load event
    // before the navigate response is processed, and a late subscription would miss it.
    const waiters = new AbortController();
    const loaded =
      waitUntil === 'commit'
        ? null
        : Promise.any([
            this.client.waitForEvent('Page.loadEventFired', {
              sessionId,
              timeoutMs: 60000,
              signal: waiters.signal,
            }),
            this.client.waitForEvent('Page.frameStoppedLoading', {
              sessionId,
              timeoutMs: 60000,
              signal: waiters.signal,
            }),
          ]);
    // Never leave a rejected waiter unobserved if navigation fails first.
    loaded?.catch(() => undefined);

    try {
      const navigation = await this.client.send<CdpNavigateResult>(
        'Page.navigate',
        { url },
        sessionId
      );
      if (navigation.errorText) {
        throw new Error(navigation.errorText);
      }
      if (loaded) {
        await loaded;
      }
    } catch (error) {
      if (error instanceof AggregateError) {
        throw error.errors[0] instanceof Error ? error.errors[0] : error;
      }
      throw error;
    } finally {
      // Releases whichever waiter did not fire so it cannot leak until its timeout.
      waiters.abort();
    }
  }

  async selectTab(index: number): Promise<void> {
    this.assertConnected();

    if (!Number.isInteger(index) || index < 1) {
      throw new Error('TAB_INDEX_INVALID');
    }

    if (!this.session?.envUuid) {
      throw new Error('Browser session has not been connected');
    }

    const selection = await selectEnvironmentRpaTab(this.session.envUuid, index);
    const targetId = typeof selection.target_id === 'string' ? selection.target_id.trim() : '';
    if (!targetId) {
      throw new Error('TAB_TARGET_UNAVAILABLE');
    }

    const sessionId = await this.attachOrReuseTarget(targetId);
    this.targetSessionId = sessionId;
    await this.client.send('Page.bringToFront', undefined, sessionId).catch(() => undefined);
  }

  async closeTab(index: number): Promise<void> {
    this.assertConnected();

    if (!Number.isInteger(index) || index < 1) {
      throw new Error('TAB_INDEX_INVALID');
    }

    if (!this.session?.envUuid) {
      throw new Error('Browser session has not been connected');
    }

    const result = await closeEnvironmentRpaTab(this.session.envUuid, index);
    const targetId = typeof result.target_id === 'string' ? result.target_id.trim() : '';
    if (!targetId) {
      throw new Error('TAB_TARGET_UNAVAILABLE');
    }

    const sessionId = await this.attachOrReuseTarget(targetId);
    this.targetSessionId = sessionId;
    await this.client.send('Page.bringToFront', undefined, sessionId).catch(() => undefined);
  }

  async screenshot(options?: { fullPage?: boolean; target?: RpaWorkflowSelector }): Promise<string> {
    const sessionId = this.assertTargetSession();
    const params = {
      format: 'png',
      captureBeyondViewport: options?.fullPage === true || Boolean(options?.target),
    } as Record<string, unknown>;

    if (options?.target) {
      const clip = await this.resolveScreenshotClip(options.target, sessionId);
      params.clip = clip;
    }

    const result = await this.client.send<CdpScreenshotResult>(
      'Page.captureScreenshot',
      params,
      sessionId
    );
    return result.data ?? '';
  }

  async click(target: RpaWorkflowSelector): Promise<void> {
    const sessionId = this.assertTargetSession();
    const expression = buildClickExpression(target);
    const result = await this.client.send<RuntimeEvaluateResult>(
      'Runtime.evaluate',
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId
    );

    if (!result.result?.value) {
      throw new Error(`Failed to click target: ${JSON.stringify(target)}`);
    }
  }

  async captureClickTarget(timeoutMs = 60000): Promise<RpaCapturedSelector> {
    const sessionId = this.assertTargetSession();
    await this.installClickCapture(sessionId);

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const result = await this.client.send<RuntimeEvaluateResult>(
        'Runtime.evaluate',
        {
          expression: READ_CLICK_CAPTURE,
          returnByValue: true,
          awaitPromise: true,
        },
        sessionId
      );

      const value = result.result?.value as Record<string, unknown> | null | undefined;
      if (value && typeof value.xpath === 'string' && value.xpath.trim()) {
        await this.clearClickCapture(sessionId);
        const primary: RpaWorkflowSelector = {
          by: 'xpath',
          value: value.xpath.trim(),
        };

        return {
          primary,
          candidates: [primary],
          snapshot: {
            tag: this.readString(value.tag),
            text: this.readString(value.text),
            id: this.readString(value.id),
            className: this.readString(value.className),
            role: this.readString(value.role),
            name: this.readString(value.name),
            placeholder: this.readString(value.placeholder),
            ariaLabel: this.readString(value.ariaLabel),
          },
        };
      }

      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    await this.clearClickCapture(sessionId);
    throw new Error('Timed out waiting for a browser click');
  }

  async fill(target: RpaWorkflowSelector, value: string): Promise<void> {
    const sessionId = this.assertTargetSession();
    const expression = buildFillExpression(target, value);
    const result = await this.client.send<RuntimeEvaluateResult>(
      'Runtime.evaluate',
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId
    );

    if (!result.result?.value) {
      throw new Error(`Failed to fill target: ${JSON.stringify(target)}`);
    }
  }

  async uploadFile(target: RpaWorkflowSelector, filePath: string): Promise<void> {
    const sessionId = this.assertTargetSession();
    const result = await this.client.send<RuntimeEvaluateResult>(
      'Runtime.evaluate',
      {
        expression: buildUploadTargetExpression(target),
        returnByValue: false,
        awaitPromise: true,
      },
      sessionId
    );

    const objectId = result.result?.objectId;
    if (!objectId) {
      throw new Error(`Failed to resolve upload target: ${JSON.stringify(target)}`);
    }

    const marker = `mz-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.client.send(
      'Runtime.callFunctionOn',
      {
        objectId,
        functionDeclaration: `function() {
          this.setAttribute('data-mz-upload-marker', ${JSON.stringify(marker)});
        }`,
        awaitPromise: true,
      },
      sessionId
    );

    const documentResult = await this.client.send<DomDocumentResult>('DOM.getDocument', {}, sessionId);
    const rootNodeId = documentResult.root?.nodeId;
    if (!rootNodeId) {
      throw new Error(`Failed to resolve upload input: ${JSON.stringify(target)}`);
    }

    const queryResult = await this.client.send<DomQuerySelectorResult>(
      'DOM.querySelector',
      {
        nodeId: rootNodeId,
        selector: `[data-mz-upload-marker="${marker}"]`,
      },
      sessionId
    );

    if (!queryResult.nodeId) {
      throw new Error(`Failed to resolve upload input: ${JSON.stringify(target)}`);
    }

    await this.client.send(
      'DOM.setFileInputFiles',
      {
        files: [filePath],
        nodeId: queryResult.nodeId,
      },
      sessionId
    );

    await this.client.send(
      'Runtime.callFunctionOn',
      {
        objectId,
        functionDeclaration: `function() {
          this.removeAttribute('data-mz-upload-marker');
          this.dispatchEvent(new Event('input', { bubbles: true }));
          this.dispatchEvent(new Event('change', { bubbles: true }));
        }`,
        awaitPromise: true,
      },
      sessionId
    );
  }
  async extract(options: BrowserExtractOptions): Promise<BrowserExtractResult> {
    const sessionId = this.assertTargetSession();
    const result = await this.client.send<RuntimeEvaluateResult>(
      'Runtime.evaluate',
      {
        expression: buildExtractExpression(options),
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId
    );

    const value = result.result?.value;
    return {
      value: typeof value === 'string' ? value : String(value ?? ''),
    };
  }
  async executeScript(script: string): Promise<BrowserScriptResult> {
    const sessionId = this.assertTargetSession();
    const result = await this.client.send<RuntimeEvaluateResult>(
      'Runtime.evaluate',
      {
        expression: buildExecuteScriptExpression(script),
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId
    );

    const value = result.result?.value as { ok?: boolean; value?: unknown; error?: unknown } | undefined;
    if (!value?.ok) {
      throw new Error(typeof value?.error === 'string' ? value.error : 'SCRIPT_EXECUTION_FAILED');
    }

    return {
      value: typeof value.value === 'string' ? value.value : String(value.value ?? ''),
    };
  }

  async scroll(options: {
    mode: 'to_element' | 'by_viewport' | 'to_edge';
    target?: RpaWorkflowSelector;
    direction?: 'down' | 'up';
    viewportCount?: number;
    edge?: 'top' | 'bottom';
    block?: 'start' | 'center' | 'end' | 'nearest';
  }): Promise<void> {
    const sessionId = this.assertTargetSession();
    const expression = buildScrollExpression(options);
    const result = await this.client.send<RuntimeEvaluateResult>(
      'Runtime.evaluate',
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId
    );

    if (!result.result?.value) {
      throw new Error(`Failed to scroll with options: ${JSON.stringify(options)}`);
    }
  }
  async waitFor(target: RpaWorkflowSelector, timeoutMs = 10000): Promise<void> {
    const sessionId = this.assertTargetSession();
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const result = await this.client.send<RuntimeEvaluateResult>(
        'Runtime.evaluate',
        {
          expression: buildWaitForExpression(target),
          returnByValue: true,
          awaitPromise: true,
        },
        sessionId
      );

      if (result.result?.value) {
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    throw new Error(`Timed out waiting for target: ${JSON.stringify(target)}`);
  }

  async evaluateCondition(condition: BrowserConditionCheck): Promise<boolean> {
    const sessionId = this.assertTargetSession();
    const result = await this.client.send<RuntimeEvaluateResult>(
      'Runtime.evaluate',
      {
        expression: buildConditionExpression(condition),
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId
    );

    return Boolean(result.result?.value);
  }

  close(): void {
    for (const target of this.targets) {
      void this.client
        .send('Target.detachFromTarget', { sessionId: target.sessionId })
        .catch(() => undefined);
    }

    this.client.close();
    this.session = null;
    this.targetSessionId = null;
    this.targets.length = 0;
  }

  private assertConnected(): void {
    if (!this.session) {
      throw new Error('Browser session has not been connected');
    }
  }

  private assertTargetSession(): string {
    if (!this.targetSessionId) {
      throw new Error('OPEN_PAGE_REQUIRED');
    }

    return this.targetSessionId;
  }

  private async createPageSession(): Promise<string> {
    const target = await this.client.send<CdpCreateTargetResult>('Target.createTarget', {
      url: 'about:blank',
    });

    const sessionId = await this.attachOrReuseTarget(target.targetId);
    this.targetSessionId = sessionId;
    return sessionId;
  }

  private async attachOrReuseTarget(targetId: string): Promise<string> {
    const existing = this.targets.find((target) => target.targetId === targetId);
    if (existing) {
      return existing.sessionId;
    }

    const attached = await this.client.send<CdpAttachToTargetResult>('Target.attachToTarget', {
      targetId,
      flatten: true,
    });

    await this.client.send('Page.enable', undefined, attached.sessionId);
    await this.client.send('DOM.enable', undefined, attached.sessionId);
    // 不调用 Runtime.enable：它会让页面里的 Error.stack 序列化被观察到，是最常用的 CDP 检测特征。
    // 这里只用 Runtime.evaluate / callFunctionOn，不依赖 Runtime 事件，不开也能正常执行。

    this.targets.push({
      targetId,
      sessionId: attached.sessionId,
    });

    return attached.sessionId;
  }

  private async resolveScreenshotClip(
    target: RpaWorkflowSelector,
    sessionId: string
  ): Promise<{ x: number; y: number; width: number; height: number; scale: number }> {
    const expression = buildScreenshotClipExpression(target);
    const result = await this.client.send<RuntimeEvaluateResult>(
      'Runtime.evaluate',
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId
    );

    const clip = result.result?.value as Record<string, unknown> | undefined;
    const x = Number(clip?.x);
    const y = Number(clip?.y);
    const width = Number(clip?.width);
    const height = Number(clip?.height);

    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      throw new Error(`Failed to resolve screenshot area: ${JSON.stringify(target)}`);
    }

    return { x, y, width, height, scale: 1 };
  }

  private async installClickCapture(sessionId: string): Promise<void> {
    await this.client.send(
      'Runtime.evaluate',
      {
        expression: INSTALL_CLICK_CAPTURE,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId
    );
  }

  private async clearClickCapture(sessionId: string): Promise<void> {
    await this.client.send(
      'Runtime.evaluate',
      {
        expression: CLEAR_CLICK_CAPTURE,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId
    ).catch(() => undefined);
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}
