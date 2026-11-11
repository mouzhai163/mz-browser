import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  endpoint: vi.fn(),
  connect: vi.fn(),
  runSingle: vi.fn(),
}));

vi.mock('../tauri', () => ({ getEnvironmentCdpEndpoint: mocks.endpoint }));
vi.mock('../bound-environment', () => ({ connectBoundRpaEnvironment: mocks.connect }));
vi.mock('../create-browser-adapter', () => ({
  createBrowserAdapter: () => ({ connect: async () => undefined, close: () => undefined }),
}));
vi.mock('../runner', () => ({
  RpaRunner: class {
    createContext = () => ({ variables: {} });
    runSingle = mocks.runSingle;
  },
}));

import { RpaDebugSession } from '../debug-session';
import type { RpaWorkflowSchema, RpaWorkflowStep } from '../../types';

const workflow = { settings: { speed: 'normal' } } as unknown as RpaWorkflowSchema;
const step = {} as RpaWorkflowStep;
const URL_A = 'ws://127.0.0.1:1/devtools/browser/a';

describe('debug session', () => {
  let session: RpaDebugSession;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue({ env_uuid: 'env', browser_ws_url: URL_A });
    session = new RpaDebugSession();
    await session.runStep('env', workflow, step, {});
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  const runAgainWith = async (current: () => Promise<unknown>) => {
    mocks.endpoint.mockImplementation(current);
    await session.runStep('env', workflow, step, {});
    return mocks.connect.mock.calls.length;
  };

  it('keeps the session while the browser is the same', async () => {
    expect(await runAgainWith(async () => ({ browser_ws_url: URL_A }))).toBe(1);
  });

  it('keeps the session when the browser is briefly unresponsive', async () => {
    expect(await runAgainWith(async () => ({ browser_ws_url: undefined }))).toBe(1);
    expect(await runAgainWith(async () => Promise.reject(new Error('busy')))).toBe(1);
  });

  it('reconnects when the browser was closed or reopened', async () => {
    expect(await runAgainWith(async () => null)).toBe(2);
    expect(await runAgainWith(async () => ({ browser_ws_url: 'ws://127.0.0.1:1/devtools/browser/b' }))).toBe(3);
  });
});
