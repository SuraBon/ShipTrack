import { normalizeRole, type AppRole } from './roles';

export type PageId = 'dashboard' | 'create' | 'track' | 'users' | 'login';

const PAGE_ROLES: Record<PageId, AppRole[]> = {
  dashboard: ['ADMIN', 'MESSENGER'],
  create: ['GUEST'],
  track: ['GUEST'],
  users: ['ADMIN'],
  login: ['GUEST'],
};

export function canAccessPage(page: PageId, role: unknown): boolean {
  return PAGE_ROLES[page].includes(normalizeRole(role));
}

export function getDefaultPageForRole(role: unknown): PageId {
  return normalizeRole(role) === 'GUEST' ? 'create' : 'dashboard';
}

export function getVisiblePage(page: PageId, role: unknown): PageId {
  return canAccessPage(page, role) ? page : getDefaultPageForRole(role);
}
