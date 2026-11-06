export interface RpaTask {
  id: string;
  name: string;
  description?: string;
  triggerType: 'manual' | 'scheduled' | 'event';
  status: 'idle' | 'running' | 'completed' | 'failed';
  environmentCount: number;
  lastRunAt?: string;
  nextRunAt?: string;
  schedule?: string;
  createdAt: string;
  createdBy?: string;
  runCount: number;
  successRate: number;
}

export type RpaStatusFilter = 'all' | 'idle' | 'running' | 'completed' | 'failed' | 'scheduled';

export interface RpaWorkflowSelector {
  by: 'css' | 'xpath' | 'text' | 'role' | 'label' | 'placeholder' | 'testid';
  value: string;
  name?: string;
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
  snapshot: RpaCapturedSelectorSnapshot;
}

export interface RpaWorkflowStep {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  next: string | null;
  branches?: Record<string, string>;
  ui?: {
    source_type?: string;
    position?: {
      x: number;
      y: number;
    };
    parent_id?: string | null;
  };
  config?: Record<string, unknown>;
  target?: RpaWorkflowSelector;
  url?: string;
  value?: string;
  duration_ms?: number;
  timeout_ms?: number;
  wait_until?: string;
  wait_type?: string;
  click_type?: string;
  screenshot_mode?: string;
  wait_for_element?: boolean;
  clear_first?: boolean;
  type_slowly?: boolean;
  output?: string;
  script?: string;
  expression?: string;
}

export interface RpaWorkflowVariable {
  name: string;
  value: string;
}

export interface RpaWorkflowSchema {
  schema_version: '1.0';
  name: string;
  description?: string;
  tags: string[];
  trigger: {
    type: 'manual' | 'scheduled' | 'event';
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
  };
  variables: RpaWorkflowVariable[];
  start_step_id: string | null;
  steps: RpaWorkflowStep[];
}


