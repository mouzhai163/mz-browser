import type { RpaCapturedSelector, RpaSpeed, RpaWorkflowSelector } from '../types';

export interface BrowserSession {
  envUuid: string;
  browserWsUrl: string;
}

export type BrowserConditionCheck =
  | { type: 'element_visible'; target: RpaWorkflowSelector }
  | { type: 'text_present'; text: string }
  | { type: 'url_contains'; value: string };

export type BrowserExtractType = 'text' | 'href' | 'value' | 'html' | 'attribute';

export interface BrowserExtractOptions {
  target: RpaWorkflowSelector;
  extractType: BrowserExtractType;
  attribute?: string;
  /** 取全部匹配项，结果是 JSON 数组 */
  all?: boolean;
  timeoutMs?: number;
}

export interface BrowserScrollOptions {
  mode: 'to_element' | 'by_viewport' | 'to_edge';
  target?: RpaWorkflowSelector;
  direction?: 'down' | 'up';
  viewportCount?: number;
  edge?: 'top' | 'bottom';
  block?: 'start' | 'center' | 'end' | 'nearest';
  timeoutMs?: number;
}

export interface BrowserGotoOptions {
  waitUntil?: string;
  /** 在新标签打开；false 时在当前标签打开 */
  newTab?: boolean;
  /** 同一步骤重复执行（循环）时复用它开过的标签 */
  reuseKey?: string;
}

export interface BrowserClickOptions {
  button?: 'left' | 'right';
  clickCount?: 1 | 2;
  timeoutMs?: number;
}

export interface BrowserAdapter {
  connect(session: BrowserSession, options?: { speed?: RpaSpeed }): Promise<void>;
  goto(url: string, options?: BrowserGotoOptions): Promise<void>;
  reload(): Promise<void>;
  goBack(): Promise<void>;
  goForward(): Promise<void>;
  selectTab(index: number): Promise<void>;
  closeTab(index: number): Promise<void>;
  screenshot(options?: { fullPage?: boolean; target?: RpaWorkflowSelector; timeoutMs?: number }): Promise<string>;
  click(target: RpaWorkflowSelector, options?: BrowserClickOptions): Promise<void>;
  hover(target: RpaWorkflowSelector, options?: { timeoutMs?: number }): Promise<void>;
  fill(target: RpaWorkflowSelector, value: string, options?: { clearFirst?: boolean; timeoutMs?: number }): Promise<void>;
  pressKey(key: string): Promise<void>;
  selectOption(
    target: RpaWorkflowSelector,
    option: { by: 'value' | 'label'; value: string },
    options?: { timeoutMs?: number }
  ): Promise<void>;
  uploadFile(target: RpaWorkflowSelector, filePath: string, options?: { timeoutMs?: number }): Promise<void>;
  extract(options: BrowserExtractOptions): Promise<string>;
  executeScript(script: string): Promise<string>;
  scroll(options: BrowserScrollOptions): Promise<void>;
  waitFor(target: RpaWorkflowSelector, timeoutMs?: number): Promise<void>;
  evaluateCondition(condition: BrowserConditionCheck): Promise<boolean>;
  /** 让用户在浏览器里点一下来拾取元素 */
  pickElement(timeoutMs?: number): Promise<RpaCapturedSelector>;
  /** 运行结束：关闭这次运行开的标签，只留当前这个 */
  /** 关闭这次运行打开的标签，默认留下当前标签；keepCurrent 为 false 时全部关闭 */
  finishRun(options?: { keepCurrent?: boolean }): Promise<void>;
  close(): void;
}
