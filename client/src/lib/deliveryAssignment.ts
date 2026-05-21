import type { Parcel, ParcelEventRecord } from '@/types/parcel';
import { normalizeRole, type AppRole } from './roles';

export interface DeliveryAssignment {
  assignedToId: string;
  assignedToName: string;
  timestamp: string;
}

const ASSIGNMENT_NOTE_PREFIX = 'assignedToId=';

export function buildAssignmentNote(employeeId: string): string {
  return `${ASSIGNMENT_NOTE_PREFIX}${employeeId}`;
}

export function parseAssignedToId(note?: string): string {
  const value = String(note || '').trim();
  if (!value.startsWith(ASSIGNMENT_NOTE_PREFIX)) return '';
  return value.slice(ASSIGNMENT_NOTE_PREFIX.length).trim();
}

export function getActiveDeliveryAssignment(parcel: Parcel): DeliveryAssignment | null {
  let active: DeliveryAssignment | null = null;

  for (const event of parcel.events || []) {
    if (event.eventType === 'START_DELIVERY') {
      const assignedToId = parseAssignedToId(event.note);
      if (!assignedToId) continue;
      active = {
        assignedToId,
        assignedToName: event.person || assignedToId || 'Messenger',
        timestamp: event.timestamp,
      };
      continue;
    }

    if (closesAssignment(event)) {
      active = null;
    }
  }

  return active;
}

export function isAssignedToCurrentUser(parcel: Parcel, employeeId?: string): boolean {
  const currentId = normalizeEmployeeId(employeeId);
  if (!currentId) return false;
  const assignment = getActiveDeliveryAssignment(parcel);
  return assignment?.assignedToId === currentId;
}

export function isAvailableForMessenger(parcel: Parcel): boolean {
  return parcel['สถานะ'] === 'รอจัดส่ง' && !getActiveDeliveryAssignment(parcel);
}

export function canReleaseMessengerJob(parcel: Parcel, employeeId?: string, role?: AppRole | string): boolean {
  if (parcel['สถานะ'] === 'ส่งสำเร็จ') return false;
  const assignment = getActiveDeliveryAssignment(parcel);
  if (!assignment) return false;
  if (normalizeRole(role) === 'ADMIN') return true;
  return assignment.assignedToId === normalizeEmployeeId(employeeId);
}

export function canConfirmMessengerJob(parcel: Parcel, employeeId?: string): boolean {
  if (parcel['สถานะ'] === 'ส่งสำเร็จ') return false;
  return isAssignedToCurrentUser(parcel, employeeId);
}

function closesAssignment(event: ParcelEventRecord): boolean {
  return (
    event.eventType === 'RELEASE_DELIVERY' ||
    event.eventType === 'DELIVERED' ||
    event.eventType === 'PROXY'
  );
}

function normalizeEmployeeId(employeeId?: string): string {
  return String(employeeId || '').trim().toUpperCase();
}
