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
  ExportSummaryResponse,
  ParcelSummary,
  Parcel,
} from '@/types/parcel';
import { applyDerivedStatus, applyDerivedStatuses } from './parcelStatus';
import { normalizeRole, type AppRole } from './roles';
import { getDeviceId } from './createdParcelHistory';
import { getErrorMessage, getServerErrorMessage, isAuthErrorMessage } from './apiErrorHelper';
import { createIdempotencyKey } from './idempotency';

// ── Status normalizer ────────────────────────────────────────────────────────
// Backend still stores old Thai status strings. Map them to the new display values.
const STATUS_MAP: Record<string, string> = {
  'ส่งถึงแล้ว': 'ส่งสำเร็จ',
};

function normalizeParcelStatus(parcel: Parcel): Parcel {
  const raw = parcel['สถานะ'] as string;
  const mapped = STATUS_MAP[raw];
  return mapped ? { ...parcel, 'สถานะ': mapped as Parcel['สถานะ'] } : parcel;
}

function normalizeParcels(parcels: Parcel[]): Parcel[] {
  return parcels.map(normalizeParcelStatus);
}

const GAS_URL     = import.meta.env.VITE_GAS_URL     as string | undefined ?? '';
const GAS_API_KEY = import.meta.env.VITE_GAS_API_KEY as string | undefined ?? '';
const API_TIMEOUT_MS = 25_000;

// ── Branch list ──────────────────────────────────────────────────────────────

const DEFAULT_BRANCHES = [
  'MS', 'พระประแดง', 'บางนา', 'มีนบุรี', 'เลียบด่วน',
  'เดอะมอลล์บางกะปิ', 'วิภาวดี', 'พิบูลสงคราม','เซ็นทรัล พระราม 2',
  'เดอะมอลล์บางแค', 'มหาชัย', 'ศาลายา', 'กาญจนา',
  
];

/** Branches that have known coordinates in TrackingMap. @deprecated ใช้ GPS จริงจาก events แทน */
export const BRANCHES_WITH_COORDS: string[] = [];

const storedBranches = (() => {
  try {
    return JSON.parse(localStorage.getItem('branches') ?? 'null') as string[] | null;
  } catch {
    return null;
  }
})();

let BRANCHES: string[] = storedBranches ?? DEFAULT_BRANCHES;

const CONFIG_UPDATED_EVENT = 'parcel-config-updated';

export function getBranches(): string[] {
  return BRANCHES;
}

export function setBranches(branches: string[]): void {
  BRANCHES = branches;
  localStorage.setItem('branches', JSON.stringify(branches));
  window.dispatchEvent(new Event(CONFIG_UPDATED_EVENT));
}

function normalizeBranchList(branches: unknown): string[] {
  if (!Array.isArray(branches)) return [];
  const seen = new Set<string>();
  return branches
    .map(branch => String(branch || '').trim())
    .filter(branch => {
      if (!branch || seen.has(branch)) return false;
      seen.add(branch);
      return true;
    });
}

export function isConfigured(): boolean {
  return !!GAS_URL && BRANCHES.length > 0;
}

export function getGasUrl(): string {
  return GAS_URL;
}

export function onConfigUpdated(listener: () => void): () => void {
  window.addEventListener(CONFIG_UPDATED_EVENT, listener);
  return () => window.removeEventListener(CONFIG_UPDATED_EVENT, listener);
}

// ── Internal API helper ──────────────────────────────────────────────────────

type CallApiOptions = {
  includeAuth?: boolean;
  dispatchAuthError?: boolean;
};

const NO_RETRY = 0;

async function callAPI<T>(
  payload: object,
  { includeAuth = true, dispatchAuthError = true }: CallApiOptions = {},
  retries = 2,
): Promise<T> {
  if (!GAS_URL) {
    throw new Error('กรุณาตั้งค่า Google Apps Script URL ก่อน');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาตรวจสอบสัญญาณแล้วลองใหม่');
  }

  let lastError: Error = new Error('เกิดข้อผิดพลาด');

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Exponential backoff: 0ms, 1000ms, 2000ms
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }

    let response: Response;
    try {
      let authData = {};
      const storedUser = includeAuth ? localStorage.getItem('doc_track_user') : null;
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
          body: JSON.stringify({ ...authData, ...payload, apiKey: GAS_API_KEY }),
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
        : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
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
        lastError = new Error('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง');
        // Server error — retry
        continue;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let data: Record<string, unknown>;
    try {
      data = await response.json() as Record<string, unknown>;
    } catch {
      lastError = new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      continue;
    }
    if (dispatchAuthError && data && data['success'] === false) {
      const storedUser = includeAuth ? localStorage.getItem('doc_track_user') : null;
      if (storedUser && isAuthErrorMessage(data['error'])) {
        window.dispatchEvent(new Event('auth_error'));
      }
      data['error'] = getServerErrorMessage(data['error']);
    }
    return data as T;
  }

  throw lastError;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function createParcel(
  senderName: string,
  senderBranch: string,
  receiverName: string,
  receiverBranch: string,
  docType: string,
  description?: string,
  note?: string,
  latitude?: number,
  longitude?: number,
  photoUrl?: string,
  pin?: string,
): Promise<CreateParcelResponse> {
  const payload: CreateParcelPayload = {
    action: 'createParcel',
    senderName, senderBranch, receiverName, receiverBranch, docType, description, note, latitude, longitude, photoUrl, pin,
    clientId: getDeviceId(),
    idempotencyKey: createIdempotencyKey('createParcel'),
  };
  try {
    const res = await callAPI<Record<string, unknown>>(payload, {}, NO_RETRY);
    return {
      success: Boolean(res.success),
      trackingID: (res.trackingID ?? res.trackingId) as string | undefined,
      error: res.error as string | undefined,
    };
  } catch (err) {
    const message = getErrorMessage(err);
    return { success: false, error: message };
  }
}

export async function getParcels(status: string = 'ทั้งหมด', limit: number = 50, offset: number = 0): Promise<GetParcelsResponse> {
  // Map frontend display status back to backend storage values for filtering
  const REVERSE_STATUS_MAP: Record<string, string> = {
    'ส่งสำเร็จ': 'ส่งถึงแล้ว',
  };
  const backendStatus = REVERSE_STATUS_MAP[status] ?? status;
  const payload = { action: 'getParcels', status: backendStatus, limit, offset };
  try {
    const res = await callAPI<GetParcelsResponse>(payload);
    if (res.success && Array.isArray(res.parcels)) {
      // 1. Normalize backend status strings to new display values
      let parcels = normalizeParcels(res.parcels);
      // 2. Apply derived statuses (forward → in-transit) — backend doesn't know about this
      parcels = applyDerivedStatuses(parcels);
      return { ...res, parcels };
    }
    return { success: false, parcels: [], error: res.error };
  } catch (err) {
    const message = getErrorMessage(err);
    return { success: false, parcels: [], error: message };
  }
}

export async function getParcel(trackingID: string): Promise<GetParcelResponse> {
  const payload: GetParcelPayload = { action: 'getParcel', trackingID };
  try {
    const res = await callAPI<GetParcelResponse>(payload, { includeAuth: true, dispatchAuthError: true });
    if (res.success && res.parcel) {
      return { success: true, parcel: applyDerivedStatus(normalizeParcelStatus(res.parcel)) };
    }
    return { success: false, error: res.error };
  } catch (err) {
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
    return await callAPI<ConfirmReceiptResponse>(payload, {}, NO_RETRY);
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
    return await callAPI<StartDeliveryResponse>(payload, {}, NO_RETRY);
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
    return await callAPI<ReleaseDeliveryResponse>(payload, {}, NO_RETRY);
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

// --- Users & RBAC ---

export interface User {
  employeeId: string;
  name: string;
  branch: string;
  role: AppRole;
  token?: string;
}

export interface UserRow extends User {
  hasPin: boolean;
  createdAt: string;
  status?: 'ACTIVE' | 'DISABLED';
  updatedAt?: string;
}

export interface CreateUserInput {
  employeeId: string;
  name: string;
  branch: string;
  role: 'ADMIN' | 'MESSENGER';
  password: string;
}

export interface UpdateUserInput {
  targetId: string;
  name: string;
  branch: string;
  role: 'ADMIN' | 'MESSENGER';
  password?: string;
}

export interface BranchRow {
  name: string;
  createdAt?: string;
  createdBy?: string;
}

function normalizeUser(user: User): User {
  return { ...user, role: normalizeRole(user.role) };
}

function normalizeAuthResponse<T extends { user?: User; role?: string }>(res: T): T {
  if (res.user) res.user = normalizeUser(res.user);
  if (res.role) res.role = normalizeRole(res.role);
  return res;
}

// Errors from the backend that mean "this user/password is genuinely wrong"
// — includes brute force lockout messages
const REAL_AUTH_ERRORS = [
  'รหัสผ่านไม่ถูกต้อง',
  'PIN ไม่ถูกต้อง',
  'ไม่พบผู้ใช้งาน',
  'ไม่พบรหัสพนักงาน',   // not registered
  'Invalid credentials',
  'Wrong password',
  'User not found',
  'บัญชีถูกล็อคชั่วคราว',
  'เหลือ',
];

export async function login(employeeId: string, pin?: string): Promise<{ success: boolean, needsSetup?: boolean, user?: User, error?: string, role?: string, name?: string, branch?: string }> {
  try {
    const res = normalizeAuthResponse(await callAPI<{ success: boolean, needsSetup?: boolean, user?: User, error?: string, role?: string, name?: string, branch?: string }>({ action: 'login', employeeId, pin }, {}, NO_RETRY));

    // Backend responded — use as-is
    if (res.success || res.needsSetup) return res;

    // Real auth error from backend — respect it
    if (res.error && REAL_AUTH_ERRORS.some(e => res.error!.includes(e))) {
      return res;
    }

    return { success: false, error: res.error ?? 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' };
  } catch {
    return { success: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง' };
  }
}

export async function setupPin(employeeId: string, pin: string, name: string, branch: string): Promise<{ success: boolean, user?: User, error?: string }> {
  try {
    const res = normalizeAuthResponse(await callAPI<{ success: boolean, user?: User, error?: string }>({ action: 'setupPin', employeeId, pin, name, branch }, {}, NO_RETRY));

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
    return { success: false, error: err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' };
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
      branch: input.branch,
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
      branch: input.branch,
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
  newBranch?: string,
  newPassword?: string,
  currentPassword?: string,
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const res = await callAPI<{ success: boolean; user?: User; error?: string }>({
      action: 'updateProfile',
      newName,
      newBranch,
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
