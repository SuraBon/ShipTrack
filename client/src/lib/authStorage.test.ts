// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from './parcel-service/types';
import { AUTH_SESSION_KEY, clearAuthUser, readAuthUser, writeAuthUser } from './authStorage';

const testUser: User = {
  employeeId: 'EMP001',
  name: 'Test User',
  role: 'ADMIN',
  token: 'EMP001:token:1:session',
  issuedAt: 1,
};

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAuthUser();
  });

  it('keeps auth in session storage by default', () => {
    writeAuthUser(testUser);

    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeTruthy();
    expect(localStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(readAuthUser()).toMatchObject({ employeeId: 'EMP001', role: 'ADMIN' });
  });

  it('keeps auth in session storage when remembered local storage rejects writes', () => {
    const originalSetItem = Storage.prototype.setItem;
    const localSetItem = vi.spyOn(Storage.prototype, 'setItem');
    localSetItem.mockImplementation(function setItem(key: string, value: string) {
      if (this === localStorage) throw new Error('quota exceeded');
      return originalSetItem.call(this, key, value);
    });

    writeAuthUser(testUser, { remember: true });

    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeTruthy();
    expect(readAuthUser()).toMatchObject({ employeeId: 'EMP001', role: 'ADMIN' });
  });

  it('stores auth in local storage only when remember is selected', () => {
    writeAuthUser(testUser, { remember: true });

    expect(localStorage.getItem(AUTH_SESSION_KEY)).toBeTruthy();
    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(readAuthUser()).toMatchObject({ employeeId: 'EMP001', role: 'ADMIN' });
  });

  it('reads remembered local auth without migrating it to session storage', () => {
    writeAuthUser(testUser, { remember: true });
    const sessionAuth = localStorage.getItem(AUTH_SESSION_KEY);
    expect(sessionAuth).toBeTruthy();

    sessionStorage.clear();

    expect(readAuthUser()).toMatchObject({ employeeId: 'EMP001', role: 'ADMIN' });
    expect(localStorage.getItem(AUTH_SESSION_KEY)).toBeTruthy();
    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
  });
});
