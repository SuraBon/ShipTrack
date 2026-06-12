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

export const BRANCH_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  'MS': { latitude: 13.7203, longitude: 100.5847 },
  'พระประแดง': { latitude: 13.6585, longitude: 100.5330 },
  'บางนา': { latitude: 13.6678, longitude: 100.6224 },
  'มีนบุรี': { latitude: 13.8138, longitude: 100.7314 },
  'เลียบด่วน': { latitude: 13.8016, longitude: 100.6125 },
  'เดอะมอลล์บางกะปิ': { latitude: 13.7663, longitude: 100.6433 },
  'วิภาวดี': { latitude: 13.8202, longitude: 100.5630 },
  'พิบูลสงคราม': { latitude: 13.8208, longitude: 100.5055 },
  'เซ็นทรัล พระราม 2': { latitude: 13.6636, longitude: 100.4390 },
  'เดอะมอลล์บางแค': { latitude: 13.7132, longitude: 100.4072 },
  'มหาชัย': { latitude: 13.5475, longitude: 100.2744 },
  'ศาลายา': { latitude: 13.7942, longitude: 100.3248 },
  'กาญจนา': { latitude: 13.8745, longitude: 100.4111 },
};

export function getFallbackCoordinates(branchName: string): { latitude: number; longitude: number } | null {
  if (!branchName) return null;
  const name = branchName.trim();
  if (BRANCH_COORDINATES[name]) {
    return BRANCH_COORDINATES[name];
  }
  const foundKey = Object.keys(BRANCH_COORDINATES).find(
    k => k.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(k.toLowerCase())
  );
  if (foundKey) {
    return BRANCH_COORDINATES[foundKey];
  }
  return null;
}

export function isInvalidCoordinates(latitude?: number | null, longitude?: number | null): boolean {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return true;
  if (latitude === 0 && longitude === 0) return true;
  if (latitude < 5 || latitude > 21 || longitude < 97 || longitude > 106) return true;
  return false;
}

