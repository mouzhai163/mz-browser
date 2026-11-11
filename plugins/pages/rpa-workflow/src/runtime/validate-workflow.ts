import type { RpaStepBranch, RpaWorkflowStep } from '../types';

export type RpaValidationCode =
  | 'URL_REQUIRED'
  | 'URL_INVALID'
  | 'TARGET_REQUIRED'
  | 'TEXT_REQUIRED'
  | 'UPLOAD_FILE_REQUIRED'
  | 'SCRIPT_REQUIRED'
  | 'CONDITION_TEXT_REQUIRED'
  | 'CONDITION_URL_REQUIRED'
  | 'TAB_INDEX_INVALID'
  | 'KEY_REQUIRED'
  | 'OPTION_REQUIRED'
  | 'VARIABLE_NAME_REQUIRED'
  | 'BREAK_OUTSIDE_LOOP';

export interface RpaValidationIssue {
  stepId: string;
  code: RpaValidationCode;
}

const hasTarget = (step: RpaWorkflowStep) => Boolean(step.target?.value?.trim());
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** 模板变量运行时才有值，只校验写死的地址 */
function urlIssue(url: string): RpaValidationCode | null {
  if (!url) return 'URL_REQUIRED';
  if (url.includes('{{')) return null;
  try {
    new URL(url);
    return null;
  } catch {
    return 'URL_INVALID';
  }
}

function checkStep(step: RpaWorkflowStep, insideLoop: boolean): RpaValidationCode | null {
  const config = step.config ?? {};
  switch (step.type) {
    case 'goto':
      return urlIssue(text(step.url));
    case 'click':
    case 'hover':
    case 'wait_for':
    case 'extract_text':
      return hasTarget(step) ? null : 'TARGET_REQUIRED';
    case 'fill':
      if (!hasTarget(step)) return 'TARGET_REQUIRED';
      return text(step.value) ? null : 'TEXT_REQUIRED';
    case 'select_option':
      if (!hasTarget(step)) return 'TARGET_REQUIRED';
      return text(config.optionValue) ? null : 'OPTION_REQUIRED';
    case 'upload':
      if (!hasTarget(step)) return 'TARGET_REQUIRED';
      return text(config.filePath) ? null : 'UPLOAD_FILE_REQUIRED';
    case 'scroll':
      return config.scrollMode === 'to_element' && !hasTarget(step) ? 'TARGET_REQUIRED' : null;
    case 'screenshot':
      return step.screenshot_mode === 'element' && !hasTarget(step) ? 'TARGET_REQUIRED' : null;
    case 'execute_js':
      return text(step.script) ? null : 'SCRIPT_REQUIRED';
    case 'press_key':
      return text(config.key) ? null : 'KEY_REQUIRED';
    case 'set_variable':
      return text(config.variableName) ? null : 'VARIABLE_NAME_REQUIRED';
    case 'select_tab':
    case 'close_tab':
      return Number.isInteger(config.tabIndex) && Number(config.tabIndex) >= 1 ? null : 'TAB_INDEX_INVALID';
    case 'condition':
      if (config.conditionType === 'text_present') return text(config.expectedText) ? null : 'CONDITION_TEXT_REQUIRED';
      if (config.conditionType === 'url_contains') return text(config.urlFragment) ? null : 'CONDITION_URL_REQUIRED';
      return hasTarget(step) ? null : 'TARGET_REQUIRED';
    case 'break_loop':
      return insideLoop ? null : 'BREAK_OUTSIDE_LOOP';
    default:
      return null;
  }
}

/** 校验步骤树。禁用的步骤不运行，不校验 */
export function validateSteps(steps: RpaWorkflowStep[], insideLoop = false): RpaValidationIssue[] {
  const issues: RpaValidationIssue[] = [];
  for (const step of steps) {
    if (step.enabled === false) continue;
    const code = checkStep(step, insideLoop);
    if (code) issues.push({ stepId: step.id, code });
    for (const branch of ['then', 'else', 'body'] as RpaStepBranch[]) {
      if (step[branch]) issues.push(...validateSteps(step[branch]!, insideLoop || step.type === 'loop'));
    }
  }
  return issues;
}
