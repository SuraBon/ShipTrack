import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, login, setupPin, updateProfile } from '@/lib/parcelService';
import { normalizeRole } from '@/lib/roles';
import { toast } from 'sonner';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginUser: (employeeId: string, pin?: string) => Promise<{ success: boolean, needsSetup?: boolean, error?: string, role?: string, name?: string, branch?: string }>;
  setupUserPin: (employeeId: string, pin: string, name: string, branch: string) => Promise<{ success: boolean, error?: string }>;
  updateUserProfile: (newName?: string, newBranch?: string, newPassword?: string, currentPassword?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_KEY = 'doc_track_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const authTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = () => {
    if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const completeLoginAfterFeedback = (authenticatedUser: User) => {
    if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
    localStorage.setItem(SESSION_KEY, JSON.stringify(authenticatedUser));
    authTransitionTimer.current = setTimeout(() => {
      setUser(authenticatedUser);
      authTransitionTimer.current = null;
    }, 900);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem(SESSION_KEY);
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as User;
        const normalizedUser = { ...parsed, role: normalizeRole(parsed.role) };
        if (normalizedUser.role === 'GUEST') {
          clearSession();
        } else {
          setUser(normalizedUser);
          localStorage.setItem(SESSION_KEY, JSON.stringify(normalizedUser));
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
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

  const loginUser = async (employeeId: string, pin?: string) => {
    const res = await login(employeeId, pin);
    if (res.success && res.user) {
      completeLoginAfterFeedback(res.user);
    }
    return res;
  };

  const setupUserPin = async (employeeId: string, pin: string, name: string, branch: string) => {
    const res = await setupPin(employeeId, pin, name, branch);
    if (res.success && res.user) {
      completeLoginAfterFeedback(res.user);
    }
    return res;
  };

  const logout = () => {
    clearSession();
  };

  const updateUserProfile = async (newName?: string, newBranch?: string, newPassword?: string, currentPassword?: string) => {
    const res = await updateProfile(newName, newBranch, newPassword, currentPassword);
    if (res.success && res.user) {
      setUser(res.user);
      localStorage.setItem(SESSION_KEY, JSON.stringify(res.user));
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
