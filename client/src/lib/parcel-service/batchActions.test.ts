// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const jsonResponse = (body: unknown) => ({
  ok: true,
  json: async () => body,
}) as Response;

describe('parcel service batch actions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_GAS_URL', 'https://script.google.test/exec');
    vi.stubEnv('VITE_GAS_API_KEY', 'test-key');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    localStorage.clear();
  });

  it('posts batchStartDelivery with tracking IDs, GPS, auth, and idempotency key', async () => {
    localStorage.setItem('shiptrack_user', JSON.stringify({
      employeeId: 'MSG01',
      role: 'MESSENGER',
      token: 'token-1',
    }));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      successCount: 2,
      failedCount: 0,
      results: [
        { trackingID: 'TRK202605270001', success: true },
        { trackingID: 'TRK202605270002', success: true },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { batchStartDelivery } = await import('./core');
    const res = await batchStartDelivery(['TRK202605270001', 'TRK202605270002'], 13.7563, 100.5018);

    expect(res.success).toBe(true);
    expect(res.successCount).toBe(2);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload).toMatchObject({
      action: 'batchStartDelivery',
      trackingIDs: ['TRK202605270001', 'TRK202605270002'],
      latitude: 13.7563,
      longitude: 100.5018,
      apiKey: 'test-key',
      employeeId: 'MSG01',
      role: 'MESSENGER',
      token: 'token-1',
    });
    expect(payload.idempotencyKey).toMatch(/^batchStartDelivery:/);
  });

  it('posts batchConfirmReceipt once with a shared proof image and returns partial failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      sharedPhotoUrl: 'https://drive.google.test/shared.jpg',
      successCount: 1,
      failedCount: 1,
      results: [
        { trackingID: 'TRK202605270001', success: true },
        { trackingID: 'TRK202605270002', success: false, error: 'มีผู้รับงานแล้ว' },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { batchConfirmReceipt } = await import('./core');
    const res = await batchConfirmReceipt(
      ['TRK202605270001', 'TRK202605270002'],
      'data:image/jpeg;base64,AAA',
      'ส่งพร้อมกัน',
      13.7563,
      100.5018,
    );

    expect(res.success).toBe(true);
    expect(res.successCount).toBe(1);
    expect(res.failedCount).toBe(1);
    expect(res.results?.[1]).toMatchObject({ trackingID: 'TRK202605270002', success: false });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload).toMatchObject({
      action: 'batchConfirmReceipt',
      trackingIDs: ['TRK202605270001', 'TRK202605270002'],
      photoUrl: 'data:image/jpeg;base64,AAA',
      note: 'ส่งพร้อมกัน',
      latitude: 13.7563,
      longitude: 100.5018,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(payload.idempotencyKey).toMatch(/^batchConfirmReceipt:/);
  });
});
