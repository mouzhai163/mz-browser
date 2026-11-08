import type { BrowserAdapter, BrowserConditionCheck, BrowserExtractOptions, BrowserExtractResult, BrowserScriptResult, BrowserSession } from './browser-adapter';
import { CdpClient } from './cdp-client';
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
    const expression = this.buildClickExpression(target);
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
          expression: `(() => {
            const state = window.__mzRpaClickCapture;
            return state?.result ?? null;
          })()`,
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
    const expression = this.buildFillExpression(target, value);
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
        expression: this.buildUploadTargetExpression(target),
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
        expression: this.buildExtractExpression(options),
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
        expression: this.buildExecuteScriptExpression(script),
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
    const expression = this.buildScrollExpression(options);
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
          expression: this.buildWaitForExpression(target),
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
        expression: this.buildConditionExpression(condition),
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
    await this.client.send('Runtime.enable', undefined, attached.sessionId);

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
    const expression = this.buildScreenshotClipExpression(target);
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


  private buildUploadTargetExpression(target: RpaWorkflowSelector): string {
    const targetValue = JSON.stringify(target.value);
    const resolveElement =
      target.by === 'xpath'
        ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
        : `document.querySelector(${targetValue})`;

    return `(() => {
      const element = ${resolveElement};
      if (!(element instanceof Element)) {
        return null;
      }

      const resolveFileInput = (node) => {
        if (node instanceof HTMLInputElement && node.type === 'file') {
          return node;
        }

        if (node instanceof HTMLLabelElement && node.htmlFor) {
          const linked = document.getElementById(node.htmlFor);
          if (linked instanceof HTMLInputElement && linked.type === 'file') {
            return linked;
          }
        }

        if (node instanceof Element) {
          const nested = node.querySelector('input[type="file"]');
          if (nested instanceof HTMLInputElement) {
            return nested;
          }

          const closestLabel = node.closest('label');
          if (closestLabel instanceof HTMLLabelElement) {
            if (closestLabel.htmlFor) {
              const linked = document.getElementById(closestLabel.htmlFor);
              if (linked instanceof HTMLInputElement && linked.type === 'file') {
                return linked;
              }
            }

            const labelNested = closestLabel.querySelector('input[type="file"]');
            if (labelNested instanceof HTMLInputElement) {
              return labelNested;
            }
          }
        }

        return null;
      };

      return resolveFileInput(element);
    })()`;
  }

  private buildExtractExpression(options: BrowserExtractOptions): string {
    const targetValue = JSON.stringify(options.target.value);
    const resolveElement =
      options.target.by === 'xpath'
        ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
        : `document.querySelector(${targetValue})`;

    if (options.extractType === 'href') {
      return `(() => {
        const element = ${resolveElement};
        if (!(element instanceof Element)) {
          return '';
        }
        return element.getAttribute('href') ?? (element instanceof HTMLAnchorElement ? element.href : '');
      })()`;
    }

    if (options.extractType === 'value') {
      return `(() => {
        const element = ${resolveElement};
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ) {
          return element.value ?? '';
        }
        if (element instanceof Element) {
          return element.getAttribute('value') ?? '';
        }
        return '';
      })()`;
    }


    return `(() => {
      const element = ${resolveElement};
      if (element instanceof HTMLElement) {
        return (element.innerText ?? element.textContent ?? '').trim();
      }
      if (element instanceof Element) {
        return (element.textContent ?? '').trim();
      }
      return '';
    })()`;
  }

  private buildExecuteScriptExpression(script: string): string {
    const scriptBody = JSON.stringify(script);
    return `(async () => {
      try {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const runner = new AsyncFunction(${scriptBody});
        const result = await runner();
        if (typeof result === 'string') {
          return { ok: true, value: result };
        }
        if (result == null) {
          return { ok: true, value: '' };
        }
        if (typeof result === 'object') {
          return { ok: true, value: JSON.stringify(result) };
        }
        return { ok: true, value: String(result) };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error ?? 'SCRIPT_EXECUTION_FAILED') };
      }
    })()`;
  }

  private buildConditionExpression(condition: BrowserConditionCheck): string {
    if (condition.type === 'text_present') {
      const textValue = JSON.stringify(condition.text);
      return `(() => document.body?.innerText?.includes(${textValue}) ?? false)()`;
    }

    if (condition.type === 'url_contains') {
      const fragmentValue = JSON.stringify(condition.value);
      return `(() => window.location.href.includes(${fragmentValue}))()`;
    }

    return this.buildWaitForExpression(condition.target);
  }
  private buildWaitForExpression(target: RpaWorkflowSelector): string {
    const targetValue = JSON.stringify(target.value);
    const resolveElement =
      target.by === 'xpath'
        ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
        : `document.querySelector(${targetValue})`;

    return `(() => {
      const element = ${resolveElement};
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    })()`;
  }
  private buildScreenshotClipExpression(target: RpaWorkflowSelector): string {
    const targetValue = JSON.stringify(target.value);
    const resolveElement =
      target.by === 'xpath'
        ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
        : `document.querySelector(${targetValue})`;

    return `(() => {
      const element = ${resolveElement};
      if (!(element instanceof HTMLElement)) {
        return null;
      }

      element.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      };
    })()`;
  }
  private buildScrollExpression(options: {
    mode: 'to_element' | 'by_viewport' | 'to_edge';
    target?: RpaWorkflowSelector;
    direction?: 'down' | 'up';
    viewportCount?: number;
    edge?: 'top' | 'bottom';
    block?: 'start' | 'center' | 'end' | 'nearest';
  }): string {
    if (options.mode === 'to_element') {
      const target = options.target;
      if (!target) {
        return 'false';
      }
      const targetValue = JSON.stringify(target.value);
      const block = JSON.stringify(options.block ?? 'center');
      const resolveElement =
        target.by === 'xpath'
          ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
          : `document.querySelector(${targetValue})`;

      return `(() => {
        const element = ${resolveElement};
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        element.scrollIntoView({ block: ${block}, inline: 'nearest', behavior: 'auto' });
        return true;
      })()`;
    }

    if (options.mode === 'by_viewport') {
      const viewportCount = Math.max(Number(options.viewportCount ?? 1) || 1, 1);
      const sign = options.direction === 'up' ? -1 : 1;
      return `(() => {
        window.scrollBy({ top: window.innerHeight * ${sign * viewportCount}, behavior: 'auto' });
        return true;
      })()`;
    }

    const topValue = options.edge === 'top' ? '0' : 'Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)';
    return `(() => {
      window.scrollTo({ top: ${topValue}, behavior: 'auto' });
      return true;
    })()`;
  }
  private buildFillExpression(target: RpaWorkflowSelector, value: string): string {
    const targetValue = JSON.stringify(target.value);
    const inputValue = JSON.stringify(value);
    const resolveElement =
      target.by === 'xpath'
        ? `document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
        : `document.querySelector(${targetValue})`;

    return `(() => {
      const element = ${resolveElement};
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      element.scrollIntoView({ block: 'center', inline: 'center' });
      element.focus();

      const applyValue = (input) => {
        const prototype = input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor?.set) {
          descriptor.set.call(input, ${inputValue});
        } else {
          input.value = ${inputValue};
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return applyValue(element);
      }

      if (element.isContentEditable) {
        element.textContent = ${inputValue};
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      return false;
    })()`;
  }
  private buildClickExpression(target: RpaWorkflowSelector): string {
    const targetValue = JSON.stringify(target.value);

    if (target.by === 'xpath') {
      return `(() => {
        const element = document.evaluate(${targetValue}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        element.scrollIntoView({ block: 'center', inline: 'center' });
        element.click();
        return true;
      })()`;
    }

    return `(() => {
      const element = document.querySelector(${targetValue});
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      element.scrollIntoView({ block: 'center', inline: 'center' });
      element.click();
      return true;
    })()`;
  }

  private async installClickCapture(sessionId: string): Promise<void> {
    await this.client.send(
      'Runtime.evaluate',
      {
        expression: `(() => {
          const key = '__mzRpaClickCapture';
          const existing = window[key];
          if (existing?.active) {
            existing.result = null;
            return true;
          }

          const buildXPath = (node) => {
            if (!(node instanceof Element)) return '';
            if (node.id) {
              return '//*[@id=' + JSON.stringify(node.id) + ']';
            }

            const parts = [];
            let current = node;
            while (current && current.nodeType === 1) {
              let index = 1;
              let sibling = current.previousElementSibling;
              while (sibling) {
                if (sibling.tagName === current.tagName) {
                  index += 1;
                }
                sibling = sibling.previousElementSibling;
              }
              parts.unshift(current.tagName.toLowerCase() + '[' + index + ']');
              current = current.parentElement;
            }
            return '//' + parts.join('/');
          };

          const restoreInteractiveFeedback = (element) => {
            if (!(element instanceof HTMLElement)) {
              return;
            }

            if (
              element instanceof HTMLInputElement ||
              element instanceof HTMLTextAreaElement ||
              element instanceof HTMLSelectElement ||
              element instanceof HTMLButtonElement ||
              element instanceof HTMLAnchorElement ||
              element.isContentEditable
            ) {
              element.focus();
            }
          };

          const cleanup = (element) => {
            document.removeEventListener('click', state.onClick, true);
            if (state.highlighted instanceof HTMLElement) {
              state.highlighted.style.outline = state.previousOutline || '';
            }
            document.removeEventListener('mouseover', state.onHover, true);
            state.active = false;
            restoreInteractiveFeedback(element);
          };

          const state = {
            active: true,
            result: null,
            highlighted: null,
            previousOutline: '',
            onHover: (event) => {
              const element = event.target instanceof HTMLElement ? event.target : null;
              if (!element) return;
              if (state.highlighted instanceof HTMLElement) {
                state.highlighted.style.outline = state.previousOutline || '';
              }
              state.highlighted = element;
              state.previousOutline = element.style.outline || '';
              element.style.outline = '2px solid #0ea5e9';
            },
            onClick: (event) => {
              const element = event.target instanceof Element ? event.target : null;
              if (!element) return;
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              state.result = {
                xpath: buildXPath(element),
                tag: element.tagName.toLowerCase(),
                text: (element.textContent || '').trim().slice(0, 200),
                id: element.id || '',
                className: typeof element.className === 'string' ? element.className : '',
                role: element.getAttribute('role') || '',
                name: element.getAttribute('name') || '',
                placeholder: element.getAttribute('placeholder') || '',
                ariaLabel: element.getAttribute('aria-label') || '',
              };
              cleanup(element);
            },
          };

          document.addEventListener('mouseover', state.onHover, true);
          document.addEventListener('click', state.onClick, true);
          window[key] = state;
          return true;
        })()`,
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
        expression: `(() => {
          const key = '__mzRpaClickCapture';
          const state = window[key];
          if (state?.highlighted instanceof HTMLElement) {
            state.highlighted.style.outline = state.previousOutline || '';
          }
          if (state?.onClick) {
            document.removeEventListener('click', state.onClick, true);
          }
          if (state?.onHover) {
            document.removeEventListener('mouseover', state.onHover, true);
          }
          delete window[key];
          return true;
        })()`,
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
