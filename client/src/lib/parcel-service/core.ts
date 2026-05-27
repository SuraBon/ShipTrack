/**
 * Parcel Service — Google Apps Script API client
 */

import type {
  CreateParcelPayload,
  CreateParcelResponse,
  GetParcelsResponse,
  GetParcelPayload,
  GetParcelResponse,
  ConfirmReceiptPayload,
  ConfirmReceiptResponse,
  DeliveryMatchStatus,
  StartDeliveryPayload,
  StartDeliveryResponse,
  ReleaseDeliveryPayload,
  ReleaseDeliveryResponse,
  BatchParcelActionResponse,
  ExportSummaryResponse,
  ParcelSummary,
  Parcel,
} from '@/types/parcel';
import { applyDerivedStatus, applyDerivedStatuses } from '../parcelStatus';
import { normalizeRole } from '../roles';
import { getDeviceId } from '../createdParcelHistory';
import { getErrorMessage, getServerErrorMessage, isAuthErrorMessage, isNetworkErrorMessage } from '../apiErrorHelper';
import { createIdempotencyKey } from '../idempotency';
import { createRequestId, logTelemetry } from '../telemetry';
import {
  OFFLINE_MEDIA_URL_PREFIX,
  deleteOfflineProofImage,
  enqueueOfflineAction,
  getOfflineProofImage,
  getOfflineQueue,
  isReadyForRetry,
  MAX_OFFLINE_ATTEMPTS,
  removeOfflineAction,
  saveOfflineProofImage,
  updateOfflineAction,
  type OfflineQueueItem,
  type SyncResult,
} from '../offlineQueue';
import { computeRetryDelayMs } from '../retryBackoff';
import { initSyncManager, registerSyncRunner } from '../syncManager';
import {
  getActiveRouteIds,
  getUnsyncedRouteSamples,
  markRouteSamplesSynced,
  purgeSyncedRouteSamples,
  type RouteSampleRecord,
} from '../routeTracking';
import {
  cacheParcelsLocally,
  getCachedParcelLocally,
  getCachedParcelsLocally,
} from '../offlineDb';
export { getCachedParcelsLocally };
import { toast } from 'sonner';
import type { AuditLogRow, BranchRow, CreateUserInput, LogQueryInput, ParcelActivityLogRow, UpdateUserInput, User, UserRow } from './types';
import { normalizeParcelStatus, normalizeParcels } from './parcelNormalizers';
import { REAL_AUTH_ERRORS, normalizeAuthResponse } from './authNormalizers';
import {
  API_TIMEOUT_MS,
  BRANCHES,
  GAS_API_KEY,
  GAS_URL,
  getBranches,
  getGasUrl,
  isConfigured,
  normalizeBranchList,
  onConfigUpdated,
  setBranches,
} from './configState';

let isSyncing = false;
let isRouteSyncing = false;
const ROUTE_SYNC_BATCH_SIZE = 100;
const QUEUEABLE_ACTIONS = ['createParcel', 'confirmReceipt', 'batchConfirmReceipt', 'startDelivery', 'batchStartDelivery', 'releaseDelivery'];
const ROUTE_SYNC_STATUS_EVENT = 'shiptrack-route-sync-status';

// ── Status normalizer ────────────────────────────────────────────────────────
type CallApiOptions = {
  includeAuth?: boolean;
  dispatchAuthError?: boolean;
};

const NO_RETRY = 0;


async function prepareOfflinePayload<T extends Record<string, any>>(payload: T): Promise<{ payload: T; localMediaId?: string }> {
  const photoUrl = payload.photoUrl;
  if (typeof photoUrl !== 'string' || !photoUrl.startsWith('data:')) return { payload };
  const localMediaId = await saveOfflineProofImage(photoUrl);
  return {
    payload: {
      ...payload,
      photoUrl: `${OFFLINE_MEDIA_URL_PREFIX}${localMediaId}`,
    },
    localMediaId,
  };
}

async function enqueuePayload(payload: any): Promise<void> {
  const prepared = await prepareOfflinePayload(payload);
  await enqueueOfflineAction(prepared.payload.action, prepared.payload, { localMediaId: prepared.localMediaId });
}

async function resolveSyncPayload<T extends Record<string, any>>(payload: T): Promise<T> {
  const photoUrl = payload.photoUrl;
  if (typeof photoUrl !== 'string' || !photoUrl.startsWith(OFFLINE_MEDIA_URL_PREFIX)) return payload;
  const localMediaId = photoUrl.slice(OFFLINE_MEDIA_URL_PREFIX.length);
  const media = await getOfflineProofImage(localMediaId);
  if (!media) return payload;
  if (typeof media === 'string') return { ...payload, photoUrl: media };
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(media);
  });
  return { ...payload, photoUrl: dataUrl };
}

async function callAPI<T>(
  payload: object,
  { includeAuth = true, dispatchAuthError = true }: CallApiOptions = {},
  retries = 2,
): Promise<T> {
  if (!GAS_URL) {
    throw new Error('กรุณาตั้งค่า Google Apps Script URL ก่อน');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const p = payload as any;
    const isQueueable = !isSyncing && p && p.action && QUEUEABLE_ACTIONS.includes(p.action);
    if (isQueueable) {
      await enqueuePayload(p);
      return { success: true, queued: true } as any;
    }
    throw new Error('ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาตรวจสอบสัญญาณแล้วลองใหม่');
  }

  const requestId = createRequestId('api');
  let lastError: Error = new Error('เกิดข้อผิดพลาด');
  const action = (payload as any)?.action as string | undefined;
  const trackingID = (payload as any)?.trackingID as string | undefined;
  logTelemetry({ level: 'info', name: 'api.call.start', requestId, action, trackingID });

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Exponential backoff with random jitter to stagger retry requests
    if (attempt > 0) {
      const baseDelay = Math.pow(2, attempt) * 1000; // e.g., 2000ms, 4000ms
      const jitterRange = baseDelay * 0.25; // 25% jitter range
      const jitter = (Math.random() * 2 - 1) * jitterRange;
      const finalDelay = Math.max(500, Math.round(baseDelay + jitter));
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }

    let response: Response;
    try {
      let authData = {};
      const storedUser = includeAuth ? localStorage.getItem('shiptrack_user') : null;
      if (includeAuth && storedUser) {
        try {
          const u = JSON.parse(storedUser) as Record<string, unknown>;
          authData = { employeeId: u['employeeId'], role: u['role'], token: u['token'] };
        } catch {
          // ignore
        }
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      try {
        response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({
            ...authData,
            ...payload,
            apiKey: GAS_API_KEY,
            requestId,
            clientTime: new Date().toISOString(),
          }),
          // GAS requires text/plain to avoid CORS preflight
          headers: { 'Content-Type': 'text/plain' },
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      lastError = new Error(isAbort
        ? 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง'
        : 'ไม่สามารถเชื่อมต่อระบบได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      logTelemetry({
        level: 'warn',
        name: 'api.call.network_error',
        requestId,
        action,
        trackingID,
        message: lastError.message,
        data: { attempt },
      });
      // Network error — retry
      continue;
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('API Key ไม่ถูกต้องหรือไม่มีสิทธิ์เข้าถึง');
      } else if (response.status === 429) {
        lastError = new Error('ระบบรับคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่');
        continue;
      } else if (response.status >= 500) {
        lastError = new Error('ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง');
        // Server error — retry
        continue;
      }
      logTelemetry({
        level: response.status >= 500 ? 'warn' : 'error',
        name: 'api.call.http_error',
        requestId,
        action,
        trackingID,
        message: `HTTP ${response.status}: ${response.statusText}`,
        data: { attempt, status: response.status },
      });
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let data: Record<string, unknown>;
    try {
      data = await response.json() as Record<string, unknown>;
    } catch {
      lastError = new Error('ระบบตอบกลับไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      logTelemetry({
        level: 'warn',
        name: 'api.call.bad_json',
        requestId,
        action,
        trackingID,
        message: lastError.message,
        data: { attempt },
      });
      continue;
    }
    if (dispatchAuthError && data && data['success'] === false) {
      const storedUser = includeAuth ? localStorage.getItem('shiptrack_user') : null;
      if (storedUser && isAuthErrorMessage(data['error'])) {
        window.dispatchEvent(new Event('auth_error'));
      }
      data['error'] = getServerErrorMessage(data['error']);
    }
    logTelemetry({
      level: (data as any)?.success === false ? 'warn' : 'info',
      name: 'api.call.finish',
      requestId,
      action,
      trackingID,
      data: {
        attempt,
        success: (data as any)?.success,
        queued: (data as any)?.queued,
        savedCount: (data as any)?.savedCount,
        skippedCount: (data as any)?.skippedCount,
      },
    });
    return data as T;
  }

  const p = payload as any;
  const isQueueable = !isSyncing && p && p.action && QUEUEABLE_ACTIONS.includes(p.action);
  const isNetworkError = isNetworkErrorMessage(lastError.message);
  if (isQueueable && isNetworkError) {
    await enqueuePayload(p);
    logTelemetry({ level: 'info', name: 'api.call.queued', requestId, action, trackingID, message: lastError.message });
    return { success: true, queued: true } as any;
  }

  logTelemetry({ level: 'error', name: 'api.call.fail', requestId, action, trackingID, message: lastError.message });
  throw lastError;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function createParcel(
  senderName: string,
  senderBranch: string,
  receiverName: string,
  receiverBranch: string,
  description?: string,
  note?: string,
  latitude?: number,
  longitude?: number,
  photoUrl?: string,
  pin?: string,
): Promise<CreateParcelResponse> {
  const payload: CreateParcelPayload = {
    action: 'createParcel',
    senderName, senderBranch, receiverName, receiverBranch, description, note, latitude, longitude, photoUrl, pin,
    clientId: getDeviceId(),
    idempotencyKey: createIdempotencyKey('createParcel'),
  };
  try {
    const res = await callAPI<Record<string, unknown>>(payload);
    return {
      success: Boolean(res.success),
      trackingID: (res.trackingID ?? res.trackingId) as string | undefined,
      queued: Boolean(res.queued),
      error: res.error as string | undefined,
    };
  } catch (err) {
    const message = getErrorMessage(err);
    return { success: false, error: message };
  }
}

export async function getParcels(status: string = 'ทั้งหมด', limit: number = 50, offset: number = 0): Promise<GetParcelsResponse> {
  const payload = { action: 'getParcels', status, limit, offset };
  try {
    const res = await callAPI<GetParcelsResponse>(payload);
    if (res.success && Array.isArray(res.parcels)) {
      // 1. Normalize backend status strings to new display values
      let parcels = normalizeParcels(res.parcels);
      // 2. Apply derived statuses (forward → in-transit) — backend doesn't know about this
      parcels = applyDerivedStatuses(parcels);
      // Cache the loaded parcels in the local cache store
      void cacheParcelsLocally(parcels).catch(err => console.error('Failed to cache parcels:', err));
      return { ...res, parcels };
    }
    return { success: false, parcels: [], error: res.error };
  } catch (err) {
    // If offline, attempt to load from local IndexedDB cache
    try {
      const cached = await getCachedParcelsLocally();
      let filtered = applyDerivedStatuses(normalizeParcels(cached));
      if (status !== 'ทั้งหมด') {
        filtered = filtered.filter(p => p.สถานะ === status);
      }
      const paginated = filtered.slice(offset, offset + limit);
      return {
        success: true,
        parcels: paginated,
        totalCount: filtered.length,
        hasMore: filtered.length > offset + limit,
      };
    } catch (cacheErr) {
      console.error('Failed to read cached parcels:', cacheErr);
    }
    const message = getErrorMessage(err);
    return { success: false, parcels: [], error: message };
  }
}

export async function getParcel(trackingID: string): Promise<GetParcelResponse> {
  const payload: GetParcelPayload = { action: 'getParcel', trackingID };
  try {
    const res = await callAPI<GetParcelResponse>(payload, { includeAuth: true, dispatchAuthError: true });
    if (res.success && res.parcel) {
      const parsed = applyDerivedStatus(normalizeParcelStatus(res.parcel));
      // Cache this parcel locally
      void cacheParcelsLocally([parsed]).catch(err => console.error('Failed to cache parcel:', err));
      return { success: true, parcel: parsed };
    }
    return { success: false, error: res.error };
  } catch (err) {
    // If offline, attempt to load this parcel from the local cache
    try {
      const cached = await getCachedParcelLocally(trackingID.toUpperCase());
      if (cached) {
        return { success: true, parcel: cached };
      }
    } catch (cacheErr) {
      console.error('Failed to read cached parcel:', cacheErr);
    }
    const message = getErrorMessage(err);
    return { success: false, error: message };
  }
}

export async function confirmReceipt(
  trackingID: string,
  photoUrl: string,
  note?: string,
  latitude?: number,
  longitude?: number,
  eventType?: 'FORWARD' | 'PROXY' | 'DELIVERED',
  location?: string,
  destLocation?: string,
  person?: string,
  deliveryMatchStatus?: DeliveryMatchStatus,
  deliveryMismatchReason?: string,
  pin?: string,
): Promise<ConfirmReceiptResponse> {
  const payload: ConfirmReceiptPayload = {
    action: 'confirmReceipt',
    trackingID,
    photoUrl,
    note,
    latitude,
    longitude,
    eventType,
    location,
    destLocation,
    person,
    deliveryMatchStatus,
    deliveryMismatchReason,
    pin,
    idempotencyKey: createIdempotencyKey('confirmReceipt'),
  };
  try {
    return await callAPI<ConfirmReceiptResponse>(payload);
  } catch (err) {
    const message = getErrorMessage(err);
    return { success: false, error: message };
  }
}

export async function startDelivery(
  trackingID: string,
  latitude?: number,
  longitude?: number,
): Promise<StartDeliveryResponse> {
  const payload: StartDeliveryPayload = {
    action: 'startDelivery',
    trackingID,
    latitude,
    longitude,
    idempotencyKey: createIdempotencyKey('startDelivery'),
  };
  try {
    return await callAPI<StartDeliveryResponse>(payload);
  } catch (err) {
    const message = getErrorMessage(err);
    return { success: false, error: message };
  }
}

export async function batchStartDelivery(
  trackingIDs: string[],
  latitude?: number,
  longitude?: number,
): Promise<BatchParcelActionResponse> {
  try {
    return await callAPI<BatchParcelActionResponse>({
      action: 'batchStartDelivery',
      trackingIDs,
      latitude,
      longitude,
      idempotencyKey: createIdempotencyKey('batchStartDelivery'),
    });
  } catch (err) {
    const message = getErrorMessage(err);
    return { success: false, error: message };
  }
}

export async function batchConfirmReceipt(
  trackingIDs: string[],
  photoUrl: string,
  note?: string,
  latitude?: number,
  longitude?: number,
): Promise<BatchParcelActionResponse> {
  try {
    return await callAPI<BatchParcelActionResponse>({
      action: 'batchConfirmReceipt',
      trackingIDs,
      photoUrl,
      note,
      latitude,
      longitude,
      idempotencyKey: createIdempotencyKey('batchConfirmReceipt'),
    });
  } catch (err) {
    const message = getErrorMessage(err);
    return { success: false, error: message };
  }
}

export async function releaseDelivery(trackingID: string): Promise<ReleaseDeliveryResponse> {
  const payload: ReleaseDeliveryPayload = {
    action: 'releaseDelivery',
    trackingID,
    idempotencyKey: createIdempotencyKey('releaseDelivery'),
  };
  try {
    return await callAPI<ReleaseDeliveryResponse>(payload);
  } catch (err) {
    const message = getErrorMessage(err);
    return { success: false, error: message };
  }
}

export async function searchParcels(query: string): Promise<Parcel[]> {
  // Limit query length to prevent abuse
  const trimmed = query.trim().slice(0, 100);
  if (!trimmed) return [];
  try {
    const res = await callAPI<{ success: boolean; parcels?: Parcel[] }>({
      action: 'searchParcels',
      query: trimmed,
    }, { includeAuth: true, dispatchAuthError: true });
    if (res.success && Array.isArray(res.parcels)) {
      return applyDerivedStatuses(normalizeParcels(res.parcels));
    }
    return [];
  } catch {
    return [];
  }
}

/** Fetches a raw summary from the backend (used as a fallback). */
export async function exportSummary(): Promise<ParcelSummary | null> {
  try {
    const res = await callAPI<ExportSummaryResponse>({ action: 'exportSummary' });
    return res.summary ?? null;
  } catch {
    return null;
  }
}

// --- Branches ---

export async function loadBranches(): Promise<string[]> {
  if (!GAS_URL) return BRANCHES;
  try {
    const res = await callAPI<{ success: boolean; branches?: string[]; error?: string }>({ action: 'getBranches' }, { includeAuth: true, dispatchAuthError: false });
    const nextBranches = normalizeBranchList(res.branches);
    if (res.success && nextBranches.length > 0) {
      setBranches(nextBranches);
      return nextBranches;
    }
  } catch {
    // Keep local/default branch list as a safe form fallback.
  }
  return BRANCHES;
}

export async function createBranch(name: string): Promise<{ success: boolean; branches?: string[]; error?: string }> {
  try {
    const res = await callAPI<{ success: boolean; branches?: string[]; error?: string }>({ action: 'createBranch', name }, {}, NO_RETRY);
    if (res.success && res.branches) setBranches(normalizeBranchList(res.branches));
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function deleteBranch(name: string): Promise<{ success: boolean; branches?: string[]; error?: string }> {
  try {
    const res = await callAPI<{ success: boolean; branches?: string[]; error?: string }>({ action: 'deleteBranch', name }, {}, NO_RETRY);
    if (res.success && res.branches) setBranches(normalizeBranchList(res.branches));
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function renameBranch(oldName: string, newName: string): Promise<{ success: boolean; branches?: string[]; error?: string }> {
  try {
    const res = await callAPI<{ success: boolean; branches?: string[]; error?: string }>({ action: 'renameBranch', oldName, newName }, {}, NO_RETRY);
    if (res.success && res.branches) setBranches(normalizeBranchList(res.branches));
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function getAuditLogs(input: LogQueryInput = {}): Promise<{ success: boolean; logs?: AuditLogRow[]; totalCount?: number; hasMore?: boolean; error?: string }> {
  try {
    return await callAPI<{ success: boolean; logs?: AuditLogRow[]; totalCount?: number; hasMore?: boolean; error?: string }>({
      action: 'getAuditLogs',
      limit: input.limit,
      offset: input.offset,
      query: input.query,
      actionFilter: input.action,
      actorId: input.actorId,
      targetId: input.targetId,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function getParcelActivityLogs(input: LogQueryInput = {}): Promise<{ success: boolean; activities?: ParcelActivityLogRow[]; totalCount?: number; hasMore?: boolean; error?: string }> {
  try {
    return await callAPI<{ success: boolean; activities?: ParcelActivityLogRow[]; totalCount?: number; hasMore?: boolean; error?: string }>({
      action: 'getParcelActivityLogs',
      limit: input.limit,
      offset: input.offset,
      query: input.query,
      eventType: input.eventType,
      trackingId: input.trackingId,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

// --- Users & RBAC ---

export async function login(employeeId: string, pin?: string): Promise<{ success: boolean, needsSetup?: boolean, user?: User, error?: string, role?: string, name?: string }> {
  try {
    const res = normalizeAuthResponse(await callAPI<{ success: boolean, needsSetup?: boolean, user?: User, error?: string, role?: string, name?: string }>({ action: 'login', employeeId, pin }, {}, NO_RETRY));

    // Backend responded — use as-is
    if (res.success || res.needsSetup) return res;

    // Real auth error from backend — respect it
    if (res.error && REAL_AUTH_ERRORS.some(e => res.error!.includes(e))) {
      return res;
    }

    return { success: false, error: res.error ?? 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' };
  } catch {
    return { success: false, error: 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง' };
  }
}

export async function setupPin(employeeId: string, pin: string, name: string): Promise<{ success: boolean, user?: User, error?: string }> {
  try {
    const res = normalizeAuthResponse(await callAPI<{ success: boolean, user?: User, error?: string }>({ action: 'setupPin', employeeId, pin, name }, {}, NO_RETRY));

    if (res.success) return res;

    // Duplicate
    if (res.error) {
      const isDuplicate = res.error.toLowerCase().includes('already') ||
        res.error.includes('ซ้ำ') || res.error.includes('มีอยู่แล้ว') || res.error.includes('duplicate');
      if (isDuplicate) {
        return { success: false, error: 'รหัสพนักงานนี้มีผู้ใช้งานแล้ว กรุณาใช้รหัสอื่น' };
      }
      return { success: false, error: res.error };
    }

    return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อระบบได้' };
  }
}

export async function getUsers(): Promise<{ success: boolean, users?: UserRow[], error?: string }> {
  try {
    const res = await callAPI<{ success: boolean, users?: UserRow[], error?: string }>({ action: 'getUsers' });
    if (res.success && Array.isArray(res.users)) {
      res.users = res.users.map(user => ({ ...user, role: normalizeRole(user.role) }));
    }
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function createUser(input: CreateUserInput): Promise<{ success: boolean, user?: UserRow, error?: string }> {
  try {
    const res = await callAPI<{ success: boolean, user?: UserRow, error?: string }>({
      action: 'createUser',
      targetId: input.employeeId,
      name: input.name,
      newRole: input.role,
      password: input.password,
    }, {}, NO_RETRY);
    if (res.success && res.user) {
      res.user = { ...res.user, role: normalizeRole(res.user.role) };
    }
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function updateUserRole(targetId: string, newRole: string): Promise<{ success: boolean, error?: string }> {
  try {
    return await callAPI({ action: 'updateUserRole', targetId, newRole }, {}, NO_RETRY);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function updateUser(input: UpdateUserInput): Promise<{ success: boolean, user?: UserRow, error?: string }> {
  try {
    const res = await callAPI<{ success: boolean, user?: UserRow, error?: string }>({
      action: 'updateUser',
      targetId: input.targetId,
      name: input.name,
      newRole: input.role,
      password: input.password,
    }, {}, NO_RETRY);
    if (res.success && res.user) {
      res.user = { ...res.user, role: normalizeRole(res.user.role) };
    }
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function disableUser(targetId: string): Promise<{ success: boolean, user?: UserRow, error?: string }> {
  try {
    const res = await callAPI<{ success: boolean, user?: UserRow, error?: string }>({ action: 'disableUser', targetId }, {}, NO_RETRY);
    if (res.success && res.user) {
      res.user = { ...res.user, role: normalizeRole(res.user.role) };
    }
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function deleteUser(targetId: string): Promise<{ success: boolean, error?: string }> {
  try {
    return await callAPI({ action: 'deleteUser', targetId }, {}, NO_RETRY);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function deleteParcel(trackingID: string): Promise<{ success: boolean, error?: string }> {
  try {
    return await callAPI({ action: 'deleteParcel', trackingID }, {}, NO_RETRY);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function editParcel(trackingID: string, updates: Partial<Record<string, string>>): Promise<{ success: boolean, error?: string }> {
  try {
    return await callAPI({ action: 'editParcel', trackingID, updates }, {}, NO_RETRY);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

export async function updateProfile(
  newName?: string,
  newPassword?: string,
  currentPassword?: string,
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const res = await callAPI<{ success: boolean; user?: User; error?: string }>({
      action: 'updateProfile',
      newName,
      newPassword,
      currentPassword,
    }, {}, NO_RETRY);
    if (res.success && res.user) {
      res.user = { ...res.user, role: normalizeRole(res.user.role) };
    }
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

type SyncRouteSamplesResponse = {
  success: boolean;
  savedCount?: number;
  skippedCount?: number;
  error?: string;
};

function dispatchRouteSyncStatus(detail: {
  status: 'start' | 'success' | 'error';
  trackingID?: string;
  savedCount?: number;
  skippedCount?: number;
  pendingCount?: number;
  error?: string;
}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ROUTE_SYNC_STATUS_EVENT, { detail }));
}

export async function syncRouteSamples(trackingID?: string): Promise<SyncRouteSamplesResponse> {
  if (isRouteSyncing) return { success: true, savedCount: 0, skippedCount: 0 };
  const samples = await getUnsyncedRouteSamples(trackingID);
  if (samples.length === 0) return { success: true, savedCount: 0, skippedCount: 0 };

  const groups = samples.reduce<Record<string, RouteSampleRecord[]>>((acc, sample) => {
    (acc[sample.trackingID] ||= []).push(sample);
    return acc;
  }, {});

  isRouteSyncing = true;
  let savedCount = 0;
  let skippedCount = 0;
  dispatchRouteSyncStatus({
    status: 'start',
    trackingID,
    pendingCount: samples.length,
  });
  try {
    for (const [groupTrackingID, groupSamples] of Object.entries(groups)) {
      const batch = groupSamples.slice(0, ROUTE_SYNC_BATCH_SIZE);
      const batchKey = batch.length <= 8
        ? batch.map(sample => sample.id).join(',')
        : `${batch.length}:${batch[0]?.id}:${batch[batch.length - 1]?.id}`;
      const res = await callAPI<SyncRouteSamplesResponse>({
        action: 'syncRouteSamples',
        trackingID: groupTrackingID,
        samples: batch,
        idempotencyKey: createIdempotencyKey(`syncRouteSamples:${groupTrackingID}:${batchKey}`),
      }, {}, NO_RETRY);

      if (!res.success) {
        const error = res.error || 'ซิงค์เส้นทางไม่สำเร็จ';
        dispatchRouteSyncStatus({ status: 'error', trackingID, savedCount, skippedCount, error });
        return { success: false, error, savedCount, skippedCount };
      }

      await markRouteSamplesSynced(batch.map(sample => sample.id));
      savedCount += res.savedCount ?? batch.length;
      skippedCount += res.skippedCount ?? 0;
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'ซิงค์เส้นทางไม่สำเร็จ';
    dispatchRouteSyncStatus({ status: 'error', trackingID, savedCount, skippedCount, error });
    return {
      success: false,
      error,
      savedCount,
      skippedCount,
    };
  } finally {
    isRouteSyncing = false;
  }

  dispatchRouteSyncStatus({ status: 'success', trackingID, savedCount, skippedCount });
  if (typeof window !== 'undefined' && (savedCount > 0 || skippedCount > 0)) {
    window.dispatchEvent(new Event('offline-sync-complete'));
    void purgeSyncedRouteSamples().catch(err => console.error('Failed to purge route samples:', err));
  }
  if (typeof window !== 'undefined' && (await getUnsyncedRouteSamples(trackingID)).length > 0) {
    window.setTimeout(() => {
      void syncRouteSamples(trackingID);
    }, 250);
  }
  return { success: true, savedCount, skippedCount };
}

async function runQueuedAction(item: OfflineQueueItem): Promise<any> {
  const payload = await resolveSyncPayload(item.payload);
  if (payload.action === 'createParcel') {
    return callAPI(payload, {}, NO_RETRY);
  }
  if (payload.action === 'confirmReceipt') {
    return callAPI(payload, {}, NO_RETRY);
  }
  if (payload.action === 'startDelivery') {
    return callAPI(payload, {}, NO_RETRY);
  }
  if (payload.action === 'batchStartDelivery') {
    return callAPI(payload, {}, NO_RETRY);
  }
  if (payload.action === 'batchConfirmReceipt') {
    return callAPI(payload, {}, NO_RETRY);
  }
  if (payload.action === 'releaseDelivery') {
    return callAPI(payload, {}, NO_RETRY);
  }
  return { success: false, error: 'ไม่รู้จักประเภทรายการออฟไลน์' };
}

export async function syncOfflineQueue(): Promise<SyncResult> {
  if (isSyncing) return { total: 0, synced: 0, failed: 0 };
  const queue = (await getOfflineQueue()).filter(
    item => item.status === 'pending' && isReadyForRetry(item.nextRetryAt),
  );
  if (queue.length === 0) return { total: 0, synced: 0, failed: 0 };

  isSyncing = true;
  toast.info(`กำลังซิงค์รายการออฟไลน์ ${queue.length} รายการ...`);

  let synced = 0;
  let failed = 0;
  try {
    for (const item of queue) {
      await updateOfflineAction({ ...item, status: 'syncing' });
      try {
        const res = await runQueuedAction(item);
        if (res?.success) {
          await removeOfflineAction(item.id);
          if (item.localMediaId) await deleteOfflineProofImage(item.localMediaId);
          synced++;
          continue;
        }

        const errorMsg = String(res?.error || 'ซิงค์รายการไม่สำเร็จ');
        const nextAttempt = item.attemptCount + 1;
        if (isNetworkErrorMessage(errorMsg)) {
          await updateOfflineAction({
            ...item,
            status: 'pending',
            attemptCount: nextAttempt,
            lastError: errorMsg,
            nextRetryAt: Date.now() + computeRetryDelayMs(nextAttempt),
          });
          toast.warning('การเชื่อมต่อขัดข้องชั่วคราว ระบบจะซิงค์ใหม่เมื่อสัญญาณเสถียร');
          break;
        }

        const exhausted = nextAttempt >= MAX_OFFLINE_ATTEMPTS || isAuthErrorMessage(errorMsg);
        await updateOfflineAction({
          ...item,
          status: exhausted ? 'failed' : 'pending',
          attemptCount: nextAttempt,
          lastError: errorMsg,
          nextRetryAt: exhausted ? undefined : Date.now() + computeRetryDelayMs(nextAttempt),
        });
        failed++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'ซิงค์รายการไม่สำเร็จ';
        const nextAttempt = item.attemptCount + 1;
        const network = isNetworkErrorMessage(errorMsg);
        const exhausted = !network && (nextAttempt >= MAX_OFFLINE_ATTEMPTS || isAuthErrorMessage(errorMsg));
        await updateOfflineAction({
          ...item,
          status: network || !exhausted ? 'pending' : 'failed',
          attemptCount: nextAttempt,
          lastError: errorMsg,
          nextRetryAt: network || !exhausted
            ? Date.now() + computeRetryDelayMs(nextAttempt)
            : undefined,
        });
        if (network) break;
        failed++;
      }
    }
  } finally {
    isSyncing = false;
  }

  if (synced > 0) {
    toast.success(`ซิงค์รายการออฟไลน์สำเร็จ ${synced} รายการ`);
    window.dispatchEvent(new Event('offline-sync-complete'));
  }
  if (failed > 0) {
    toast.error(`มีรายการออฟไลน์ ${failed} รายการที่ต้องตรวจสอบ`);
  }
  return { total: queue.length, synced, failed };
}

if (typeof window !== 'undefined') {
  registerSyncRunner(async () => {
    await syncOfflineQueue();
    const activeRouteCount = getActiveRouteIds().length;
    const pendingCount = (await getUnsyncedRouteSamples()).length;
    if (activeRouteCount > 0 || pendingCount > 0) {
      await syncRouteSamples();
    }
  });
  initSyncManager();
}
