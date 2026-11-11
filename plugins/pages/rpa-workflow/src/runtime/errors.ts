/**
 * 运行时错误：内部用错误码，显示给用户时统一翻译成人话。
 * 编辑器和任务列表都走 describeRunError，不再各自维护一套翻译。
 */

export type RpaErrorCode =
  | 'RUN_STOPPED'
  | 'RUN_TIMEOUT'
  | 'OPEN_PAGE_REQUIRED'
  | 'PAGE_CLOSED'
  | 'TAB_INDEX_INVALID'
  | 'TAB_NOT_FOUND'
  | 'LAST_TAB'
  | 'ELEMENT_NOT_FOUND'
  | 'ELEMENT_NOT_VISIBLE'
  | 'ELEMENT_OBSCURED'
  | 'ELEMENT_NOT_EDITABLE'
  | 'ELEMENT_NOT_SELECT'
  | 'OPTION_NOT_FOUND'
  | 'UPLOAD_INPUT_NOT_FOUND'
  | 'NAVIGATION_FAILED'
  | 'NAVIGATION_TIMEOUT'
  | 'PICK_TIMEOUT'
  | 'SCRIPT_FAILED'
  | 'BROWSER_DISCONNECTED'
  | 'BROWSER_TIMEOUT'
  | 'BREAK_LOOP_OUTSIDE_LOOP'
  | 'STEP_NOT_SUPPORTED';

export class RpaError extends Error {
  readonly code: RpaErrorCode;
  readonly detail?: string;

  constructor(code: RpaErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'RpaError';
    this.code = code;
    this.detail = detail;
  }
}

export function isStopError(error: unknown): boolean {
  return error instanceof RpaError && error.code === 'RUN_STOPPED';
}

/** 底层协议的错误文字归类成错误码，归不了类的原样保留 */
function classify(error: unknown): { code: RpaErrorCode | null; detail: string } {
  if (error instanceof RpaError) {
    return { code: error.code, detail: error.detail ?? '' };
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  const known: Array<[RegExp, RpaErrorCode]> = [
    [/CDP_CONNECTION|BIDI_CONNECTION|connection is not open|Failed to connect/i, 'BROWSER_DISCONNECTED'],
    [/CDP_REQUEST_TIMEOUT|BIDI_REQUEST_TIMEOUT/i, 'BROWSER_TIMEOUT'],
    [/net::ERR_|NS_ERROR_/i, 'NAVIGATION_FAILED'],
    [/^(No target with given id|No session with given id|no such frame)/i, 'PAGE_CLOSED'],
    [/LOCAL_SCRIPT_|SCRIPT_EXECUTION_FAILED/i, 'SCRIPT_FAILED'],
  ];
  for (const [pattern, code] of known) {
    if (pattern.test(message)) {
      return { code, detail: message };
    }
  }
  return { code: null, detail: message };
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** 翻译成给用户看的一句话（t 是 rpa 命名空间的翻译函数） */
export function describeRunError(error: unknown, t: Translate): string {
  const { code, detail } = classify(error);
  return code ? t(`errors.${code}`, { detail }) : detail || t('errors.UNKNOWN');
}
