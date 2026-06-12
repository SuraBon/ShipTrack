import type { GeoPosition, GeoStatus } from '@/hooks/useGeolocation';

export type GpsQuality = 'ready' | 'loading' | 'unavailable' | 'low_accuracy';

export function getGpsQuality(status: GeoStatus, position: GeoPosition | null): GpsQuality {
  if (status === 'loading' || status === 'idle') return 'loading';
  if (status === 'success' && position) return position.accuracy > 100 ? 'low_accuracy' : 'ready';
  return 'unavailable';
}

export function needsGpsOverrideReason(status: GeoStatus): boolean {
  return status === 'denied' || status === 'error';
}

export function buildGpsEvidenceNote(params: {
  status: GeoStatus;
  position: GeoPosition | null;
  overrideReason?: string;
}): string[] {
  const notes: string[] = [];
  const reason = String(params.overrideReason || '').trim();
  if (needsGpsOverrideReason(params.status) && reason) {
    notes.push(`[GPS ไม่พร้อม: ${reason}]`);
  }
  if (params.status === 'success' && params.position && params.position.accuracy > 100) {
    notes.push(`[GPS แม่นยำต่ำ: ~${Math.round(params.position.accuracy)}m]`);
  }
  return notes;
}

export function isInvalidCoordinates(latitude?: number | null, longitude?: number | null): boolean {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return true;
  if (latitude === 0 && longitude === 0) return true;
  if (latitude < 5 || latitude > 21 || longitude < 97 || longitude > 106) return true;
  return false;
}

