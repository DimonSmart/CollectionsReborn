import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from './BingSavesImportView.js';

describe('withTimeout', () => {
  it('rejects a stalled Bing read instead of leaving the wizard busy forever', async () => {
    vi.useFakeTimers();
    const stalled = new Promise<never>(() => undefined);
    const result = withTimeout(stalled, 10_000, 'Bing read timed out.');
    const assertion = expect(result).rejects.toThrow('Bing read timed out.');

    await vi.advanceTimersByTimeAsync(10_000);

    await assertion;
    vi.useRealTimers();
  });

  it('returns a Bing result completed before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ready'), 10_000, 'timeout')).resolves.toBe('ready');
  });
});
