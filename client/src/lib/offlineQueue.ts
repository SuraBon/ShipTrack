import { toast } from 'sonner';
import { computeRetryDelayMs, isReadyForRetry, MAX_OFFLINE_ATTEMPTS } from './retryBackoff';
import { logTelemetry } from './telemetry';
import {
  LEGACY_QUEUE_KEY,
  OFFLINE_MEDIA_STORE,
  OFFLINE_QUEUE_STORE,
  type OfflineMediaRecord,
  type OfflineQueueItem,
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
  isIndexedDbAvailable,
  idbReplaceAll,
} from './offlineDb';

export type { OfflineQueueItem, OfflineQueueStatus } from './offlineDb';

export interface SyncResult {
  total: number;
  synced: number;
  failed: number;
}

export interface OfflineCleanupResult {
  removedQueueItems: number;
  removedMediaItems: number;
}

const QUEUE_UPDATED_EVENT = 'offline-queue-updated';
const FALLBACK_QUEUE_KEY = LEGACY_QUEUE_KEY;
export const OFFLINE_MEDIA_URL_PREFIX = 'offline-media://';
export const DEFAULT_OFFLINE_RETENTION_DAYS = 30;

function nowIso(): string {
  return new Date().toISOString();
}

function createId(action: string): string {
  return `${action}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeQueueItem(raw: any): OfflineQueueItem | null {
  if (!raw || typeof raw.action !== 'string' || !raw.payload) return null;
  const timestamp = Number(raw.timestamp || Date.parse(raw.createdAt || '') || Date.now());
  return {
    id: typeof raw.id === 'string' ? raw.id : createId(raw.action),
    action: raw.action,
    payload: raw.payload,
    idempotencyKey: typeof raw.idempotencyKey === 'string'
      ? raw.idempotencyKey
      : typeof raw.payload?.idempotencyKey === 'string'
        ? raw.payload.idempotencyKey
        : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(timestamp).toISOString(),
    timestamp,
    attemptCount: Number(raw.attemptCount || 0),
    lastError: typeof raw.lastError === 'string' ? raw.lastError : undefined,
    status: ['pending', 'syncing', 'failed', 'synced'].includes(raw.status) ? raw.status : 'pending',
    localMediaId: typeof raw.localMediaId === 'string' ? raw.localMediaId : undefined,
    nextRetryAt: typeof raw.nextRetryAt === 'number' ? raw.nextRetryAt : undefined,
  };
}

function readFallbackQueue(): OfflineQueueItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FALLBACK_QUEUE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeQueueItem).filter((item): item is OfflineQueueItem => Boolean(item));
  } catch {
    return [];
  }
}

function saveFallbackQueue(queue: OfflineQueueItem[]): boolean {
  try {
    localStorage.setItem(FALLBACK_QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (err) {
    console.error('Failed to save offline queue:', err);
    return false;
  }
}

function dispatchQueueUpdated(): void {
  window.dispatchEvent(new Event(QUEUE_UPDATED_EVENT));
}

async function migrateLegacyQueue(): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const legacy = readFallbackQueue();
  if (legacy.length === 0) return;
  const existing = await idbGetAll<OfflineQueueItem>(OFFLINE_QUEUE_STORE);
  if (existing === null) return;
  const existingIds = new Set(existing.map(item => item.id));
  for (const item of legacy) {
    if (!existingIds.has(item.id)) {
      await idbPut(OFFLINE_QUEUE_STORE, item);
    }
  }
  localStorage.removeItem(FALLBACK_QUEUE_KEY);
}

export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  await migrateLegacyQueue();
  const queue = await idbGetAll<OfflineQueueItem>(OFFLINE_QUEUE_STORE);
  if (queue) return queue.sort((a, b) => a.timestamp - b.timestamp);
  return readFallbackQueue().sort((a, b) => a.timestamp - b.timestamp);
}

export async function saveOfflineQueue(queue: OfflineQueueItem[]): Promise<boolean> {
  if (isIndexedDbAvailable()) {
    const success = await idbReplaceAll<OfflineQueueItem>(OFFLINE_QUEUE_STORE, queue);
    if (success) {
      dispatchQueueUpdated();
      return true;
    }
  }
  const success = saveFallbackQueue(queue);
  if (success) dispatchQueueUpdated();
  return success;
}

export async function enqueueOfflineAction(
  action: string,
  payload: any,
  media?: { localMediaId?: string },
): Promise<OfflineQueueItem> {
  const item: OfflineQueueItem = {
    id: createId(action),
    action,
    payload,
    idempotencyKey: typeof payload?.idempotencyKey === 'string' ? payload.idempotencyKey : undefined,
    createdAt: nowIso(),
    timestamp: Date.now(),
    attemptCount: 0,
    status: 'pending',
    localMediaId: media?.localMediaId,
  };

  const savedToIdb = isIndexedDbAvailable() && await idbPut(OFFLINE_QUEUE_STORE, item);
  if (!savedToIdb) {
    const queue = readFallbackQueue();
    queue.push(item);
    if (!saveFallbackQueue(queue)) {
      toast.error('พื้นที่เก็บข้อมูลในเครื่องเต็ม ไม่สามารถบันทึกรายการออฟไลน์ได้', {
        duration: 10000,
      });
      return item;
    }
  }

  dispatchQueueUpdated();
  toast.info('บันทึกรายการไว้ในเครื่องแล้ว ระบบจะซิงค์เมื่อเชื่อมต่อได้', {
    duration: 5000,
  });
  return item;
}

export async function updateOfflineAction(item: OfflineQueueItem): Promise<void> {
  if (isIndexedDbAvailable() && await idbPut(OFFLINE_QUEUE_STORE, item)) {
    dispatchQueueUpdated();
    return;
  }
  const next = readFallbackQueue().map(existing => existing.id === item.id ? item : existing);
  saveFallbackQueue(next);
  dispatchQueueUpdated();
}

export async function resetOfflineActionForRetry(id: string): Promise<boolean> {
  const queue = await getOfflineQueue();
  const item = queue.find(entry => entry.id === id);
  if (!item) return false;
  await updateOfflineAction({
    ...item,
    status: 'pending',
    attemptCount: 0,
    nextRetryAt: undefined,
    lastError: undefined,
  });
  logTelemetry({ level: 'info', name: 'offline.queue.retry', data: { id, action: item.action } });
  return true;
}

export async function resetFailedOfflineActions(): Promise<number> {
  const queue = await getOfflineQueue();
  const failed = queue.filter(item => item.status === 'failed');
  await Promise.all(failed.map(item => resetOfflineActionForRetry(item.id)));
  return failed.length;
}

export async function clearFailedOfflineActions(): Promise<number> {
  const queue = await getOfflineQueue();
  const failed = queue.filter(item => item.status === 'failed');
  for (const item of failed) {
    await removeOfflineAction(item.id);
    if (item.localMediaId) await deleteOfflineProofImage(item.localMediaId);
  }
  logTelemetry({ level: 'info', name: 'offline.queue.clear_failed', data: { count: failed.length } });
  return failed.length;
}

export async function removeOfflineAction(id: string): Promise<void> {
  if (isIndexedDbAvailable() && await idbDelete(OFFLINE_QUEUE_STORE, id)) {
    dispatchQueueUpdated();
    return;
  }
  const next = readFallbackQueue().filter(item => item.id !== id);
  saveFallbackQueue(next);
  dispatchQueueUpdated();
}

export async function saveOfflineProofImage(fileOrDataUrl: File | Blob | string): Promise<string> {
  const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const record: OfflineMediaRecord = {
    id,
    data: fileOrDataUrl,
    createdAt: nowIso(),
    mimeType: typeof fileOrDataUrl === 'string' ? undefined : fileOrDataUrl.type,
  };
  const saved = isIndexedDbAvailable() && await idbPut(OFFLINE_MEDIA_STORE, record);
  if (!saved && typeof fileOrDataUrl === 'string') {
    localStorage.setItem(`shiptrack_offline_media_${id}`, fileOrDataUrl);
  }
  if (!saved && typeof fileOrDataUrl !== 'string') {
    throw new Error('ไม่สามารถบันทึกรูปหลักฐานออฟไลน์ได้');
  }
  return id;
}

export async function getOfflineProofImage(localMediaId: string): Promise<string | Blob | null> {
  const record = await idbGet<OfflineMediaRecord>(OFFLINE_MEDIA_STORE, localMediaId);
  if (record) return record.data;
  return localStorage.getItem(`shiptrack_offline_media_${localMediaId}`);
}

const resolvedBlobUrls = new Map<string, string>();

export async function resolveOfflineProofImageUrl(url: string): Promise<string | null> {
  if (!url.startsWith(OFFLINE_MEDIA_URL_PREFIX)) return url;
  const mediaId = url.slice(OFFLINE_MEDIA_URL_PREFIX.length);
  const media = await getOfflineProofImage(mediaId);
  if (!media) return null;
  if (typeof media === 'string') return media;
  const previous = resolvedBlobUrls.get(mediaId);
  if (previous) URL.revokeObjectURL(previous);
  const objectUrl = URL.createObjectURL(media);
  resolvedBlobUrls.set(mediaId, objectUrl);
  return objectUrl;
}

export function revokeResolvedProofUrl(mediaId: string): void {
  const url = resolvedBlobUrls.get(mediaId);
  if (url) {
    URL.revokeObjectURL(url);
    resolvedBlobUrls.delete(mediaId);
  }
}

export async function deleteOfflineProofImage(localMediaId: string): Promise<void> {
  revokeResolvedProofUrl(localMediaId);
  await idbDelete(OFFLINE_MEDIA_STORE, localMediaId);
  localStorage.removeItem(`shiptrack_offline_media_${localMediaId}`);
}

function getRecordTime(value?: string): number {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? time : 0;
}

function cleanupLegacyMediaKeys(referencedMediaIds: Set<string>): number {
  let removed = 0;
  try {
    const prefix = 'shiptrack_offline_media_';
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach(key => {
      const mediaId = key.slice(prefix.length);
      if (!referencedMediaIds.has(mediaId)) {
        localStorage.removeItem(key);
        removed++;
      }
    });
  } catch {
    // ignore private mode/storage access errors
  }
  return removed;
}

export async function cleanupOfflineData(maxAgeDays = DEFAULT_OFFLINE_RETENTION_DAYS): Promise<OfflineCleanupResult> {
  const cutoff = Date.now() - Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000;
  const queue = await getOfflineQueue();
  const nextQueue: OfflineQueueItem[] = [];
  let removedQueueItems = 0;
  let removedMediaItems = 0;

  for (const item of queue) {
    const isOldFailed = item.status === 'failed' && item.timestamp < cutoff;
    if (isOldFailed) {
      removedQueueItems++;
      if (item.localMediaId) {
        await deleteOfflineProofImage(item.localMediaId);
        removedMediaItems++;
      }
    } else {
      nextQueue.push(item);
    }
  }

  if (removedQueueItems > 0) {
    await saveOfflineQueue(nextQueue);
  }

  const referencedMediaIds = new Set(nextQueue.map(item => item.localMediaId).filter((id): id is string => Boolean(id)));
  const mediaRecords = await idbGetAll<OfflineMediaRecord>(OFFLINE_MEDIA_STORE);
  if (mediaRecords) {
    for (const record of mediaRecords) {
      const createdAt = getRecordTime(record.createdAt);
      if (!referencedMediaIds.has(record.id) && (!createdAt || createdAt < cutoff)) {
        await deleteOfflineProofImage(record.id);
        removedMediaItems++;
      }
    }
  }
  removedMediaItems += cleanupLegacyMediaKeys(referencedMediaIds);

  if (removedQueueItems > 0 || removedMediaItems > 0) {
    logTelemetry({
      level: 'info',
      name: 'offline.cleanup',
      data: { maxAgeDays, removedQueueItems, removedMediaItems },
    });
    dispatchQueueUpdated();
  }

  return { removedQueueItems, removedMediaItems };
}

export { isReadyForRetry, MAX_OFFLINE_ATTEMPTS };
