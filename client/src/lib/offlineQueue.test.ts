import { vi, describe, expect, it, beforeEach } from 'vitest';
import { toast } from 'sonner';
import {
  enqueueOfflineAction,
  getOfflineQueue,
  removeOfflineAction,
  saveOfflineQueue,
  saveOfflineProofImage,
  getOfflineProofImage,
  updateOfflineAction,
  cleanupOfflineData,
  MAX_FALLBACK_MEDIA_DATA_URL_BYTES,
  type OfflineQueueItem,
} from './offlineQueue';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = String(value);
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const key in store) delete store[key];
  }),
  key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  get length() {
    return Object.keys(store).length;
  },
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'indexedDB', { value: undefined, writable: true });
Object.defineProperty(globalThis, 'window', {
  value: {
    dispatchEvent: vi.fn(),
  },
  writable: true,
});

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('offlineQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('retrieves an empty queue if none exists', async () => {
    const queue = await getOfflineQueue();
    expect(queue).toEqual([]);
    expect(localStorageMock.getItem).toHaveBeenCalledWith('shiptrack_offline_queue');
  });

  it('migrates legacy localStorage shape to normalized queue items', async () => {
    store.shiptrack_offline_queue = JSON.stringify([
      { id: '1', action: 'startDelivery', payload: { trackingID: 'TRK1' }, timestamp: 12345 },
    ]);

    const queue = await getOfflineQueue();
    expect(queue[0]).toMatchObject({
      id: '1',
      action: 'startDelivery',
      payload: { trackingID: 'TRK1' },
      timestamp: 12345,
      attemptCount: 0,
      status: 'pending',
    });
    expect(queue[0].createdAt).toBeDefined();
  });

  it('handles corrupt data gracefully', async () => {
    store.shiptrack_offline_queue = 'invalid-json';
    await expect(getOfflineQueue()).resolves.toEqual([]);
  });

  it('saves queue items to fallback storage', async () => {
    const mockQueue: OfflineQueueItem[] = [
      {
        id: '1',
        action: 'releaseDelivery',
        payload: { trackingID: 'TRK1' },
        timestamp: 12345,
        createdAt: new Date(12345).toISOString(),
        attemptCount: 0,
        status: 'pending',
      },
    ];

    await expect(saveOfflineQueue(mockQueue)).resolves.toBe(true);
    expect(JSON.parse(store.shiptrack_offline_queue)).toEqual(mockQueue);
  });

  it('enqueues an offline action with metadata and toast', async () => {
    const item = await enqueueOfflineAction('confirmReceipt', {
      trackingID: 'TRK123',
      note: 'test',
      idempotencyKey: 'idem-1',
    });

    const queue = await getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      id: item.id,
      action: 'confirmReceipt',
      idempotencyKey: 'idem-1',
      status: 'pending',
      attemptCount: 0,
    });
    expect(toast.info).toHaveBeenCalledWith(
      'บันทึกรายการไว้ในเครื่องแล้ว ระบบจะซิงค์เมื่อเชื่อมต่อได้',
      expect.any(Object),
    );
  });

  it('updates failed item state without removing it', async () => {
    const item = await enqueueOfflineAction('startDelivery', { trackingID: 'TRK1' });
    await updateOfflineAction({
      ...item,
      status: 'failed',
      attemptCount: 1,
      lastError: 'ปลายทางไม่ถูกต้อง',
    });

    const queue = await getOfflineQueue();
    expect(queue[0]).toMatchObject({
      id: item.id,
      status: 'failed',
      attemptCount: 1,
      lastError: 'ปลายทางไม่ถูกต้อง',
    });
  });

  it('removes an offline action by id', async () => {
    const first = await enqueueOfflineAction('startDelivery', { trackingID: 'TRK1' });
    const second = await enqueueOfflineAction('startDelivery', { trackingID: 'TRK2' });

    await removeOfflineAction(first.id);

    const queue = await getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(second.id);
  });

  it('stores data URL proof media in fallback storage', async () => {
    const id = await saveOfflineProofImage('data:image/jpeg;base64,abc');
    await expect(getOfflineProofImage(id)).resolves.toBe('data:image/jpeg;base64,abc');
  });

  it('rejects oversized data URL proof media in fallback storage', async () => {
    const oversized = `data:image/jpeg;base64,${'a'.repeat(MAX_FALLBACK_MEDIA_DATA_URL_BYTES)}`;

    await expect(saveOfflineProofImage(oversized)).rejects.toThrow('รูปหลักฐานมีขนาดใหญ่เกินไป');
  });

  it('rejects blob proof media when IndexedDB is unavailable', async () => {
    await expect(saveOfflineProofImage(new Blob(['proof'], { type: 'image/jpeg' }))).rejects.toThrow('ไม่สามารถบันทึกรูปหลักฐานออฟไลน์ได้');
  });

  it('cleans old failed queue items and orphaned fallback media', async () => {
    const oldTimestamp = Date.now() - 31 * 24 * 60 * 60 * 1000;
    store.shiptrack_offline_queue = JSON.stringify([
      {
        id: 'failed-1',
        action: 'confirmReceipt',
        payload: { trackingID: 'TRK1' },
        timestamp: oldTimestamp,
        createdAt: new Date(oldTimestamp).toISOString(),
        attemptCount: 3,
        status: 'failed',
        localMediaId: 'old',
      },
      {
        id: 'pending-1',
        action: 'startDelivery',
        payload: { trackingID: 'TRK2' },
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        attemptCount: 0,
        status: 'pending',
        localMediaId: 'kept',
      },
    ]);
    store.shiptrack_offline_media_old = 'data:image/jpeg;base64,old';
    store.shiptrack_offline_media_kept = 'data:image/jpeg;base64,kept';
    store.shiptrack_offline_media_orphan = 'data:image/jpeg;base64,orphan';

    const result = await cleanupOfflineData(30);
    const queue = await getOfflineQueue();

    expect(result).toEqual({ removedQueueItems: 1, removedMediaItems: 2 });
    expect(queue).toHaveLength(1);
    expect(store.shiptrack_offline_media_old).toBeUndefined();
    expect(store.shiptrack_offline_media_orphan).toBeUndefined();
    expect(store.shiptrack_offline_media_kept).toBe('data:image/jpeg;base64,kept');
  });
});
