import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeSteps } from '../mcp-steps';

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  status: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  endpoint: vi.fn(),
  run: vi.fn(),
  finishRun: vi.fn(),
  adapterFinish: vi.fn(),
  adapterClose: vi.fn(),
}));

vi.mock('i18next', () => ({
  default: { getFixedT: () => (key: string, options?: { name?: string }) => (options?.name ? `${key}:${options.name}` : key) },
}));
vi.mock('../../../../../services/environment/src', () => ({
  getEnvironmentDetail: async () => ({ environment: { name: 'env' } }),
  startEnvironmentRuntime: mocks.start,
  stopEnvironmentRuntime: mocks.stop,
}));
vi.mock('../../api', () => ({
  getRpaTaskDetail: mocks.detail,
  startRpaRun: async () => ({ uuid: 'run', pruned: [] }),
  finishRpaRun: mocks.finishRun,
  setRpaTaskStatus: async () => undefined,
}));
vi.mock('../../components/task-editor/workflow-mapper', () => ({
  mapTaskDetailToEditorState: (detail: unknown) => detail,
}));
vi.mock('../tauri', () => ({
  getEnvironmentStatus: mocks.status,
  getEnvironmentCdpEndpoint: mocks.endpoint,
  deleteRpaRunFiles: async () => undefined,
  saveRpaRunScreenshot: async () => 'file.png',
  sendRpaNotification: async () => undefined,
}));
vi.mock('../create-browser-adapter', () => ({
  createBrowserAdapter: () => ({ finishRun: mocks.adapterFinish, close: mocks.adapterClose }),
}));
vi.mock('../runner', () => ({
  RpaRunner: class {
    run = mocks.run;
  },
}));

import {
  claimEnvironment,
  rpaExecutionStore,
  releaseEnvironmentClaim,
  startRpaExecution,
  stopRpaExecution,
} from '../execution-manager';

vi.stubGlobal('window', globalThis);

let nextTask = 0;

function task(overrides: { retries?: number; variables?: unknown[]; timeout?: number } = {}) {
  const steps = [{ id: 's', type: 'reload', name: 'r', enabled: true, config: {} }];
  return {
    steps,
    config: { globalVariables: overrides.variables ?? [], closeBrowserOnComplete: false },
    workflow: {
      name: 't',
      environments: ['env-1'],
      variables: [],
      steps: [{ id: 's', type: 'reload', name: 'r', enabled: true, config: {} }],
      settings: {
        run_mode: 'sequential',
        concurrency: 1,
        stop_on_error: true,
        retry_count: overrides.retries ?? 0,
        retry_interval_seconds: 0,
        timeout_seconds: overrides.timeout ?? 0,
      },
    },
  };
}

async function finished(id: string) {
  await vi.waitFor(() => {
    const status = rpaExecutionStore.getState().executions[id]?.status;
    expect(status === 'running' || status === 'stopping' || status === undefined).toBe(false);
  });
  return rpaExecutionStore.getState().executions[id];
}

describe('execution manager', () => {
  let id = '';

  beforeEach(() => {
    vi.clearAllMocks();
    id = `task-${(nextTask += 1)}`;
    mocks.status.mockResolvedValue('running');
    mocks.endpoint.mockResolvedValue({ env_uuid: 'env-1', browser_ws_url: 'ws://x' });
    mocks.finishRun.mockResolvedValue(undefined);
    mocks.adapterFinish.mockResolvedValue(undefined);
    mocks.start.mockResolvedValue(undefined);
    mocks.stop.mockResolvedValue(undefined);
    mocks.run.mockResolvedValue({});
  });

  it('refuses a run whose required parameter is empty', async () => {
    mocks.detail.mockResolvedValue(
      task({ variables: [{ name: 'code', value: ' ', promptOnRun: true, required: true }] })
    );
    await expect(startRpaExecution(id, { trigger: 'scheduled' })).rejects.toThrow('code');
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('accepts a required parameter passed for this run', async () => {
    mocks.detail.mockResolvedValue(
      task({ variables: [{ name: 'code', value: '', promptOnRun: true, required: true }] })
    );
    await startRpaExecution(id, { variables: { code: '123' } });
    expect((await finished(id)).status).toBe('success');
  });

  it('waits for an environment held by the editor', async () => {
    mocks.detail.mockResolvedValue(task());
    expect(claimEnvironment('env-1')).toBe(true);
    expect(claimEnvironment('env-1')).toBe(false);
    await startRpaExecution(id);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(mocks.run).not.toHaveBeenCalled();
    releaseEnvironmentClaim('env-1');
    expect((await finished(id)).status).toBe('success');
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });

  it('retries a failure but does not reopen a browser the user closed', async () => {
    mocks.detail.mockResolvedValue(task({ retries: 3 }));
    mocks.run.mockRejectedValue(new Error('boom'));
    mocks.status.mockResolvedValueOnce('running').mockResolvedValue('stopped');
    await startRpaExecution(id);
    expect((await finished(id)).status).toBe('failed');
    expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('retries while the browser is still open', async () => {
    mocks.detail.mockResolvedValue(task({ retries: 1 }));
    mocks.run.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({});
    await startRpaExecution(id);
    expect((await finished(id)).status).toBe('success');
    expect(mocks.run).toHaveBeenCalledTimes(2);
  });

  it('waits for a launch in progress instead of starting twice', async () => {
    mocks.detail.mockResolvedValue(task());
    mocks.status.mockResolvedValueOnce('starting').mockResolvedValue('running');
    await startRpaExecution(id);
    expect((await finished(id)).status).toBe('success');
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('only closes an environment this run started when stopped', async () => {
    mocks.detail.mockResolvedValue(task());
    mocks.status.mockResolvedValueOnce('stopped').mockResolvedValue('running');
    let reject: (error: Error) => void = () => undefined;
    mocks.run.mockImplementation(() => new Promise((_, fail) => (reject = fail)));
    await startRpaExecution(id);
    await vi.waitFor(() => expect(mocks.run).toHaveBeenCalled());
    stopRpaExecution(id);
    reject(new Error('stopped'));
    expect((await finished(id)).status).toBe('stopped');
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.stop).toHaveBeenCalledWith('env-1');
    expect(mocks.adapterFinish).toHaveBeenCalledWith({ keepCurrent: true });
  });

  it('does not start an environment after the run was stopped', async () => {
    mocks.detail.mockResolvedValue(task());
    let settle: (status: string) => void = () => undefined;
    mocks.status.mockImplementation(() => new Promise((resolve) => (settle = resolve)));
    await startRpaExecution(id);
    await vi.waitFor(() => expect(mocks.status).toHaveBeenCalled());
    stopRpaExecution(id);
    settle('stopped');
    expect((await finished(id)).status).toBe('stopped');
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('closes the tabs of a timed-out run before disconnecting', async () => {
    mocks.detail.mockResolvedValue(task({ timeout: 1 }));
    let handled: (() => boolean) | undefined;
    mocks.run.mockImplementation(
      (_workflow: unknown, _session: unknown, options: { signal: AbortSignal; cleanupHandled: () => boolean }) =>
        new Promise((_, fail) => {
          handled = options.cleanupHandled;
          options.signal.addEventListener('abort', () => fail(new Error('aborted')));
        })
    );
    let finishTabs: () => void = () => undefined;
    mocks.adapterFinish.mockImplementation(() => new Promise<void>((resolve) => (finishTabs = resolve)));
    await startRpaExecution(id);
    await vi.waitFor(() => expect(mocks.adapterFinish).toHaveBeenCalled(), { timeout: 4000 });
    expect((await finished(id)).status).toBe('failed');
    expect(mocks.adapterFinish).toHaveBeenCalledWith({ keepCurrent: false });
    expect(handled?.()).toBe(true);
    expect(mocks.adapterClose).not.toHaveBeenCalled();
    finishTabs();
    await vi.waitFor(() => expect(mocks.adapterClose).toHaveBeenCalledTimes(1));
  }, 10000);

  it('leaves an environment the user opened running when stopped', async () => {
    mocks.detail.mockResolvedValue(task());
    let reject: (error: Error) => void = () => undefined;
    mocks.run.mockImplementation(() => new Promise((_, fail) => (reject = fail)));
    await startRpaExecution(id);
    await vi.waitFor(() => expect(mocks.run).toHaveBeenCalled());
    stopRpaExecution(id);
    reject(new Error('stopped'));
    await finished(id);
    expect(mocks.stop).not.toHaveBeenCalled();
  });

  it('refuses to start a task twice', async () => {
    mocks.detail.mockResolvedValue(task());
    mocks.run.mockImplementation(() => new Promise(() => undefined));
    await startRpaExecution(id);
    await expect(startRpaExecution(id)).rejects.toThrow('execution.alreadyRunning');
    stopRpaExecution(id);
  });
});

describe('MCP step normalization', () => {
  const nameOf = (type: string) => `name-${type}`;

  it('fills ids, names and empty branches', () => {
    const [step] = normalizeSteps([{ type: 'loop', config: { iterations: 2 } }], nameOf);
    expect(step).toMatchObject({ type: 'loop', name: 'name-loop', enabled: true, body: [] });
    expect(step.id).toBeTruthy();
  });

  it('refuses a non-string type, even one that stringifies to a real type', () => {
    expect(() => normalizeSteps([{ type: ['script'] }], nameOf)).toThrow('Unknown step type');
    expect(() => normalizeSteps([{ type: 'execute_js' }], nameOf)).toThrow('Unknown step type');
  });

  it('refuses duplicate ids at any depth', () => {
    expect(() =>
      normalizeSteps([{ id: 'a', type: 'loop', body: [{ id: 'a', type: 'reload' }] }], nameOf)
    ).toThrow('Duplicate step id');
  });
});
