import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@/lib/request', () => ({
  post: vi.fn(),
  isSuccess: (result: { success?: boolean }) => result.success === true,
}));

import {
  downloadBrowserKernel,
  getBrowserKernelInstallInfo,
  uninstallBrowserKernel,
  updateBrowserKernel,
} from '../index';

describe('browser kernel management commands', () => {
  it('uses dedicated backend commands with camelCase kernelId payloads', async () => {
    mocks.invoke.mockResolvedValue(undefined);

    mocks.invoke.mockResolvedValueOnce({
      kernelId: 'kernel-info',
      installDirName: 'Chrome 155',
      installPath: 'C:/example/Chrome 155',
      scope: 'standard',
      dirExists: true,
    });
    await getBrowserKernelInstallInfo('kernel-info');
    mocks.invoke.mockResolvedValue(undefined);

    await downloadBrowserKernel('kernel-download');
    await updateBrowserKernel('kernel-update');
    await uninstallBrowserKernel('kernel-uninstall');

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'get_browser_kernel_install_info', {
      kernelId: 'kernel-info',
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'download_browser_kernel', {
      kernelId: 'kernel-download',
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(3, 'update_browser_kernel', {
      kernelId: 'kernel-update',
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(4, 'uninstall_browser_kernel', {
      kernelId: 'kernel-uninstall',
    });
  });
});
