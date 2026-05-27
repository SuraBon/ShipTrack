/** Max sync attempts before an offline queue item is marked failed permanently. */
export const MAX_OFFLINE_ATTEMPTS = 8;

/** Exponential backoff with jitter (cap 30 min). */
export function computeRetryDelayMs(attemptCount: number): number {
  const capped = Math.min(attemptCount, 10);
  const base = Math.min(60_000 * 2 ** capped, 30 * 60_000);
  const jitter = Math.random() * base * 0.25;
  return Math.max(5_000, Math.round(base + jitter));
}

export function isReadyForRetry(nextRetryAt?: number): boolean {
  if (!nextRetryAt) return true;
  return Date.now() >= nextRetryAt;
}
