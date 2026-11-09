import { startEnvironmentRuntime } from '../../../../services/environment/src';
import { getEnvironmentCdpEndpoint, getEnvironmentStatus, type CdpEndpoint } from './tauri';

export async function waitForCdpEndpoint(envUuid: string, timeoutMs = 30000): Promise<CdpEndpoint> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const endpoint = await getEnvironmentCdpEndpoint(envUuid);
    if (endpoint?.browser_ws_url) {
      return endpoint;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }

  throw new Error('浏览器调试连接未及时就绪');
}

/** 连接任务绑定的环境：已经在运行就直接用，没有运行就先启动。 */
export async function connectBoundRpaEnvironment(envUuid: string): Promise<CdpEndpoint> {
  const status = await getEnvironmentStatus(envUuid);
  if (status !== 'running') {
    await startEnvironmentRuntime(envUuid);
  }
  return waitForCdpEndpoint(envUuid);
}
