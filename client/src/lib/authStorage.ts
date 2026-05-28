import type { User } from './parcel-service/types';

export const AUTH_SESSION_KEY = 'shiptrack_user';
const INTEGRITY_SALT = 'shiptrack_secure_salt_98765';

function calculateChecksum(payload: string): string {
  let hash = 0;
  const combined = payload + '_' + INTEGRITY_SALT;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  return btoa(hash.toString());
}

function safeParseUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    if ('value' in parsed && 'checksum' in parsed) {
      const userObj = parsed.value;
      const checksum = parsed.checksum;
      const expectedChecksum = calculateChecksum(JSON.stringify(userObj));
      if (checksum !== expectedChecksum) {
        console.warn('Auth token integrity check failed! Session tampered.');
        clearAuthUser();
        return null;
      }
      if (!userObj || typeof userObj !== 'object') return null;
      if (!userObj.employeeId || !userObj.role) return null;
      return userObj as User;
    }

    if (!parsed.employeeId || !parsed.role) return null;
    return parsed as User;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function getLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function readAuthUser(): User | null {
  const session = getSessionStorage();
  const local = getLocalStorage();
  const sessionUser = safeParseUser(session?.getItem(AUTH_SESSION_KEY) ?? null);
  if (sessionUser) return sessionUser;

  const legacyUser = safeParseUser(local?.getItem(AUTH_SESSION_KEY) ?? null);
  if (legacyUser) {
    try {
      session?.setItem(AUTH_SESSION_KEY, JSON.stringify(legacyUser));
      local?.removeItem(AUTH_SESSION_KEY);
    } catch {
      // If session storage is unavailable, avoid keeping the legacy token permanently.
      local?.removeItem(AUTH_SESSION_KEY);
    }
    return legacyUser;
  }

  local?.removeItem(AUTH_SESSION_KEY);
  return null;
}

export function writeAuthUser(user: User): void {
  const session = getSessionStorage();
  const local = getLocalStorage();
  try {
    const serializedUser = JSON.stringify(user);
    const checksum = calculateChecksum(serializedUser);
    const wrapped = {
      value: user,
      checksum: checksum
    };
    session?.setItem(AUTH_SESSION_KEY, JSON.stringify(wrapped));
  } catch {
    // Session storage can fail in restricted/private contexts.
  }
  local?.removeItem(AUTH_SESSION_KEY);
}

export function clearAuthUser(): void {
  getSessionStorage()?.removeItem(AUTH_SESSION_KEY);
  getLocalStorage()?.removeItem(AUTH_SESSION_KEY);
}

export function readAuthPayload(): { employeeId?: string; role?: string; token?: string } {
  const user = readAuthUser();
  if (!user) return {};
  return {
    employeeId: user.employeeId,
    role: user.role,
    token: user.token,
  };
}
