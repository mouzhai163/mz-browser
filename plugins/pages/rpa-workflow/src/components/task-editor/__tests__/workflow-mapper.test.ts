import { describe, expect, it } from 'vitest';
import type { RpaTaskDetailDto } from '../../../api';
import { countSteps } from '../../../lib/step-tree';
import { buildTaskPayload, mapTaskDetailToEditorState } from '../workflow-mapper';
import type { TaskConfig } from '../task-settings-form';

const task: RpaTaskDetailDto['task'] = {
  id: 1,
  uuid: 'task',
  name: 'T',
  trigger_type: 'manual',
  run_mode: 'sequential',
  status: 'idle',
  created_at: '2026-11-10T00:00:00Z',
};

function v1Row(id: string, type: string, extra: Record<string, unknown> = {}, sort = 0) {
  return {
    uuid: id,
    step_type: type,
    name: id,
    sort_order: sort,
    config: {
      workflow_step: { id, type, name: id, enabled: true, config: {}, ...extra },
      ...(sort === 0 ? { workflow_meta: { start_step_id: 'a', global_variables: [] } } : {}),
    },
  };
}

const config: TaskConfig = {
  name: 'T',
  description: '',
  tags: [],
  triggerType: 'manual',
  selectedEnvironments: ['env'],
  runMode: 'sequential',
  globalVariables: [{ id: 'v', name: '账号', value: 'x', promptOnRun: false, required: false }],
  retryCount: 2,
  retryInterval: 5,
  timeout: 60,
  concurrency: 1,
  stopOnError: true,
  closeBrowserOnComplete: true,
  notifyOnComplete: false,
  notifyOnError: true,
  speed: 'slow',
};

describe('workflow mapper', () => {
  it('turns a v1 graph into a step tree and disables unreachable steps', () => {
    const detail: RpaTaskDetailDto = {
      task,
      environment_uuids: ['env'],
      steps: [
        v1Row('a', 'navigate', { next: 'b', url: 'https://example.com' }, 0),
        v1Row('b', 'condition', { branches: { true: 'c', false: null }, next: null }, 1),
        v1Row('c', 'wait', { next: null }, 2),
        v1Row('lost', 'wait', { next: null }, 3),
      ],
    };

    const state = mapTaskDetailToEditorState(detail);

    expect(state.orphaned).toBe(1);
    expect(state.steps[0].id).toBe('a');
    expect(state.steps[1].id).toBe('b');
    expect(state.steps.at(-1)).toMatchObject({ id: 'lost', enabled: false });
    expect(countSteps(state.steps)).toBe(4);
  });

  it('round-trips a nested tree, settings and variables through the saved rows', () => {
    const steps = [
      {
        id: 'loop',
        type: 'loop',
        name: 'L',
        enabled: true,
        config: { iterations: 2 },
        body: [
          {
            id: 'if',
            type: 'condition',
            name: 'C',
            enabled: true,
            config: { conditionType: 'url_contains', urlFragment: 'x' },
            then: [{ id: 'stop', type: 'break_loop', name: 'B', enabled: false, config: {} }],
            else: [],
          },
        ],
      },
    ];

    const payload = buildTaskPayload(config, steps);
    const detail: RpaTaskDetailDto = {
      task: {
        ...task,
        retry_count: payload.retry_count,
        retry_interval: payload.retry_interval,
        timeout: payload.timeout,
        concurrency: payload.concurrency,
        stop_on_error: payload.stop_on_error,
      },
      environment_uuids: payload.environment_uuids ?? [],
      steps: (payload.steps ?? []).map((row, index) => ({
        uuid: `row-${index}`,
        step_type: row.step_type,
        name: row.name,
        config: row.config,
        enabled: row.enabled,
        sort_order: row.sort_order,
      })),
    };

    const state = mapTaskDetailToEditorState(detail);

    expect(state.orphaned).toBe(0);
    expect(state.steps).toHaveLength(1);
    expect(state.steps[0].body?.[0].then?.[0]).toMatchObject({ id: 'stop', enabled: false });
    expect(state.config.speed).toBe('slow');
    expect(state.config.closeBrowserOnComplete).toBe(true);
    expect(state.config.globalVariables[0]).toMatchObject({ name: '账号', value: 'x' });
    expect(state.workflow.settings.retry_count).toBe(2);
  });
});
