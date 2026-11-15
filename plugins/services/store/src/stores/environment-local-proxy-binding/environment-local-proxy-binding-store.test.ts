import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoreKey, setStoreKey } from '../../store-commands';
import { setEnvironmentLocalProxyBinding } from './environment-local-proxy-binding-store';

vi.mock('../../store-commands', () => ({ getStoreKey: vi.fn(), setStoreKey: vi.fn() }));
const uuid = '591fb0dd-5510-4ef7-589d-e3a1a2904cda';

describe('local proxy binding validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getStoreKey).mockResolvedValue({});
  });

  it.each([undefined, null, '', 'undefined', 'not-a-uuid'])(
    'refuses invalid environment identifiers before touching the store: %j',
    async (id) => {
      await expect(setEnvironmentLocalProxyBinding(id as string, 'test-node')).rejects.toThrow(
        '环境 UUID 无效'
      );
      expect(getStoreKey).not.toHaveBeenCalled();
      expect(setStoreKey).not.toHaveBeenCalled();
    }
  );

  it('rejects empty node names', async () => {
    await expect(setEnvironmentLocalProxyBinding(uuid, ' ')).rejects.toThrow('节点名称不能为空');
    expect(setStoreKey).not.toHaveBeenCalled();
  });

  it('writes the real UUID and preserves existing bindings', async () => {
    const previous = {
      'other-environment': { env_uuid: 'other-environment', node_name: 'other-node' },
    };
    vi.mocked(getStoreKey).mockResolvedValueOnce(previous);
    await setEnvironmentLocalProxyBinding(uuid, 'test-node');
    expect(setStoreKey).toHaveBeenCalledWith('environment.local_proxy_bindings', {
      ...previous,
      [uuid]: { env_uuid: uuid, node_name: 'test-node', updated_at: expect.any(String) },
    });
  });
});
