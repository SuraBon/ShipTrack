// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const jsonResponse = (body: unknown) => ({
  ok: true,
  json: async () => body,
}) as Response;

describe('critical parcel service flow', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_GAS_URL', 'https://script.google.test/exec');
    vi.stubEnv('VITE_GAS_API_KEY', 'test-key');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('shiptrack_user', JSON.stringify({
      employeeId: 'ADMIN',
      name: 'Admin',
      role: 'ADMIN',
      token: 'token-admin',
      issuedAt: Date.now(),
    }));
  });

  it('creates, starts, confirms, and reads system health with auth and idempotency', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, trackingID: 'TRK202605280001' }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        health: {
          status: 'ok',
          checkedAt: new Date().toISOString(),
          elapsedMs: 12,
          checks: [{ name: 'apiKey', ok: true, message: 'configured', elapsedMs: 1 }],
          metrics: {
            userCount: 1,
            activeUserCount: 1,
            parcelSheetCount: 1,
            parcelRowCount: 1,
            eventRowCount: 1,
            routeSampleRowCount: 0,
          },
        },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const { createParcel, startDelivery, confirmReceipt, getSystemHealth } = await import('./core');

    const created = await createParcel('A', 'MS', 'B', 'บางนา', 'docs', '', 13.7, 100.5);
    expect(created).toMatchObject({ success: true, trackingID: 'TRK202605280001' });

    const started = await startDelivery('TRK202605280001', 13.71, 100.51);
    expect(started.success).toBe(true);

    const confirmed = await confirmReceipt('TRK202605280001', 'data:image/jpeg;base64,AAA', 'delivered', 13.72, 100.52);
    expect(confirmed.success).toBe(true);

    const health = await getSystemHealth();
    expect(health.success).toBe(true);
    expect(health.health?.status).toBe('ok');

    const payloads = fetchMock.mock.calls.map(call => JSON.parse(call[1].body as string));
    expect(payloads.map(payload => payload.action)).toEqual([
      'createParcel',
      'startDelivery',
      'confirmReceipt',
      'getSystemHealth',
    ]);
    payloads.forEach(payload => {
      expect(payload).toMatchObject({
        apiKey: 'test-key',
        employeeId: 'ADMIN',
        role: 'ADMIN',
        token: 'token-admin',
      });
      expect(payload.requestId).toMatch(/^api_/);
    });
    expect(payloads[0].idempotencyKey).toMatch(/^createParcel:/);
    expect(payloads[1].idempotencyKey).toMatch(/^startDelivery:/);
    expect(payloads[2].idempotencyKey).toMatch(/^confirmReceipt:/);
  });
});
