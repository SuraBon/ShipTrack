import type { CreateParcelDraft } from './createParcelDraft';
import type { CreatedParcelHistoryItem } from './createdParcelHistory';
import type { Parcel } from '@/types/parcel';

const DB_NAME = 'shiptrack_offline';
const DB_VERSION = 5;

export const OFFLINE_QUEUE_STORE = 'offlineQueue';
export const OFFLINE_MEDIA_STORE = 'offlineMedia';
export const OFFLINE_DRAFT_STORE = 'drafts';
export const OFFLINE_HISTORY_STORE = 'createdParcelHistory';
export const OFFLINE_PARCEL_CACHE_STORE = 'parcelsCache';

export const LEGACY_QUEUE_KEY = 'shiptrack_offline_queue';
export const LEGACY_DRAFT_KEY = 'shiptrack_create_parcel_draft';
export const LEGACY_HISTORY_KEY = 'shiptrack_created_parcels';

export type OfflineQueueStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export interface OfflineQueueItem {
  id: string;
  action: string;
  payload: any;
  idempotencyKey?: string;
  createdAt: string;
  timestamp: number;
  attemptCount: number;
  lastError?: string;
  status: OfflineQueueStatus;
  localMediaId?: string;
  /** Epoch ms — item is skipped until this time (exponential backoff). */
  nextRetryAt?: number;
}

export interface OfflineMediaRecord {
  id: string;
  data: string | Blob;
  createdAt: string;
  mimeType?: string;
}

export type OfflineDraftRecord = {
  id: 'createParcel';
  value: CreateParcelDraft;
  updatedAt: string;
};

export type OfflineHistoryRecord = CreatedParcelHistoryItem & {
  id: string;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise(resolve => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_MEDIA_STORE)) {
        db.createObjectStore(OFFLINE_MEDIA_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_DRAFT_STORE)) {
        db.createObjectStore(OFFLINE_DRAFT_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_HISTORY_STORE)) {
        db.createObjectStore(OFFLINE_HISTORY_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_PARCEL_CACHE_STORE)) {
        db.createObjectStore(OFFLINE_PARCEL_CACHE_STORE, { keyPath: 'TrackingID' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise(resolve => {
    const tx = db.transaction(storeName, mode);
    const request = run(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
    tx.onerror = () => resolve(null);
  });
}

export async function idbGetAll<T>(storeName: string): Promise<T[] | null> {
  const result = await withStore<T[]>(storeName, 'readonly', store => store.getAll() as IDBRequest<T[]>);
  return result ?? null;
}

export async function idbGetByIndex<T>(
  storeName: string,
  indexName: string,
  query: IDBValidKey | IDBKeyRange,
): Promise<T[] | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise(resolve => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    if (!store.indexNames.contains(indexName)) {
      resolve(null);
      return;
    }
    const request = store.index(indexName).getAll(query) as IDBRequest<T[]>;
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => resolve(null);
    tx.onerror = () => resolve(null);
  });
}

export async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  return withStore<T>(storeName, 'readonly', store => store.get(key) as IDBRequest<T>);
}

export async function idbPut<T>(storeName: string, value: T): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

export async function idbDelete(storeName: string, key: IDBValidKey): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

export async function idbClear(storeName: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

export async function idbReplaceAll<T>(storeName: string, items: T[]): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    items.forEach(item => {
      store.put(item);
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

export async function cacheParcelsLocally(parcels: Parcel[]): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(OFFLINE_PARCEL_CACHE_STORE, 'readwrite');
    const store = tx.objectStore(OFFLINE_PARCEL_CACHE_STORE);
    parcels.forEach(p => {
      if (p && p.TrackingID) {
        store.put(p);
      }
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

export async function getCachedParcelsLocally(): Promise<Parcel[]> {
  const cached = await idbGetAll<Parcel>(OFFLINE_PARCEL_CACHE_STORE);
  return cached ?? [];
}

export async function getCachedParcelLocally(trackingID: string): Promise<Parcel | null> {
  return idbGet<Parcel>(OFFLINE_PARCEL_CACHE_STORE, trackingID);
}
