import type { RpaCapturedSelector, RpaWorkflowSelector } from '../types';

export interface BrowserSession {
  envUuid: string;
  browserWsUrl: string;
}

export type BrowserConditionCheck =
  | { type: 'element_visible'; target: RpaWorkflowSelector }
  | { type: 'text_present'; text: string }
  | { type: 'url_contains'; value: string };

export interface BrowserExtractOptions {
  target: RpaWorkflowSelector;
  extractType: 'text' | 'href' | 'value';
}

export interface BrowserExtractResult {
  value: string;
}

export interface BrowserScriptResult {
  value: string;
}

export interface BrowserAdapter {
  connect(session: BrowserSession): Promise<void>;
  goto(url: string, options?: { waitUntil?: string }): Promise<void>;
  selectTab(index: number): Promise<void>;
  closeTab(index: number): Promise<void>;
  screenshot(options?: { fullPage?: boolean; target?: RpaWorkflowSelector }): Promise<string>;
  click(target: RpaWorkflowSelector): Promise<void>;
  captureClickTarget(timeoutMs?: number): Promise<RpaCapturedSelector>;
  fill(target: RpaWorkflowSelector, value: string): Promise<void>;
  uploadFile(target: RpaWorkflowSelector, filePath: string): Promise<void>;
  extract(options: BrowserExtractOptions): Promise<BrowserExtractResult>;
  executeScript(script: string): Promise<BrowserScriptResult>;
  scroll(options: {
    mode: 'to_element' | 'by_viewport' | 'to_edge';
    target?: RpaWorkflowSelector;
    direction?: 'down' | 'up';
    viewportCount?: number;
    edge?: 'top' | 'bottom';
    block?: 'start' | 'center' | 'end' | 'nearest';
  }): Promise<void>;
  waitFor(target: RpaWorkflowSelector, timeoutMs?: number): Promise<void>;
  evaluateCondition(condition: BrowserConditionCheck): Promise<boolean>;
  close(): void;
}

export interface BrowserAdapterRunResult {
  screenshots: string[];
}
