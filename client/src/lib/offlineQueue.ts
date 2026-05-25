import { toast } from 'sonner';

export interface OfflineAction {
  id: string;
  action: string;
  payload: any;
  timestamp: number;
}

const QUEUE_KEY = 'shiptrack_offline_queue';

export function getOfflineQueue(): OfflineAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as OfflineAction[];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineAction[]): boolean {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (err) {
    console.error('Failed to save offline queue:', err);
    return false;
  }
}

export function enqueueOfflineAction(action: string, payload: any): void {
  const queue = getOfflineQueue();
  const id = `${action}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  queue.push({
    id,
    action,
    payload,
    timestamp: Date.now(),
  });
  
  const success = saveOfflineQueue(queue);
  if (success) {
    toast.info('บันทึกข้อมูลในเครื่องแล้ว ระบบจะอัปเดตเมื่อเน็ตกลับมา', {
      duration: 5000,
    });
  } else {
    toast.error('พื้นที่เก็บข้อมูลในเครื่องเต็ม! ไม่สามารถบันทึกรายการออฟไลน์ได้ กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อซิงค์ข้อมูลก่อน', {
      duration: 10000,
    });
  }
}

export function removeOfflineAction(id: string): void {
  const queue = getOfflineQueue();
  const next = queue.filter(item => item.id !== id);
  saveOfflineQueue(next);
}
