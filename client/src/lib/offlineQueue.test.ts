import { vi, describe, expect, it, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { getOfflineQueue, saveOfflineQueue, enqueueOfflineAction, removeOfflineAction } from './offlineQueue';

// Mock localStorage
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
    for (const key in store) {
      delete store[key];
    }
  }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock sonner
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

  it('should retrieve an empty queue if none exists in localStorage', () => {
    const queue = getOfflineQueue();
    expect(queue).toEqual([]);
    expect(localStorageMock.getItem).toHaveBeenCalledWith('shiptrack_offline_queue');
  });

  it('should retrieve parsed queue from localStorage', () => {
    const mockQueue = [
      { id: '1', action: 'startDelivery', payload: { trackingID: 'TRK1' }, timestamp: 12345 }
    ];
    store['shiptrack_offline_queue'] = JSON.stringify(mockQueue);

    const queue = getOfflineQueue();
    expect(queue).toEqual(mockQueue);
  });

  it('should handle corrupt data gracefully by returning empty queue', () => {
    store['shiptrack_offline_queue'] = 'invalid-json';
    const queue = getOfflineQueue();
    expect(queue).toEqual([]);
  });

  it('should save queue to localStorage', () => {
    const mockQueue = [
      { id: '1', action: 'releaseDelivery', payload: { trackingID: 'TRK1' }, timestamp: 12345 }
    ];
    const success = saveOfflineQueue(mockQueue);
    expect(success).toBe(true);
    expect(JSON.parse(store['shiptrack_offline_queue'])).toEqual(mockQueue);
  });

  it('should enqueue an offline action and show a toast', () => {
    const action = 'confirmReceipt';
    const payload = { trackingID: 'TRK123', note: 'test' };

    enqueueOfflineAction(action, payload);

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].action).toBe(action);
    expect(queue[0].payload).toEqual(payload);
    expect(queue[0].id).toBeDefined();
    expect(queue[0].timestamp).toBeDefined();

    // Verify sonner toast.info was called
    expect(toast.info).toHaveBeenCalledWith(
      'บันทึกข้อมูลในเครื่องแล้ว ระบบจะอัปเดตเมื่อเน็ตกลับมา',
      expect.any(Object)
    );
  });

  it('should remove an offline action by id', () => {
    const mockQueue = [
      { id: 'action_1', action: 'startDelivery', payload: { trackingID: 'TRK1' }, timestamp: 123 },
      { id: 'action_2', action: 'startDelivery', payload: { trackingID: 'TRK2' }, timestamp: 456 }
    ];
    saveOfflineQueue(mockQueue);

    removeOfflineAction('action_1');

    const queue = getOfflineQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe('action_2');
  });
});
