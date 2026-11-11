import type { RpaCapturedSelector, RpaSpeed, RpaWorkflowSelector } from '../types';
import type {
  BrowserAdapter,
  BrowserClickOptions,
  BrowserConditionCheck,
  BrowserExtractOptions,
  BrowserGotoOptions,
  BrowserScrollOptions,
  BrowserSession,
} from './browser-adapter';
import { RpaError } from './errors';
import {
  NAMED_KEYS,
  describeChar,
  keyDelay,
  mousePath,
  pauseDuration,
  pointInBox,
  pressDuration,
  speedProfile,
  wheelSegments,
  type KeyDescription,
  type NamedKey,
  type Point,
  type SpeedProfile,
} from './human-input';
import {
  CLEAR_PICKER,
  INSTALL_PICKER,
  READ_PICKER,
  READY_STATE_EXPRESSION,
  SCROLL_STATE_EXPRESSION,
  VIEWPORT_EXPRESSION,
  VISIBILITY_EXPRESSION,
  buildConditionExpression,
  buildExecuteScriptExpression,
  buildExtractExpression,
  buildFieldStateExpression,
  buildFocusExpression,
  buildLocateExpression,
  buildScreenshotClipExpression,
  buildScrollIntoViewExpression,
  buildSelectOptionExpression,
  buildSetValueExpression,
  buildUploadTargetExpression,
  type LocateResult,
} from './page-scripts';

export interface PageInfo {
  id: string;
  url: string;
}

export type World = 'isolated' | 'main';

export type MouseEventSpec =
  | { type: 'move'; x: number; y: number }
  | { type: 'down' | 'up'; x: number; y: number; button: 'left' | 'right'; clickCount: number }
  | { type: 'wheel'; x: number; y: number; deltaY: number };

export type KeySpec =
  | { kind: 'char'; description: KeyDescription; text: string }
  | { kind: 'named'; key: NamedKey }
  | { kind: 'select_all' };

const DEFAULT_ELEMENT_TIMEOUT = 10000;
const NAVIGATION_TIMEOUT = 60000;
const SETTLE_TIMEOUT = 30000;
/** 超过这个长度的文本，开头打字后其余一次写入（真人也是粘贴） */
const MAX_TYPED_CHARS = 200;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 页面跳转时执行环境被销毁，这类错误重试就好 */
const isTransient = (error: unknown) =>
  /context|navigat|detached|destroyed|no such frame|Inspected target|unique context|realm/i.test(
    error instanceof Error ? error.message : String(error)
  );

/**
 * 真实鼠标键盘操作的公共逻辑。子类（CDP、BiDi）只实现协议层的几个基本动作，
 * 等待、拟人轨迹、标签管理等行为在两种内核上完全一致。
 */
export abstract class BaseBrowserAdapter implements BrowserAdapter {
  protected session: BrowserSession | null = null;
  protected currentPage: string | null = null;
  private profile: SpeedProfile = speedProfile('normal');
  private mouse: Point | null = null;
  /** 这次运行打开的标签 */
  private readonly runTabs = new Set<string>();
  private readonly stepTabs = new Map<string, string>();
  /** 按首次看到的顺序记录标签，第 N 个标签的含义在一次运行内稳定 */
  private readonly tabOrder: string[] = [];

  protected abstract connectClient(session: BrowserSession): Promise<void>;
  protected abstract closeClient(): void;
  protected abstract listPages(): Promise<PageInfo[]>;
  protected abstract createPage(): Promise<string>;
  protected abstract activatePage(id: string): Promise<void>;
  protected abstract closePage(id: string): Promise<void>;
  protected abstract navigatePage(id: string, url: string, commitOnly: boolean): Promise<void>;
  protected abstract evaluateIn(id: string, expression: string, world: World): Promise<unknown>;
  protected abstract dispatchMouse(id: string, event: MouseEventSpec): Promise<void>;
  protected abstract dispatchKey(id: string, key: KeySpec): Promise<void>;
  protected abstract insertText(id: string, text: string): Promise<void>;
  protected abstract setInputFiles(id: string, elementExpression: string, filePath: string): Promise<boolean>;
  protected abstract captureScreenshot(
    id: string,
    options: { fullPage: boolean; clip?: { x: number; y: number; width: number; height: number } }
  ): Promise<string>;

  async connect(session: BrowserSession, options?: { speed?: RpaSpeed }): Promise<void> {
    this.session = session;
    this.profile = speedProfile(options?.speed ?? 'normal');
    await this.connectClient(session);
  }

  close(): void {
    this.closeClient();
    this.session = null;
    this.currentPage = null;
    this.mouse = null;
  }

  // ---------- 导航和标签

  async goto(url: string, options?: BrowserGotoOptions): Promise<void> {
    const page = await this.pageForNavigation(options);
    this.currentPage = page;
    await this.activatePage(page).catch(() => undefined);
    await this.navigatePage(page, url, options?.waitUntil === 'commit');
    if (options?.waitUntil !== 'commit') {
      await this.waitLoaded(NAVIGATION_TIMEOUT);
    }
  }

  private async pageForNavigation(options?: BrowserGotoOptions): Promise<string> {
    if (options?.newTab === false) {
      const current = await this.currentOrActivePage();
      if (current) return current;
    }
    if (options?.reuseKey) {
      const reused = this.stepTabs.get(options.reuseKey);
      if (reused && (await this.listPages()).some((page) => page.id === reused)) {
        return reused;
      }
    }
    const page = await this.createPage();
    this.runTabs.add(page);
    if (options?.reuseKey) this.stepTabs.set(options.reuseKey, page);
    return page;
  }

  async reload(): Promise<void> {
    await this.runAndSettle('location.reload()');
  }

  async goBack(): Promise<void> {
    await this.runAndSettle('history.back()');
  }

  async goForward(): Promise<void> {
    await this.runAndSettle('history.forward()');
  }

  private async runAndSettle(expression: string): Promise<void> {
    const page = await this.requirePage();
    await this.evaluateIn(page, `(() => { ${expression}; return true; })()`, 'isolated').catch((error) => {
      if (!isTransient(error)) throw error;
    });
    await sleep(300);
    await this.waitLoaded(NAVIGATION_TIMEOUT);
  }

  private async orderedPages(): Promise<PageInfo[]> {
    const pages = await this.listPages();
    for (const page of pages) {
      if (!this.tabOrder.includes(page.id)) this.tabOrder.push(page.id);
    }
    const alive = new Set(pages.map((page) => page.id));
    for (let i = this.tabOrder.length - 1; i >= 0; i -= 1) {
      if (!alive.has(this.tabOrder[i])) this.tabOrder.splice(i, 1);
    }
    return this.tabOrder.map((id) => pages.find((page) => page.id === id)!);
  }

  async selectTab(index: number): Promise<void> {
    const page = await this.pageAt(index);
    this.currentPage = page.id;
    await this.activatePage(page.id);
  }

  async closeTab(index: number): Promise<void> {
    const pages = await this.orderedPages();
    if (pages.length <= 1) throw new RpaError('LAST_TAB');
    const page = await this.pageAt(index);
    await this.closePage(page.id);
    this.runTabs.delete(page.id);
    if (this.currentPage === page.id) {
      const rest = await this.orderedPages();
      const next = rest[Math.min(index - 1, rest.length - 1)];
      this.currentPage = next.id;
      await this.activatePage(next.id).catch(() => undefined);
    }
  }

  private async pageAt(index: number): Promise<PageInfo> {
    if (!Number.isInteger(index) || index < 1) throw new RpaError('TAB_INDEX_INVALID');
    const page = (await this.orderedPages())[index - 1];
    if (!page) throw new RpaError('TAB_NOT_FOUND', String(index));
    return page;
  }

  async finishRun(): Promise<void> {
    const keep = this.currentPage;
    for (const id of this.runTabs) {
      if (id !== keep) await this.closePage(id).catch(() => undefined);
    }
    this.runTabs.clear();
    this.stepTabs.clear();
  }

  /** 当前标签；还没有时用浏览器当前显示的网页标签 */
  private async currentOrActivePage(): Promise<string | null> {
    const pages = await this.listPages();
    if (this.currentPage && pages.some((page) => page.id === this.currentPage)) {
      return this.currentPage;
    }
    this.currentPage = null;
    const web = pages.filter((page) => /^https?:/i.test(page.url));
    for (const page of web) {
      const state = await this.evaluateIn(page.id, VISIBILITY_EXPRESSION, 'isolated').catch(() => null);
      if (state === 'visible') {
        this.currentPage = page.id;
        return page.id;
      }
    }
    this.currentPage = web[0]?.id ?? null;
    return this.currentPage;
  }

  private async requirePage(): Promise<string> {
    const page = this.currentPage ?? (await this.currentOrActivePage());
    if (!page) throw new RpaError('OPEN_PAGE_REQUIRED');
    return page;
  }

  protected async evaluate(expression: string, world: World = 'isolated'): Promise<unknown> {
    const page = await this.requirePage();
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.evaluateIn(page, expression, world);
      } catch (error) {
        if (attempt >= 4 || !isTransient(error)) throw error;
        await sleep(250);
      }
    }
  }

  private async waitLoaded(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastState = '';
    while (Date.now() < deadline) {
      const result = (await this.evaluate(READY_STATE_EXPRESSION).catch(() => null)) as { state?: string } | null;
      if (!this.session) throw new RpaError('RUN_STOPPED');
      lastState = result?.state ?? '';
      if (lastState === 'complete') return;
      await sleep(150);
    }
    // 一直有资源在加载的页面到不了 complete，但已经能操作，不算失败
    if (lastState !== 'interactive') throw new RpaError('NAVIGATION_TIMEOUT');
  }

  // ---------- 元素等待

  private async locate(target: RpaWorkflowSelector): Promise<LocateResult> {
    return ((await this.evaluate(buildLocateExpression(target))) ?? { found: false }) as LocateResult;
  }

  /** 等元素出现且可见，滚到视口内，位置稳定且没被遮挡后返回它的位置 */
  private async waitActionable(target: RpaWorkflowSelector, timeoutMs = DEFAULT_ELEMENT_TIMEOUT): Promise<LocateResult> {
    const deadline = Date.now() + timeoutMs;
    let last: LocateResult = { found: false };
    let previous: LocateResult | null = null;
    while (Date.now() < deadline) {
      last = await this.locate(target);
      if (last.found && last.visible && !last.disabled) {
        if (!last.inView) {
          await this.bringIntoView(target, last);
          previous = null;
          continue;
        }
        const stable =
          previous && Math.abs(previous.x! - last.x!) < 1 && Math.abs(previous.y! - last.y!) < 1;
        if (stable && !last.obscured) return last;
        previous = last;
      }
      await sleep(120);
    }
    if (!last.found) throw new RpaError('ELEMENT_NOT_FOUND', target.value);
    if (!last.visible || last.disabled) throw new RpaError('ELEMENT_NOT_VISIBLE', target.value);
    throw new RpaError('ELEMENT_OBSCURED', target.value);
  }

  /** 用滚轮把元素滚到视口中间；页面内层滚动区域滚轮够不到时，退回直接定位 */
  private async bringIntoView(target: RpaWorkflowSelector, located: LocateResult): Promise<void> {
    const delta = located.y! + located.height! / 2 - located.viewportHeight! / 2;
    const before = (await this.evaluate(SCROLL_STATE_EXPRESSION)) as { y: number };
    await this.wheel(delta);
    const after = (await this.evaluate(SCROLL_STATE_EXPRESSION)) as { y: number };
    if (Math.abs(after.y - before.y) < 1) {
      await this.evaluate(buildScrollIntoViewExpression(target));
    }
    await sleep(pauseDuration(this.profile));
  }

  async waitFor(target: RpaWorkflowSelector, timeoutMs = DEFAULT_ELEMENT_TIMEOUT): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const located = await this.locate(target);
      if (located.found && located.visible) return;
      await sleep(200);
    }
    throw new RpaError('ELEMENT_NOT_FOUND', target.value);
  }

  // ---------- 鼠标

  private async moveMouseTo(point: Point): Promise<void> {
    const page = await this.requirePage();
    const view = (await this.evaluate(VIEWPORT_EXPRESSION)) as { width: number; height: number };
    if (!this.mouse) {
      this.mouse = { x: view.width * (0.2 + Math.random() * 0.6), y: view.height * (0.2 + Math.random() * 0.6) };
    }
    for (const step of mousePath(this.mouse, point, this.profile, Math.random, view)) {
      if (step.delayMs > 0) await sleep(step.delayMs);
      await this.dispatchMouse(page, { type: 'move', x: step.x, y: step.y });
    }
    this.mouse = point;
  }

  private async wheel(deltaY: number): Promise<void> {
    const page = await this.requirePage();
    const view = (await this.evaluate(VIEWPORT_EXPRESSION)) as { width: number; height: number };
    const point = this.mouse ?? { x: view.width / 2, y: view.height / 2 };
    for (const segment of wheelSegments(deltaY, this.profile)) {
      await this.dispatchMouse(page, { type: 'wheel', x: point.x, y: point.y, deltaY: segment.deltaY });
      await sleep(segment.delayMs);
    }
  }

  async hover(target: RpaWorkflowSelector, options?: { timeoutMs?: number }): Promise<void> {
    const box = await this.waitActionable(target, options?.timeoutMs);
    await this.moveMouseTo(pointInBox({ x: box.x!, y: box.y!, width: box.width!, height: box.height! }));
    await sleep(pauseDuration(this.profile));
  }

  async click(target: RpaWorkflowSelector, options?: BrowserClickOptions): Promise<void> {
    const before = new Set((await this.listPages()).map((page) => page.id));
    await this.clickAt(target, options);
    await this.afterClick(before);
  }

  private async clickAt(target: RpaWorkflowSelector, options?: BrowserClickOptions): Promise<void> {
    const box = await this.waitActionable(target, options?.timeoutMs);
    const point = pointInBox({ x: box.x!, y: box.y!, width: box.width!, height: box.height! });
    await this.moveMouseTo(point);
    await sleep(pauseDuration(this.profile));
    const page = await this.requirePage();
    const button = options?.button ?? 'left';
    if ((options?.clickCount ?? 1) === 2) {
      await this.dispatchDoubleClick(page, point, button);
      return;
    }
    await this.dispatchMouse(page, { type: 'down', ...point, button, clickCount: 1 });
    await sleep(pressDuration());
    await this.dispatchMouse(page, { type: 'up', ...point, button, clickCount: 1 });
  }

  protected async dispatchDoubleClick(page: string, point: Point, button: 'left' | 'right'): Promise<void> {
    for (const clickCount of [1, 2]) {
      await this.dispatchMouse(page, { type: 'down', ...point, button, clickCount });
      await sleep(pressDuration());
      await this.dispatchMouse(page, { type: 'up', ...point, button, clickCount });
      if (clickCount === 1) await sleep(pressDuration());
    }
  }

  /** 点击后：如果开了新标签就跟过去；如果触发了跳转就等加载完 */
  private async afterClick(pagesBefore: Set<string>): Promise<void> {
    for (let i = 0; i < 4; i += 1) {
      await sleep(150);
      const created = (await this.listPages()).find((page) => !pagesBefore.has(page.id));
      if (created) {
        this.runTabs.add(created.id);
        this.currentPage = created.id;
        this.mouse = null;
        await this.activatePage(created.id).catch(() => undefined);
        break;
      }
    }
    await this.waitLoaded(SETTLE_TIMEOUT).catch(() => undefined);
  }

  // ---------- 键盘

  async fill(
    target: RpaWorkflowSelector,
    value: string,
    options?: { clearFirst?: boolean; timeoutMs?: number }
  ): Promise<void> {
    await this.clickAt(target, { timeoutMs: options?.timeoutMs });
    const page = await this.requirePage();
    const state = (await this.evaluate(buildFieldStateExpression(target))) as {
      found: boolean;
      editable: boolean;
      focused: boolean;
      value: string;
    };
    if (!state.found || !state.editable) throw new RpaError('ELEMENT_NOT_EDITABLE', target.value);
    if (!state.focused) await this.evaluate(buildFocusExpression(target));

    if (options?.clearFirst !== false && state.value) {
      await this.dispatchKey(page, { kind: 'select_all' });
      await sleep(keyDelay(this.profile));
      await this.dispatchKey(page, { kind: 'named', key: NAMED_KEYS.Backspace });
      await sleep(keyDelay(this.profile));
    }
    await this.typeText(page, value);

    // 日期、颜色这类控件打字进不去，内容还是空的话直接写值
    const after = (await this.evaluate(buildFieldStateExpression(target))) as { value: string };
    if (value && !after.value) {
      await this.evaluate(buildSetValueExpression(target, value));
    }
  }

  private async typeText(page: string, text: string): Promise<void> {
    const chars = Array.from(text);
    const typed = chars.slice(0, MAX_TYPED_CHARS);
    for (const char of typed) {
      if (char === '\n') {
        await this.dispatchKey(page, { kind: 'named', key: NAMED_KEYS.Enter });
      } else {
        const description = describeChar(char);
        if (description) {
          await this.dispatchKey(page, { kind: 'char', description, text: char });
        } else {
          await this.insertText(page, char);
        }
      }
      await sleep(keyDelay(this.profile));
    }
    if (chars.length > typed.length) {
      await this.insertText(page, chars.slice(MAX_TYPED_CHARS).join(''));
    }
  }

  async pressKey(key: string): Promise<void> {
    const page = await this.requirePage();
    const named = NAMED_KEYS[key];
    if (named) {
      await this.dispatchKey(page, { kind: 'named', key: named });
    } else {
      await this.typeText(page, key);
    }
    await this.waitLoaded(SETTLE_TIMEOUT).catch(() => undefined);
  }

  // ---------- 其他元素操作

  async selectOption(
    target: RpaWorkflowSelector,
    option: { by: 'value' | 'label'; value: string },
    options?: { timeoutMs?: number }
  ): Promise<void> {
    await this.hover(target, options);
    const result = await this.evaluate(buildSelectOptionExpression(target, option));
    if (result === 'not_found') throw new RpaError('ELEMENT_NOT_FOUND', target.value);
    if (result === 'not_select') throw new RpaError('ELEMENT_NOT_SELECT', target.value);
    if (result === 'no_option') throw new RpaError('OPTION_NOT_FOUND', option.value);
  }

  async uploadFile(target: RpaWorkflowSelector, filePath: string, options?: { timeoutMs?: number }): Promise<void> {
    const page = await this.requirePage();
    // 文件框常常是隐藏的，这里只等它存在
    const deadline = Date.now() + (options?.timeoutMs ?? DEFAULT_ELEMENT_TIMEOUT);
    const expression = buildUploadTargetExpression(target);
    while (Date.now() < deadline) {
      if (await this.setInputFiles(page, expression, filePath)) return;
      await sleep(200);
    }
    throw new RpaError('UPLOAD_INPUT_NOT_FOUND', target.value);
  }

  async extract(options: BrowserExtractOptions): Promise<string> {
    const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_ELEMENT_TIMEOUT);
    let previous = -1;
    while (Date.now() < deadline) {
      const value = await this.evaluate(buildExtractExpression(options));
      if (value !== null && value !== undefined) {
        if (!Array.isArray(value)) return String(value);
        // 列表可能还在加载，数量连续两次一样才算加载完
        if (value.length === previous) return JSON.stringify(value);
        previous = value.length;
      }
      await sleep(300);
    }
    throw new RpaError('ELEMENT_NOT_FOUND', options.target.value);
  }

  async executeScript(script: string): Promise<string> {
    const result = (await this.evaluate(buildExecuteScriptExpression(script), 'main')) as
      | { ok?: boolean; value?: unknown; error?: unknown }
      | undefined;
    if (!result?.ok) throw new RpaError('SCRIPT_FAILED', String(result?.error ?? ''));
    return String(result.value ?? '');
  }

  async scroll(options: BrowserScrollOptions): Promise<void> {
    if (options.mode === 'to_element') {
      if (!options.target) throw new RpaError('ELEMENT_NOT_FOUND');
      await this.waitActionable(options.target, options.timeoutMs);
      if (options.block && options.block !== 'center') {
        await this.evaluate(buildScrollIntoViewExpression(options.target, options.block));
      }
      return;
    }
    const state = (await this.evaluate(SCROLL_STATE_EXPRESSION)) as { y: number; max: number; height: number };
    const delta =
      options.mode === 'by_viewport'
        ? state.height * Math.max(Number(options.viewportCount ?? 1) || 1, 0.1) * (options.direction === 'up' ? -1 : 1)
        : options.edge === 'top'
          ? -state.y
          : state.max - state.y;
    await this.wheel(delta);
    await sleep(pauseDuration(this.profile));
  }

  async evaluateCondition(condition: BrowserConditionCheck): Promise<boolean> {
    return Boolean(await this.evaluate(buildConditionExpression(condition)));
  }

  async screenshot(options?: { fullPage?: boolean; target?: RpaWorkflowSelector; timeoutMs?: number }): Promise<string> {
    const page = await this.requirePage();
    if (options?.target) {
      await this.waitFor(options.target, options.timeoutMs);
      const clip = (await this.evaluate(buildScreenshotClipExpression(options.target))) as {
        x: number;
        y: number;
        width: number;
        height: number;
      } | null;
      if (!clip) throw new RpaError('ELEMENT_NOT_FOUND', options.target.value);
      return this.captureScreenshot(page, { fullPage: true, clip });
    }
    return this.captureScreenshot(page, { fullPage: options?.fullPage === true });
  }

  // ---------- 拾取元素

  async pickElement(timeoutMs = 120000): Promise<RpaCapturedSelector> {
    const page = await this.requirePage();
    await this.activatePage(page).catch(() => undefined);
    await this.evaluate(INSTALL_PICKER);
    const deadline = Date.now() + timeoutMs;
    try {
      while (Date.now() < deadline) {
        // 拾取过程中页面可能跳转，脚本要重新装
        await this.evaluate(`(() => { if (!window.__picker) return ${INSTALL_PICKER}; return true; })()`);
        const value = (await this.evaluate(READ_PICKER)) as Record<string, unknown> | null;
        if (value) return toCaptured(value);
        await sleep(200);
      }
    } finally {
      await this.evaluate(CLEAR_PICKER).catch(() => undefined);
    }
    throw new RpaError('PICK_TIMEOUT');
  }
}

function toCaptured(value: Record<string, unknown>): RpaCapturedSelector {
  const text = (key: string) => (typeof value[key] === 'string' ? (value[key] as string) : '');
  const specs = (value.candidates as RpaWorkflowSelector[] | undefined) ?? [];
  const frames = (value.frames as string[] | undefined) ?? [];
  const [first, ...rest] = specs;
  const primary: RpaWorkflowSelector = {
    ...first,
    candidates: rest,
    ...(frames.length ? { frames } : {}),
  };
  return {
    primary,
    candidates: specs,
    similar: (value.similar as RpaCapturedSelector['similar']) ?? undefined,
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
