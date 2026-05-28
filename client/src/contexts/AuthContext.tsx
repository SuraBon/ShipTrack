import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, login, setupPin, updateProfile } from '@/lib/parcelService';
import { normalizeRole } from '@/lib/roles';
import { toast } from 'sonner';
import { clearAuthUser, readAuthUser, writeAuthUser } from '@/lib/authStorage';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginUser: (employeeId: string, pin?: string) => Promise<{ success: boolean, needsSetup?: boolean, error?: string, role?: string, name?: string }>;
  setupUserPin: (employeeId: string, pin: string, name: string) => Promise<{ success: boolean, error?: string }>;
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

function isSessionExpired(user?: User | null): boolean {
  const issuedAt = getUserIssuedAt(user);
  if (!issuedAt) return true;
  return Date.now() - issuedAt > SESSION_MAX_AGE_MS;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const authTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = () => {
    if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
    setUser(null);
    clearAuthUser();
  };

  const completeLoginAfterFeedback = (authenticatedUser: User) => {
    if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
    writeAuthUser(authenticatedUser);
    authTransitionTimer.current = setTimeout(() => {
      setUser(authenticatedUser);
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
          writeAuthUser(normalizedUser);
        }
      } catch {
        clearAuthUser();
      }
    }
    setLoading(false);

    const handleAuthError = () => {
      clearSession();
      toast.error('บัญชีนี้ถูกใช้งานที่อื่น กรุณาเข้าสู่ระบบใหม่');
    };

    window.addEventListener('auth_error', handleAuthError);

    return () => {
      window.removeEventListener('auth_error', handleAuthError);
      if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const issuedAt = getUserIssuedAt(user);
    if (!issuedAt) {
      clearSession();
      return;
    }
    const msUntilExpiry = issuedAt + SESSION_MAX_AGE_MS - Date.now();
    if (msUntilExpiry <= 0) {
      clearSession();
      toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      return;
    }
    const timer = window.setTimeout(() => {
      clearSession();
      toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }, msUntilExpiry);
    return () => window.clearTimeout(timer);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loginUser = async (employeeId: string, pin?: string) => {
    const res = await login(employeeId, pin);
    if (res.success && res.user) {
      completeLoginAfterFeedback(res.user);
    }
    return res;
  };

  const setupUserPin = async (employeeId: string, pin: string, name: string) => {
    const res = await setupPin(employeeId, pin, name);
    if (res.success && res.user) {
      completeLoginAfterFeedback(res.user);
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
