import type { AppRole } from '../roles';

export interface User {
  employeeId: string;
  name: string;
  role: AppRole;
  token?: string;
  issuedAt?: number;
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
  role: 'ADMIN' | 'MESSENGER';
  password: string;
}

export interface UpdateUserInput {
  targetId: string;
  name: string;
  role: 'ADMIN' | 'MESSENGER';
  password?: string;
}

export interface BranchRow {
  name: string;
  createdAt?: string;
  createdBy?: string;
}

export interface AuditLogRow {
  timestamp: string;
  actorId: string;
  action: string;
  targetId: string;
  details: string;
}

export interface ParcelActivityLogRow {
  id: string;
  trackingId: string;
  timestamp: string;
  eventType: string;
  location: string;
  destLocation?: string;
  person?: string;
  note?: string;
  latitude?: number;
  longitude?: number;
  deliveryMatchStatus?: string;
  deliveryMismatchReason?: string;
}

export interface LogQueryInput {
  limit?: number;
  offset?: number;
  query?: string;
  action?: string;
  actorId?: string;
  targetId?: string;
  eventType?: string;
  trackingId?: string;
}

export interface SystemHealthCheck {
  name: string;
  ok: boolean;
  message: string;
  elapsedMs: number;
}

export interface SystemHealth {
  status: 'ok' | 'degraded';
  checkedAt: string;
  elapsedMs: number;
  checks: SystemHealthCheck[];
  metrics: {
    userCount: number;
    activeUserCount: number;
    parcelSheetCount: number;
    parcelRowCount: number;
    eventRowCount: number;
    routeSampleRowCount: number;
  };
}
