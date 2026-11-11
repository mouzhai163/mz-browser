import { describe, expect, it, vi } from 'vitest';
import { BaseBrowserAdapter } from '../base-browser-adapter';

function adapterWith(evaluateIn: ReturnType<typeof vi.fn>) {
  const adapter = Object.create(BaseBrowserAdapter.prototype) as BaseBrowserAdapter;
  Object.assign(adapter, {
    evaluateIn,
    requirePage: async () => 'page',
    settleAfterAction: async () => undefined,
  });
  return adapter;
}

describe('executeScript', () => {
  it('retries when the page had no execution context yet', async () => {
    const evaluateIn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Cannot find context with specified id'))
      .mockResolvedValue({ ok: true, value: 'done' });
    await expect(adapterWith(evaluateIn).executeScript('return 1')).resolves.toBe('done');
    expect(evaluateIn).toHaveBeenCalledTimes(2);
  });

  it('does not run again when the script navigated away', async () => {
    const evaluateIn = vi.fn().mockRejectedValue(new Error('Execution context was destroyed.'));
    await expect(adapterWith(evaluateIn).executeScript('location.href = "/x"')).resolves.toBe('');
    expect(evaluateIn).toHaveBeenCalledTimes(1);
  });

  it('gives up when the context never appears', async () => {
    const evaluateIn = vi.fn().mockRejectedValue(new Error('Cannot find context with specified id'));
    await expect(adapterWith(evaluateIn).executeScript('return 1')).rejects.toThrow('Cannot find context');
    expect(evaluateIn).toHaveBeenCalledTimes(3);
  });

  it('reports other errors at once', async () => {
    const evaluateIn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(adapterWith(evaluateIn).executeScript('return 1')).rejects.toThrow('boom');
    expect(evaluateIn).toHaveBeenCalledTimes(1);
  });
});
