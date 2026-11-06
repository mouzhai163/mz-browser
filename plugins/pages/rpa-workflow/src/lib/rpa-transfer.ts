import { invoke } from '@/lib/tauri';
import { save } from '@tauri-apps/plugin-dialog';
import type { RpaTaskDetailDto } from '../api';

export interface PortableRpaTaskStep {
  uuid: string;
  step_type: string;
  name: string;
  config: Record<string, unknown>;
  enabled?: boolean | null;
  position_x?: number | null;
  position_y?: number | null;
  sort_order?: number | null;
  next_step_uuid?: string | null;
  branch_config?: Record<string, unknown> | null;
}

export interface PortableRpaTask {
  name: string;
  description?: string | null;
  tags?: unknown;
  trigger_type: string;
  schedule?: string | null;
  cron_expression?: string | null;
  run_mode: string;
  retry_count?: number | null;
  retry_interval?: number | null;
  timeout?: number | null;
  concurrency?: number | null;
  stop_on_error?: boolean | null;
  notify_on_complete?: boolean | null;
  notify_on_error?: boolean | null;
  environment_uuids: string[];
  steps: PortableRpaTaskStep[];
}

export interface PortableRpaTaskDocument {
  schema_version: '1.0';
  exported_at: string;
  source_task_uuid: string;
  source_task_name: string;
  task: PortableRpaTask;
}

export interface PortableRpaTaskSummary {
  name: string;
  description: string;
  triggerType: string;
  environmentCount: number;
  stepCount: number;
}

export function buildPortableRpaTask(detail: RpaTaskDetailDto): PortableRpaTaskDocument {
  return {
    schema_version: '1.0',
    exported_at: new Date().toISOString(),
    source_task_uuid: detail.task.uuid,
    source_task_name: detail.task.name,
    task: {
      name: detail.task.name,
      description: detail.task.description,
      tags: detail.task.tags ?? null,
      trigger_type: detail.task.trigger_type,
      schedule: detail.task.schedule,
      cron_expression: detail.task.cron_expression,
      run_mode: detail.task.run_mode,
      retry_count: detail.task.retry_count,
      retry_interval: detail.task.retry_interval,
      timeout: detail.task.timeout,
      concurrency: detail.task.concurrency,
      stop_on_error: detail.task.stop_on_error,
      notify_on_complete: detail.task.notify_on_complete,
      notify_on_error: detail.task.notify_on_error,
      environment_uuids: [],
      steps: detail.steps.map((step) => ({
        uuid: step.uuid,
        step_type: step.step_type,
        name: step.name,
        config: step.config,
        enabled: step.enabled,
        position_x: step.position_x,
        position_y: step.position_y,
        sort_order: step.sort_order,
        next_step_uuid: step.next_step_uuid,
        branch_config: step.branch_config,
      })),
    },
  };
}

export function parsePortableRpaTask(content: string): PortableRpaTaskDocument {
  const parsed = JSON.parse(content) as Partial<PortableRpaTaskDocument>;
  if (parsed?.schema_version !== '1.0' || !parsed.task || !Array.isArray(parsed.task.steps)) {
    throw new Error('导入文件格式不正确');
  }
  return parsed as PortableRpaTaskDocument;
}

export function buildPortableRpaTaskSummary(document: PortableRpaTaskDocument): PortableRpaTaskSummary {
  return {
    name: document.task.name,
    description: document.task.description ?? '',
    triggerType: document.task.trigger_type,
    environmentCount: document.task.environment_uuids.length,
    stepCount: document.task.steps.length,
  };
}

export function serializePortableRpaTask(document: PortableRpaTaskDocument): string {
  return JSON.stringify(document, null, 2);
}

export function buildPortableRpaTaskFilename(detail: RpaTaskDetailDto): string {
  const safeName = detail.task.name.replace(/[\\/:*?"<>|]/g, '-').trim() || detail.task.uuid;
  return `${safeName}.json`;
}

export async function savePortableRpaTask(filename: string, content: string): Promise<boolean> {
  const filePath = await save({
    defaultPath: filename,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
  });

  if (!filePath) {
    return false;
  }

  await invoke('write_text_file', {
    path: filePath,
    content,
  });

  return true;
}
