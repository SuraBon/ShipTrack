import { describe, expect, it } from 'vitest';
import { computeRetryDelayMs, isReadyForRetry, MAX_OFFLINE_ATTEMPTS } from './retryBackoff';

describe('retryBackoff', () => {
  it('respects nextRetryAt gate', () => {
    expect(isReadyForRetry(undefined)).toBe(true);
    expect(isReadyForRetry(Date.now() + 60_000)).toBe(false);
    expect(isReadyForRetry(Date.now() - 1)).toBe(true);
  });

  it('computes increasing delay', () => {
    const a = computeRetryDelayMs(1);
    const b = computeRetryDelayMs(4);
    expect(b).toBeGreaterThanOrEqual(a);
    expect(a).toBeGreaterThanOrEqual(5_000);
  });

  it('defines max offline attempts', () => {
    expect(MAX_OFFLINE_ATTEMPTS).toBeGreaterThan(3);
  });
});
