import { describe, expect, it, vi } from 'vitest';
import type { RpaWorkflowSchema, RpaWorkflowStep } from '../../types';
import type { BrowserAdapter } from '../browser-adapter';
import { RpaError } from '../errors';
import { RpaRunner, renderTemplate, type RpaRunnerStepEvent } from '../runner';

vi.mock('../tauri', () => ({ executeLocalRpaScript: vi.fn() }));

function fakeAdapter(overrides: Partial<BrowserAdapter> = {}) {
  const calls: string[] = [];
  const record = (name: string) => async (...args: unknown[]) => {
    calls.push(`${name}${args.length && typeof args[0] === 'string' ? `:${args[0]}` : ''}`);
    return '';
  };
  const adapter = {
    connect: record('connect'),
    goto: record('goto'),
    reload: record('reload'),
    goBack: record('goBack'),
    goForward: record('goForward'),
    selectTab: record('selectTab'),
    closeTab: record('closeTab'),
    screenshot: record('screenshot'),
    click: record('click'),
    hover: record('hover'),
    fill: async (_t: unknown, value: string) => void calls.push(`fill:${value}`),
    pressKey: record('pressKey'),
    selectOption: record('selectOption'),
    uploadFile: record('uploadFile'),
    extract: async () => 'extracted',
    executeScript: record('executeScript'),
    scroll: record('scroll'),
    waitFor: record('waitFor'),
    evaluateCondition: async () => true,
    pickElement: vi.fn(),
    finishRun: async () => void calls.push('finishRun'),
    close: () => void calls.push('close'),
    ...overrides,
  } as unknown as BrowserAdapter;
  return { adapter, calls };
}

const target = { by: 'css' as const, value: '#x' };
const step = (id: string, type: string, extra: Partial<RpaWorkflowStep> = {}): RpaWorkflowStep => ({
  id,
  type,
  name: id,
  enabled: true,
  ...extra,
});
const workflow = (steps: RpaWorkflowStep[], variables: RpaWorkflowSchema['variables'] = []) =>
  ({ schema_version: '2.0', settings: { speed: 'fast' }, variables, steps }) as unknown as RpaWorkflowSchema;
const session = { envUuid: 'e', browserWsUrl: 'ws://x' };

describe('RpaRunner', () => {
  it('runs steps in order, then finishes and closes', async () => {
    const { adapter, calls } = fakeAdapter();
    await new RpaRunner(adapter).run(
      workflow([step('a', 'goto', { url: 'https://a.test' }), step('b', 'click', { target })]),
      session
    );
    expect(calls).toEqual(['connect', 'goto:https://a.test', 'click', 'finishRun', 'close']);
  });

  it('skips disabled steps and reports them', async () => {
    const { adapter, calls } = fakeAdapter();
    const events: RpaRunnerStepEvent[] = [];
    await new RpaRunner(adapter).run(workflow([step('a', 'click', { target, enabled: false })]), session, {
      onStepStatusChange: (event) => events.push(event),
    });
    expect(calls).not.toContain('click');
    expect(events.map((event) => event.status)).toEqual(['skipped']);
  });

  it('takes the matching condition branch only', async () => {
    const { adapter, calls } = fakeAdapter({ evaluateCondition: async () => false });
    await new RpaRunner(adapter).run(
      workflow([
        step('c', 'condition', {
          target,
          then: [step('t', 'reload')],
          else: [step('e', 'go_back')],
        }),
      ]),
      session
    );
    expect(calls).toContain('goBack');
    expect(calls).not.toContain('reload');
  });

  it('repeats a loop body and exposes the iteration index', async () => {
    const { adapter, calls } = fakeAdapter();
    await new RpaRunner(adapter).run(
      workflow([
        step('l', 'loop', {
          config: { iterations: 3 },
          body: [step('f', 'fill', { target, value: 'item {{loop.index}}/{{loop.total}}' })],
        }),
      ]),
      session
    );
    expect(calls.filter((call) => call.startsWith('fill'))).toEqual(['fill:item 1/3', 'fill:item 2/3', 'fill:item 3/3']);
  });

  it('break leaves only the nearest loop', async () => {
    const { adapter, calls } = fakeAdapter();
    await new RpaRunner(adapter).run(
      workflow([
        step('l', 'loop', {
          config: { iterations: 5 },
          body: [
            step('r', 'reload'),
            step('c', 'condition', { target, then: [step('b', 'break_loop')] }),
            step('never', 'go_back'),
          ],
        }),
        step('after', 'go_forward'),
      ]),
      session
    );
    expect(calls.filter((call) => call === 'reload')).toHaveLength(1);
    expect(calls).not.toContain('goBack');
    expect(calls).toContain('goForward');
  });

  it('passes the extract-all switch to the adapter', async () => {
    const extract = vi.fn(async () => '["a","b"]');
    const { adapter } = fakeAdapter({ extract });
    const result = await new RpaRunner(adapter).run(
      workflow([step('x', 'extract_text', { target, output: 'list', config: { extractAll: true } })]),
      session
    );
    expect(extract).toHaveBeenCalledWith(expect.objectContaining({ all: true }));
    expect(result.list).toBe('["a","b"]');
  });

  it('stores extracted values and supports Chinese variable names', async () => {
    const { adapter, calls } = fakeAdapter();
    await new RpaRunner(adapter).run(
      workflow(
        [
          step('x', 'extract_text', { target, output: '价格' }),
          step('f', 'fill', { target, value: '{{价格}}-{{账号}}' }),
        ],
        [{ name: '账号', value: 'abc' }]
      ),
      session
    );
    expect(calls).toContain('fill:extracted-abc');
  });

  it('set_variable writes a rendered value', async () => {
    const { adapter, calls } = fakeAdapter();
    await new RpaRunner(adapter).run(
      workflow([
        step('s', 'set_variable', { config: { variableName: 'a', variableValue: 'hi' } }),
        step('f', 'fill', { target, value: '{{a}}!' }),
      ]),
      session
    );
    expect(calls).toContain('fill:hi!');
  });

  it('a failing step reports the error and stops the run, and still cleans up', async () => {
    const failure = new RpaError('ELEMENT_NOT_FOUND', '#x');
    const { adapter, calls } = fakeAdapter({
      click: async () => {
        throw failure;
      },
    });
    const events: RpaRunnerStepEvent[] = [];
    await expect(
      new RpaRunner(adapter).run(workflow([step('a', 'click', { target }), step('b', 'reload')]), session, {
        onStepStatusChange: (event) => events.push(event),
      })
    ).rejects.toBe(failure);
    expect(events.at(-1)).toMatchObject({ stepId: 'a', status: 'failed', error: failure });
    expect(calls).not.toContain('reload');
    expect(calls).toContain('finishRun');
  });

  it('abort stops during a delay and marks the step stopped', async () => {
    const { adapter, calls } = fakeAdapter();
    const controller = new AbortController();
    const events: RpaRunnerStepEvent[] = [];
    const run = new RpaRunner(adapter).run(
      workflow([step('d', 'delay', { duration_ms: 60000 }), step('r', 'reload')]),
      session,
      { signal: controller.signal, onStepStatusChange: (event) => events.push(event) }
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await expect(run).rejects.toMatchObject({ code: 'RUN_STOPPED' });
    expect(events.at(-1)).toMatchObject({ stepId: 'd', status: 'stopped' });
    expect(calls).not.toContain('reload');
  });

  it('runFrom continues with the rest of the current block and the outer list', async () => {
    const { adapter, calls } = fakeAdapter();
    const runner = new RpaRunner(adapter);
    const steps = [
      step('first', 'go_back'),
      step('c', 'condition', { target, then: [step('t1', 'hover', { target }), step('t2', 'click', { target })] }),
      step('after', 'go_forward'),
    ];
    await runner.runFrom(steps, 't2', runner.createContext({ variables: [] }));
    expect(calls).toEqual(['click', 'goForward']);
  });

  it('runSingle runs just that step', async () => {
    const { adapter, calls } = fakeAdapter();
    const runner = new RpaRunner(adapter);
    await runner.runSingle(step('r', 'reload'), runner.createContext({ variables: [] }));
    expect(calls).toEqual(['reload']);
  });
});

describe('cleanup', () => {
  const workflow = {
    name: 't',
    environments: [],
    variables: [],
    steps: [],
    settings: { speed: 'normal' },
  } as unknown as RpaWorkflowSchema;

  it('finishes and disconnects by default', async () => {
    const { adapter, calls } = fakeAdapter();
    await new RpaRunner(adapter).run(workflow, { envUuid: 'e', browserWsUrl: 'ws://x' });
    expect(calls.slice(-2)).toEqual(['finishRun', 'close']);
  });

  it('leaves the connection alone when the caller handles cleanup', async () => {
    const { adapter, calls } = fakeAdapter();
    await new RpaRunner(adapter).run(workflow, { envUuid: 'e', browserWsUrl: 'ws://x' }, { cleanupHandled: () => true });
    expect(calls).not.toContain('finishRun');
    expect(calls).not.toContain('close');
  });
});

describe('renderTemplate', () => {
  it('reads nested paths and JSON strings', () => {
    expect(renderTemplate('{{a.b[1]}}', { a: '{"b":[1,2]}' })).toBe('2');
  });
  it('renders missing variables as empty', () => {
    expect(renderTemplate('x{{nope}}y', {})).toBe('xy');
  });
});
