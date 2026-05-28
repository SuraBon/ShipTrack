export type SystemRole = 'MESSENGER' | 'ADMIN';
export type AppRole = SystemRole | 'GUEST';

export const SYSTEM_ROLES: SystemRole[] = ['MESSENGER', 'ADMIN'];

export const ROLE_LABELS: Record<AppRole, string> = {
  MESSENGER: 'พนักงานส่ง',
  ADMIN: 'ผู้ดูแลระบบ',
  GUEST: 'ไม่มีสิทธิ์',
};

export function normalizeRole(role: unknown): AppRole {
  const normalized = String(role || '').trim().toUpperCase();

  if (normalized === 'ADMIN') return 'ADMIN';
  if (normalized === 'MESSENGER' || normalized === 'MANAGER') return 'MESSENGER';
  return 'GUEST';
}
