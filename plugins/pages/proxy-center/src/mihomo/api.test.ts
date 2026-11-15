import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@/lib/tauri';
import { applyMihomoNodeSelection, testAndAttachMihomo } from './api';

vi.mock('@/lib/tauri', () => ({ invoke: vi.fn() }));

describe('Mihomo command errors', () => {
  beforeEach(() => vi.resetAllMocks());

  it('exposes Rust string errors as Error messages when adding local proxies', async () => {
    const message = '读取 Mihomo 配置文件失败: Access is denied';
    vi.mocked(invoke).mockRejectedValueOnce(message);
    const result = applyMihomoNodeSelection({ selected_node_names: ['test-node'] });
    await expect(result).rejects.toBeInstanceOf(Error);
    await expect(result).rejects.toThrow(message);
  });

  it('also exposes connection errors', async () => {
    vi.mocked(invoke).mockRejectedValueOnce('Mihomo 接口返回异常状态: /version');
    await expect(testAndAttachMihomo({ controller: '127.0.0.1:9097', secret: '' })).rejects.toThrow(
      'Mihomo 接口返回异常状态: /version'
    );
  });

  it('preserves existing Error objects', async () => {
    const error = new Error('connection closed');
    vi.mocked(invoke).mockRejectedValueOnce(error);
    await expect(applyMihomoNodeSelection({ selected_node_names: [] })).rejects.toBe(error);
  });

  it('preserves successful results and command arguments', async () => {
    const proxies: never[] = [];
    const request = { selected_node_names: ['test-node'] };
    vi.mocked(invoke).mockResolvedValueOnce(proxies);
    await expect(applyMihomoNodeSelection(request)).resolves.toBe(proxies);
    expect(invoke).toHaveBeenCalledWith('apply_mihomo_node_selection', { request });
  });
});
