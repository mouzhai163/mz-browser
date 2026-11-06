import { getStoreKey, setStoreKey } from '../../store-commands';

const STORE_KEY = 'environment.local_proxy_bindings';

export interface EnvironmentLocalProxyBinding {
  env_uuid: string;
  node_name: string;
  updated_at: string;
}

export type EnvironmentLocalProxyBindingMap = Record<string, EnvironmentLocalProxyBinding>;

export async function getEnvironmentLocalProxyBindings(): Promise<EnvironmentLocalProxyBindingMap> {
  const raw = await getStoreKey<EnvironmentLocalProxyBindingMap>(STORE_KEY);
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  return raw;
}

export async function setEnvironmentLocalProxyBinding(
  envUuid: string,
  nodeName: string
): Promise<void> {
  const current = await getEnvironmentLocalProxyBindings();
  await setStoreKey(STORE_KEY, {
    ...current,
    [envUuid]: {
      env_uuid: envUuid,
      node_name: nodeName,
      updated_at: new Date().toISOString(),
    },
  });
}

export async function removeEnvironmentLocalProxyBinding(envUuid: string): Promise<void> {
  const current = await getEnvironmentLocalProxyBindings();
  if (!(envUuid in current)) {
    return;
  }

  const next = { ...current };
  delete next[envUuid];
  await setStoreKey(STORE_KEY, next);
}
