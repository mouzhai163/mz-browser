import { startEnvironmentRuntime } from '../../../../services/environment/src';
import { RpaError } from './errors';
import { getEnvironmentCdpEndpoint, getEnvironmentStatus, type CdpEndpoint, type EnvironmentStatus } from './tauri';

export async function waitForCdpEndpoint(envUuid: string, timeoutMs = 30000): Promise<CdpEndpoint> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const endpoint = await getEnvironmentCdpEndpoint(envUuid);
    if (endpoint?.browser_ws_url) {
      return endpoint;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }

  throw new RpaError('BROWSER_TIMEOUT');
}

const TRANSITIONAL_STATUSES = new Set<EnvironmentStatus | null>([
  'initializing',
  'verifying',
  'downloading',
  'extracting',
  'starting',
  'stopping',
]);
const SETTLE_TIMEOUT_MS = 180000;

/** 环境正在启动或关闭时等它稳定下来，避免重复启动把一次正常的启动弄失败 */
export async function settledEnvironmentStatus(envUuid: string, signal?: AbortSignal): Promise<EnvironmentStatus | null> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  for (;;) {
    const status = await getEnvironmentStatus(envUuid);
    if (!TRANSITIONAL_STATUSES.has(status) || signal?.aborted || Date.now() >= deadline) return status;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/** 确保环境在运行。返回 true 表示是这次调用启动的 */
export async function ensureEnvironmentStarted(envUuid: string, signal?: AbortSignal): Promise<boolean> {
  const status = await settledEnvironmentStatus(envUuid, signal);
  if (signal?.aborted) throw new RpaError('RUN_STOPPED');
  if (status === 'running') return false;
  await startEnvironmentRuntime(envUuid);
  return true;
}

/** 连接任务绑定的环境：已经在运行就直接用，没有运行就先启动。 */
export async function connectBoundRpaEnvironment(envUuid: string): Promise<CdpEndpoint> {
  await ensureEnvironmentStarted(envUuid);
  return waitForCdpEndpoint(envUuid);
}
