import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  load: vi.fn(),
}));

vi.mock('@/lib/tauri', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/plugin-store', () => ({ load: mocks.load }));

import { useDownloadStore, type DownloadTask } from '../download-store';

function resetStore() {
  useDownloadStore.setState({ tasks: [] });
  mocks.invoke.mockReset();
  mocks.load.mockReset();
}

describe('download-store kernel prepare events', () => {
  beforeEach(resetStore);

  it('maps a paused download event to a paused task with the kernel control id', () => {
    useDownloadStore.getState().upsertKernelPrepare({
      env_uuid: null,
      kernel_value: 'Chrome 144',
      status: 'downloading',
      message: '下载已暂停',
      progress_percent: 42,
      download_state: 'paused',
    });

    const task = useDownloadStore.getState().tasks[0];
    expect(task.status).toBe('paused');
    expect(task.progress).toBe(42);
    expect(task.controlId).toBe('Chrome 144');
  });

  it('returns a paused task to downloading when download progress resumes', () => {
    const upsert = useDownloadStore.getState().upsertKernelPrepare;
    upsert({
      env_uuid: null,
      kernel_value: 'Chrome 144',
      status: 'downloading',
      progress_percent: 42,
      download_state: 'paused',
    });
    upsert({
      env_uuid: null,
      kernel_value: 'Chrome 144',
      status: 'downloading',
      message: '继续下载…',
      progress_percent: 43,
    });

    expect(useDownloadStore.getState().tasks[0].status).toBe('downloading');
    expect(useDownloadStore.getState().tasks[0].progress).toBe(43);
  });

  it('keeps the last progress when entering the extraction phase', () => {
    const upsert = useDownloadStore.getState().upsertKernelPrepare;
    upsert({
      env_uuid: null,
      kernel_value: 'Chrome 144',
      status: 'downloading',
      progress_percent: 99,
    });
    upsert({
      env_uuid: null,
      kernel_value: 'Chrome 144',
      status: 'extracting',
      message: '解压中…',
    });

    const task = useDownloadStore.getState().tasks[0];
    expect(task.phase).toBe('extracting');
    expect(task.progress).toBe(99);
  });

  it('records cancellation separately from download failure', () => {
    const upsert = useDownloadStore.getState().upsertKernelPrepare;
    upsert({
      env_uuid: 'env-1',
      kernel_value: 'Chrome 144',
      status: 'downloading',
      progress_percent: 42,
    });
    upsert({
      env_uuid: 'env-1',
      kernel_value: 'Chrome 144',
      status: 'error',
      message: '下载已取消',
      download_state: 'cancelled',
    });

    expect(useDownloadStore.getState().tasks[0].status).toBe('cancelled');
    expect(useDownloadStore.getState().tasks[0].message).toBe('下载已取消');
  });

  it('uses the kernel control id for pause, resume and cancel commands', async () => {
    mocks.invoke.mockResolvedValue(undefined);
    const task: DownloadTask = {
      id: 'env-1',
      name: '内核 Chrome 144',
      progress: 10,
      status: 'downloading',
      updatedAt: Date.now(),
      controlId: 'Chrome 144',
    };

    await useDownloadStore.getState().pauseTask(task);
    await useDownloadStore.getState().resumeTask(task);
    await useDownloadStore.getState().cancelTask(task);

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'pause_kernel_download', {
      kernelValue: 'Chrome 144',
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'resume_kernel_download', {
      kernelValue: 'Chrome 144',
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(3, 'cancel_kernel_download', {
      kernelValue: 'Chrome 144',
    });
  });
});
