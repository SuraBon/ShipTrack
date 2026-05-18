import type { Parcel, ParcelEventRecord } from '@/types/parcel';

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

function closesAssignment(event: ParcelEventRecord): boolean {
  return (
    event.eventType === 'RELEASE_DELIVERY' ||
    event.eventType === 'DELIVERED' ||
    event.eventType === 'PROXY'
  );
}
