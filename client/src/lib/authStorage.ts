import type { User } from './parcel-service/types';

export const AUTH_SESSION_KEY = 'shiptrack_user';

function safeParseUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as User;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.employeeId || !parsed.role) return null;
    return parsed;
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
    session?.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
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
