import { describe, expect, it } from 'vitest';
import { canAccessPage, getDefaultPageForRole, getVisiblePage } from './permissionHelper';

describe('permissionHelper', () => {
  it('allows guests only on public pages', () => {
    expect(canAccessPage('create', 'GUEST')).toBe(true);
    expect(canAccessPage('track', 'GUEST')).toBe(true);
    expect(canAccessPage('dashboard', 'GUEST')).toBe(false);
    expect(canAccessPage('users', 'GUEST')).toBe(false);
  });

  it('normalizes legacy user roles to guest routing', () => {
    expect(getDefaultPageForRole('USER')).toBe('create');
    expect(getVisiblePage('dashboard', 'USER')).toBe('create');
  });

  it('keeps staff on staff routes', () => {
    expect(canAccessPage('dashboard', 'MESSENGER')).toBe(true);
    expect(canAccessPage('create', 'MESSENGER')).toBe(false);
    expect(canAccessPage('track', 'MESSENGER')).toBe(false);
    expect(canAccessPage('create', 'ADMIN')).toBe(false);
    expect(canAccessPage('track', 'ADMIN')).toBe(false);
    expect(canAccessPage('users', 'ADMIN')).toBe(true);
    expect(getVisiblePage('users', 'MESSENGER')).toBe('dashboard');
    expect(getVisiblePage('create', 'ADMIN')).toBe('dashboard');
  });
});
