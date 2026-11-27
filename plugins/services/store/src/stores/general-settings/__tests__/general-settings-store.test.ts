import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/lib/tauri', () => ({ invoke: mocks.invoke }));

import { getGeneralSettings, setGeneralSettings } from '../general-settings-store';

describe('general settings window close action', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it('defaults to hiding in the background when the setting is missing or invalid', async () => {
    mocks.invoke.mockResolvedValueOnce(undefined);
    await expect(getGeneralSettings()).resolves.toMatchObject({
      windowCloseAction: 'hide-to-tray',
    });

    mocks.invoke.mockResolvedValueOnce({ windowCloseAction: 'not-a-real-action' });
    await expect(getGeneralSettings()).resolves.toMatchObject({
      windowCloseAction: 'hide-to-tray',
    });
  });

  it('preserves a valid quit-application preference', async () => {
    mocks.invoke.mockResolvedValueOnce({ windowCloseAction: 'quit-application' });
    await expect(getGeneralSettings()).resolves.toMatchObject({
      windowCloseAction: 'quit-application',
    });
  });

  it('merges close action updates into the persisted general settings object', async () => {
    mocks.invoke.mockResolvedValueOnce({
      theme: 'dark',
      windowCloseAction: 'hide-to-tray',
    });
    mocks.invoke.mockResolvedValueOnce(undefined);

    await setGeneralSettings({ windowCloseAction: 'quit-application' });

    expect(mocks.invoke).toHaveBeenLastCalledWith(
      'set_store_key',
      expect.objectContaining({
        key: 'general',
        value: expect.objectContaining({
          theme: 'dark',
          windowCloseAction: 'quit-application',
        }),
      })
    );
  });
});
