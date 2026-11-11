export interface RpaTask {
  id: string;
  name: string;
  description?: string;
  triggerType: 'manual' | 'scheduled';
  status: 'idle' | 'running' | 'completed' | 'failed';
  environmentCount: number;
  lastRunAt?: string;
  nextRunAt?: string;
  schedule?: string;
  createdAt: string;
  runCount: number;
  successRate: number;
}

export type RpaStatusFilter = 'all' | 'idle' | 'running' | 'completed' | 'failed' | 'scheduled';

export interface RpaWorkflowSelector {
  by: 'css' | 'xpath' | 'text' | 'role' | 'label' | 'placeholder' | 'testid';
  value: string;
  name?: string;
  /** 拾取时生成的备选选择器：主选择器找不到时依次尝试 */
  candidates?: Array<{ by: RpaWorkflowSelector['by']; value: string }>;
  /** 元素在同源 iframe 里时，从外到内每层 iframe 的 XPath */
  frames?: string[];
}

export interface RpaCapturedSelectorSnapshot {
  tag: string;
  text: string;
  id: string;
  className: string;
  role: string;
  name: string;
  placeholder: string;
  ariaLabel: string;
}

export interface RpaCapturedSelector {
  primary: RpaWorkflowSelector;
  candidates: RpaWorkflowSelector[];
  /** 能匹配到同类元素（列表每一行）的 CSS 选择器，没有同类时为空 */
  similar?: { value: string; count: number } | null;
  snapshot: RpaCapturedSelectorSnapshot;
}

/** 操作速度：影响鼠标轨迹、打字节奏和动作之间的停顿 */
export type RpaSpeed = 'fast' | 'normal' | 'slow';

/** 工作流里的一步。条件有 then/else 两组子步骤，循环有 body 一组子步骤 */
export interface RpaWorkflowStep {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  ui?: {
    source_type?: string;
    parent_id?: string | null;
    branch?: RpaStepBranch | null;
  };
  config?: Record<string, unknown>;
  target?: RpaWorkflowSelector;
  url?: string;
  value?: string;
  duration_ms?: number;
  timeout_ms?: number;
  wait_until?: string;
  new_tab?: boolean;
  click_type?: string;
  screenshot_mode?: string;
  clear_first?: boolean;
  output?: string;
  script?: string;
  then?: RpaWorkflowStep[];
  else?: RpaWorkflowStep[];
  body?: RpaWorkflowStep[];
}

export type RpaStepBranch = 'then' | 'else' | 'body';

export interface RpaWorkflowVariable {
  name: string;
  value: string;
}

export interface RpaWorkflowSchema {
  schema_version: '2.0';
  name: string;
  description?: string;
  tags: string[];
  trigger: {
    type: 'manual' | 'scheduled';
    schedule?: string;
    cron_expression?: string;
  };
  environments: string[];
  settings: {
    run_mode: 'sequential' | 'parallel';
    retry_count: number;
    retry_interval_seconds: number;
    timeout_seconds: number;
    concurrency: number;
    stop_on_error: boolean;
    notify_on_complete: boolean;
    notify_on_error: boolean;
    speed: RpaSpeed;
  };
  variables: RpaWorkflowVariable[];
  steps: RpaWorkflowStep[];
}
