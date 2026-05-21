const DEFAULT_ERROR = 'เกิดข้อผิดพลาด กรุณาลองใหม่';

export function getErrorMessage(err: unknown, fallback = DEFAULT_ERROR): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function isAuthErrorMessage(message: unknown): boolean {
  const text = String(message || '');
  return [
    'Authentication required (Missing Token)',
    'Invalid token signature',
    'Malformed token',
    'Token expired',
    'Session replaced',
  ].some(error => text.includes(error));
}
