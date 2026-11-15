import { beforeEach, describe, expect, it, vi } from 'vitest';
import { post } from '@/lib/request';
import { batchCreateEnvironments } from './index';
import type { WindowConfig } from '../types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@/lib/request', () => ({
  post: vi.fn(),
  isSuccess: (result: { code: number }) => result.code === 1,
}));

// Only fields read by the request transformer are needed for this API contract test.
const config = {
  windowInfo: { name: 'test', urls: [], cookies: [], accountUuids: [] },
  basicSettings: {},
  advancedFingerprintSettings: {},
  deviceSettings: {},
  preferenceSettings: {},
  projectMetadata: {},
} as unknown as WindowConfig;

describe('batch environment creation response', () => {
  beforeEach(() => vi.resetAllMocks());

  it('normalizes backend UUID strings in order before local proxy binding', async () => {
    const uuids = ['591fb0dd-5510-4ef7-589d-e3a1a2904cda', '691fb0dd-5510-4ef7-589d-e3a1a2904cda'];
    vi.mocked(post).mockResolvedValueOnce({ code: 1, message: '', data: uuids });
    await expect(batchCreateEnvironments([config, config], undefined)).resolves.toEqual(
      uuids.map((uuid) => ({ uuid }))
    );
  });

  it.each([undefined, [''], [{}], { data: [{ uuid: 'test' }] }, []])(
    'rejects an invalid response instead of returning undefined UUIDs: %j',
    async (data) => {
      vi.mocked(post).mockResolvedValueOnce({ code: 1, message: '', data });
      await expect(batchCreateEnvironments([config], undefined)).rejects.toThrow('UUID 列表无效');
    }
  );

  it('preserves backend failure messages', async () => {
    vi.mocked(post).mockResolvedValueOnce({ code: 0, message: 'creation rejected' });
    await expect(batchCreateEnvironments([config], undefined)).rejects.toThrow('creation rejected');
  });
});
