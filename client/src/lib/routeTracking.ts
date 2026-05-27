import {
  OFFLINE_ROUTE_STORE,
  idbDelete,
  idbGetAll,
  idbGetByIndex,
  idbPut,
  isIndexedDbAvailable,
  type RouteSampleRecord,
} from './offlineDb';
import { logTelemetry } from './telemetry';

export type { RouteSampleRecord } from './offlineDb';

const ACTIVE_ROUTES_KEY = 'shiptrack_active_routes';
const ROUTE_UPDATED_EVENT = 'shiptrack-route-samples-updated';
const ROUTE_TRACKING_UPDATED_EVENT = 'shiptrack-route-tracking-updated';
export const ROUTE_TRACKING_ERROR_EVENT = 'shiptrack-route-tracking-error';
const MIN_SAMPLE_INTERVAL_MS = 15_000;
const BACKGROUND_MIN_SAMPLE_INTERVAL_MS = 60_000;
const MIN_SAMPLE_DISTANCE_M = 25;
const MAX_ACCEPTED_ACCURACY_M = 150;
const MAX_STORED_ROUTE_SAMPLES = 2000;

const activeWatchIds = new Map<string, number>();
const lastSamples = new Map<string, RouteSampleRecord>();

function dispatchRouteUpdated(trackingID: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ROUTE_UPDATED_EVENT, { detail: { trackingID } }));
}

function readFallbackSamples(): RouteSampleRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const parsed = JSON.parse(localStorage.getItem('shiptrack_route_samples') ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isRouteSample) : [];
  } catch {
    return [];
  }
}

function saveFallbackSamples(samples: RouteSampleRecord[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('shiptrack_route_samples', JSON.stringify(samples.slice(-MAX_STORED_ROUTE_SAMPLES)));
  } catch {
    // Storage quota/private mode failure should not break the delivery flow.
  }
}

function isRouteSample(value: any): value is RouteSampleRecord {
  return value &&
    typeof value.id === 'string' &&
    typeof value.trackingID === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    typeof value.timestamp === 'string';
}

function getActiveRoutes(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_ROUTES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function setActiveRoute(trackingID: string, active: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = new Set(getActiveRoutes());
    if (active) current.add(trackingID);
    else current.delete(trackingID);
    localStorage.setItem(ACTIVE_ROUTES_KEY, JSON.stringify(Array.from(current)));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(ROUTE_TRACKING_UPDATED_EVENT));
  } catch {
    // Route tracking can continue for the current tab even if active route persistence fails.
  }
}

export function getActiveRouteIds(): string[] {
  return getActiveRoutes();
}

function distanceMeters(a: RouteSampleRecord, b: RouteSampleRecord): number {
  const earthRadius = 6_371_000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function saveRouteSample(sample: RouteSampleRecord): Promise<void> {
  if (isIndexedDbAvailable() && await idbPut(OFFLINE_ROUTE_STORE, sample)) {
    dispatchRouteUpdated(sample.trackingID);
    return;
  }
  const next = [...readFallbackSamples(), sample].slice(-MAX_STORED_ROUTE_SAMPLES);
  saveFallbackSamples(next);
  dispatchRouteUpdated(sample.trackingID);
}

function shouldSaveSample(next: RouteSampleRecord): boolean {
  const previous = lastSamples.get(next.trackingID);
  if (!previous) return true;
  const elapsed = Date.parse(next.timestamp) - Date.parse(previous.timestamp);
  const minInterval = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    ? BACKGROUND_MIN_SAMPLE_INTERVAL_MS
    : MIN_SAMPLE_INTERVAL_MS;
  if (elapsed < minInterval) return false;
  return distanceMeters(previous, next) >= MIN_SAMPLE_DISTANCE_M;
}

export function startRouteTracking(trackingID: string): boolean {
  if (!trackingID || activeWatchIds.has(trackingID)) return false;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return false;

  let watchId: number;
  try {
    watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        if (Number.isFinite(accuracy) && accuracy > MAX_ACCEPTED_ACCURACY_M) return;

        const sample: RouteSampleRecord = {
          id: `${trackingID}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          trackingID,
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          timestamp: new Date(position.timestamp || Date.now()).toISOString(),
          synced: false,
        };
        if (!shouldSaveSample(sample)) return;
        lastSamples.set(trackingID, sample);
        void saveRouteSample(sample);
      },
      error => {
        const code = (error as GeolocationPositionError)?.code;
        const message = code === 1
          ? 'ไม่ได้รับอนุญาตให้ใช้ GPS'
          : code === 2
            ? 'ไม่สามารถระบุตำแหน่งได้'
            : code === 3
              ? 'หมดเวลาในการรับตำแหน่ง GPS'
              : 'เกิดข้อผิดพลาด GPS';
        logTelemetry({
          level: 'warn',
          name: 'route.tracking.geo_error',
          trackingID,
          message,
          data: { code },
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(ROUTE_TRACKING_ERROR_EVENT, {
            detail: { trackingID, code, message },
          }));
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 20_000,
      },
    );
  } catch {
    return false;
  }

  activeWatchIds.set(trackingID, watchId);
  setActiveRoute(trackingID, true);
  return true;
}

export function stopRouteTracking(trackingID: string): void {
  const watchId = activeWatchIds.get(trackingID);
  if (watchId !== undefined && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  activeWatchIds.delete(trackingID);
  setActiveRoute(trackingID, false);
}

async function readRouteSamplesForTracking(trackingID: string): Promise<RouteSampleRecord[]> {
  if (isIndexedDbAvailable()) {
    const indexed = await idbGetByIndex<RouteSampleRecord>(OFFLINE_ROUTE_STORE, 'trackingID', trackingID);
    if (indexed) {
      return indexed.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    }
  }
  return readFallbackSamples()
    .filter(sample => sample.trackingID === trackingID)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export async function getRouteSamples(trackingID: string): Promise<RouteSampleRecord[]> {
  return readRouteSamplesForTracking(trackingID);
}

export async function getUnsyncedRouteSamples(trackingID?: string): Promise<RouteSampleRecord[]> {
  const records = await idbGetAll<RouteSampleRecord>(OFFLINE_ROUTE_STORE);
  const source = records ?? readFallbackSamples();
  return source
    .filter(sample => !sample.synced && (!trackingID || sample.trackingID === trackingID))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export async function markRouteSamplesSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const records = await idbGetAll<RouteSampleRecord>(OFFLINE_ROUTE_STORE);
  if (records) {
    await Promise.all(
      records
        .filter(sample => idSet.has(sample.id))
        .map(sample => idbPut(OFFLINE_ROUTE_STORE, { ...sample, synced: true })),
    );
    const trackingIds = new Set(records.filter(sample => idSet.has(sample.id)).map(sample => sample.trackingID));
    trackingIds.forEach(dispatchRouteUpdated);
    return;
  }

  const fallbackSamples = readFallbackSamples();
  const nextSamples = fallbackSamples.map(sample => idSet.has(sample.id) ? { ...sample, synced: true } : sample);
  saveFallbackSamples(nextSamples);
  new Set(fallbackSamples.filter(sample => idSet.has(sample.id)).map(sample => sample.trackingID)).forEach(dispatchRouteUpdated);
}

export async function clearRouteSamples(trackingID: string): Promise<void> {
  const records = await getRouteSamples(trackingID);
  await Promise.all(records.map(record => idbDelete(OFFLINE_ROUTE_STORE, record.id)));
  saveFallbackSamples(readFallbackSamples().filter(sample => sample.trackingID !== trackingID));
  dispatchRouteUpdated(trackingID);
}

export async function purgeSyncedRouteSamples(olderThanDays: number = 3): Promise<void> {
  const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const records = await idbGetAll<RouteSampleRecord>(OFFLINE_ROUTE_STORE);
  if (records) {
    const toDelete = records.filter(sample => sample.synced && Date.parse(sample.timestamp) < cutoffTime);
    await Promise.all(toDelete.map(sample => idbDelete(OFFLINE_ROUTE_STORE, sample.id)));
  }

  const fallbackSamples = readFallbackSamples();
  const nextFallback = fallbackSamples.filter(
    sample => !(sample.synced && Date.parse(sample.timestamp) < cutoffTime)
  );
  if (nextFallback.length !== fallbackSamples.length) {
    saveFallbackSamples(nextFallback);
  }
}

export function resumeActiveRouteTracking(): void {
  for (const trackingID of getActiveRoutes()) {
    startRouteTracking(trackingID);
  }
}

export type RouteSyncSnapshot = {
  pendingRouteSampleCount: number;
  latestRouteSampleAt: string | null;
};

/** Lightweight status for header popover (avoids loading all samples per active route). */
export async function getRouteSyncSnapshot(): Promise<RouteSyncSnapshot> {
  const unsynced = await getUnsyncedRouteSamples();
  const latest = unsynced
    .map(sample => sample.timestamp)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  return { pendingRouteSampleCount: unsynced.length, latestRouteSampleAt: latest };
}

export async function migrateRouteSamplesToIndexedDb(): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const fallback = readFallbackSamples();
  if (fallback.length === 0) return;
  const existing = await idbGetAll<RouteSampleRecord>(OFFLINE_ROUTE_STORE);
  if (existing && existing.length > 0) return;
  for (const sample of fallback) {
    await idbPut(OFFLINE_ROUTE_STORE, sample);
  }
  saveFallbackSamples([]);
  logTelemetry({ level: 'info', name: 'route.samples.migrated', data: { count: fallback.length } });
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    void migrateRouteSamplesToIndexedDb();
    resumeActiveRouteTracking();
  });
}
