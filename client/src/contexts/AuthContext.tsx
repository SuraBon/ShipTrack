import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, login, setupPin, updateProfile } from '@/lib/parcelService';
import { normalizeRole } from '@/lib/roles';
import { toast } from 'sonner';
import { clearAuthUser, readAuthLastActivityAt, readAuthUser, touchAuthActivity, writeAuthUser } from '@/lib/authStorage';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginUser: (employeeId: string, pin?: string, options?: { remember?: boolean }) => Promise<{ success: boolean, needsSetup?: boolean, error?: string, role?: string, name?: string }>;
  setupUserPin: (employeeId: string, pin: string, name: string, options?: { remember?: boolean }) => Promise<{ success: boolean, error?: string }>;
  updateUserProfile: (newName?: string, newPassword?: string, currentPassword?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function getUserIssuedAt(user?: User | null): number | null {
  if (!user) return null;
  if (typeof user.issuedAt === 'number') return user.issuedAt;

  // Legacy fallback: parse token if issuedAt is missing
  const token = user.token;
  if (!token) return null;
  const parts = token.split('|');
  if (parts.length !== 5) return null;
  const issuedAt = Number(parts[2]);
  return Number.isFinite(issuedAt) ? issuedAt : null;
}

function getUserLastActivityAt(user?: User | null): number | null {
  return readAuthLastActivityAt(user) ?? getUserIssuedAt(user);
}

function isSessionExpired(user?: User | null): boolean {
  const lastActivityAt = getUserLastActivityAt(user);
  if (!lastActivityAt) return true;
  return Date.now() - lastActivityAt > SESSION_MAX_AGE_MS;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);
  const authTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityWriteRef = useRef(0);

  const clearSession = () => {
    if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
    setUser(null);
    setLastActivityAt(null);
    clearAuthUser();
  };

  const completeLoginAfterFeedback = (authenticatedUser: User, options: { remember?: boolean } = {}) => {
    if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
    writeAuthUser(authenticatedUser, options);
    authTransitionTimer.current = setTimeout(() => {
      setUser(authenticatedUser);
      setLastActivityAt(readAuthLastActivityAt(authenticatedUser));
      authTransitionTimer.current = null;
    }, 900);
  };

  useEffect(() => {
    const savedUser = readAuthUser();
    if (savedUser) {
      try {
        const normalizedUser = { ...savedUser, role: normalizeRole(savedUser.role) };
        if (normalizedUser.role === 'GUEST' || !normalizedUser.token || isSessionExpired(normalizedUser)) {
          clearSession();
        } else {
          setUser(normalizedUser);
          setLastActivityAt(touchAuthActivity(normalizedUser));
        }
      } catch {
        clearAuthUser();
      }
    }
    setLoading(false);

    const handleAuthError = () => {
      clearSession();
      toast.error('บัญชีนี้ถูกเข้าใช้งานจากอุปกรณ์อื่น กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    };

    window.addEventListener('auth_error', handleAuthError);

    return () => {
      window.removeEventListener('auth_error', handleAuthError);
      if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const expiresFrom = lastActivityAt ?? getUserLastActivityAt(user);
    if (!expiresFrom) {
      clearSession();
      return;
    }
    const msUntilExpiry = expiresFrom + SESSION_MAX_AGE_MS - Date.now();
    if (msUntilExpiry <= 0) {
      clearSession();
      toast.error('เซสชันการใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      return;
    }
    const timer = window.setTimeout(() => {
      clearSession();
      toast.error('เซสชันการใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    }, msUntilExpiry);
    return () => window.clearTimeout(timer);
  }, [lastActivityAt, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const markActivity = () => {
      const now = Date.now();
      if (now - lastActivityWriteRef.current < 30_000) return;
      lastActivityWriteRef.current = now;
      const touchedAt = touchAuthActivity(user);
      if (touchedAt) setLastActivityAt(touchedAt);
    };
    const events = ['click', 'keydown', 'touchstart', 'visibilitychange', 'focus'];
    events.forEach(eventName => window.addEventListener(eventName, markActivity, { passive: true }));
    return () => {
      events.forEach(eventName => window.removeEventListener(eventName, markActivity));
    };
  }, [user]);

  const loginUser = async (employeeId: string, pin?: string, options: { remember?: boolean } = {}) => {
    const res = await login(employeeId, pin);
    if (res.success && res.user) {
      completeLoginAfterFeedback(res.user, options);
    }
    return res;
  };

  const setupUserPin = async (employeeId: string, pin: string, name: string, options: { remember?: boolean } = {}) => {
    const res = await setupPin(employeeId, pin, name);
    if (res.success && res.user) {
      completeLoginAfterFeedback(res.user, options);
    }
    return res;
  };

  const logout = () => {
    clearSession();
  };

  const updateUserProfile = async (newName?: string, newPassword?: string, currentPassword?: string) => {
    const res = await updateProfile(newName, newPassword, currentPassword);
    if (res.success && res.user) {
      setUser(res.user);
      writeAuthUser(res.user);
      setLastActivityAt(readAuthLastActivityAt(res.user));
    }
    return { success: res.success, error: res.error };
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, setupUserPin, updateUserProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
