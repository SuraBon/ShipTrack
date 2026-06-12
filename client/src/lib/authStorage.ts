import type { User } from './parcel-service/types';

export const AUTH_SESSION_KEY = 'shiptrack_user';
export const AUTH_LAST_ACTIVITY_KEY = 'shiptrack_last_activity_at';

type AuthPersistence = 'session' | 'local';

type StoredAuthUser = {
  value?: User;
  lastActivityAt?: number;
};

function getStorage(persistence: AuthPersistence): Storage | null {
  try {
    return persistence === 'local' 
      ? (typeof localStorage !== 'undefined' ? localStorage : null)
      : (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  } catch {
    return null;
  }
}

function safeParseUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    if ('value' in parsed) {
      const wrapped = parsed as StoredAuthUser;
      const userObj = wrapped.value;
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

function readWrappedLastActivity(raw: string | null): number | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const value = Number(parsed?.lastActivityAt);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

// Determines which storage strategy is active (local takes precedence if it exists)
function getActivePersistence(): AuthPersistence {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(AUTH_SESSION_KEY)) {
      return 'local';
    }
  } catch {}
  return 'session';
}

function writeStoredAuthUser(
  user: User,
  lastActivityAt = Date.now(),
  persistence: AuthPersistence = 'session',
): AuthPersistence | null {
  const wrappedUser = JSON.stringify({
    value: user,
    lastActivityAt,
  });

  const storage = getStorage(persistence);
  const otherStorage = getStorage(persistence === 'local' ? 'session' : 'local');

  if (storage) {
    try {
      storage.setItem(AUTH_SESSION_KEY, wrappedUser);
      storage.setItem(AUTH_LAST_ACTIVITY_KEY, String(lastActivityAt));
      
      // Clean up the other storage to avoid conflict
      if (otherStorage) {
        otherStorage.removeItem(AUTH_SESSION_KEY);
        otherStorage.removeItem(AUTH_LAST_ACTIVITY_KEY);
      }
      return persistence;
    } catch {
      // If localStorage is full, fallback to sessionStorage
      if (persistence === 'local' && otherStorage) {
        try {
          otherStorage.setItem(AUTH_SESSION_KEY, wrappedUser);
          otherStorage.setItem(AUTH_LAST_ACTIVITY_KEY, String(lastActivityAt));
          return 'session';
        } catch {
          return null;
        }
      }
      return null;
    }
  }
  return null;
}

export function writeAuthUser(user: User, options: { remember?: boolean } = {}): void {
  writeStoredAuthUser(user, Date.now(), options.remember ? 'local' : 'session');
}

export function readAuthUser(): User | null {
  const persistence = getActivePersistence();
  const storage = getStorage(persistence);
  const sessionUser = safeParseUser(storage?.getItem(AUTH_SESSION_KEY) ?? null);
  
  if (sessionUser) return sessionUser;

  clearAuthUser();
  return null;
}

export function readAuthLastActivityAt(user?: User | null): number | null {
  const persistence = getActivePersistence();
  const storage = getStorage(persistence);
  
  const wrappedActivity = readWrappedLastActivity(storage?.getItem(AUTH_SESSION_KEY) ?? null);
  if (wrappedActivity) return wrappedActivity;
  
  const storedActivity = Number(storage?.getItem(AUTH_LAST_ACTIVITY_KEY) ?? '');
  if (Number.isFinite(storedActivity) && storedActivity > 0) return storedActivity;
  
  return typeof user?.issuedAt === 'number' ? user.issuedAt : null;
}

export function touchAuthActivity(user?: User | null): number | null {
  const activeUser = user ?? readAuthUser();
  if (!activeUser) return null;
  const now = Date.now();
  const persistence = getActivePersistence();
  return writeStoredAuthUser(activeUser, now, persistence) ? now : null;
}

export function clearAuthUser(): void {
  const local = getStorage('local');
  const session = getStorage('session');
  
  local?.removeItem(AUTH_SESSION_KEY);
  local?.removeItem(AUTH_LAST_ACTIVITY_KEY);
  session?.removeItem(AUTH_SESSION_KEY);
  session?.removeItem(AUTH_LAST_ACTIVITY_KEY);
}

export function readAuthPayload(): { employeeId?: string; role?: string; token?: string } {
  const user = readAuthUser();
  if (!user) return {};
  touchAuthActivity(user);
  return {
    employeeId: user.employeeId,
    role: user.role,
    token: user.token,
  };
}
