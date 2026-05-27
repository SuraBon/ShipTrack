import React, { useState, useEffect } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { useRouteSyncStatus } from '@/hooks/useRouteSyncStatus';
import { normalizeRole, type AppRole } from '@/lib/roles';
import { toast } from 'sonner';
import { UI_COPY } from '@/lib/uiCopy';
import { ProfileDialog } from '@/components/layout/ProfileDialog';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { OfflineQueueDialog } from '@/components/layout/OfflineQueueDialog';
import {
  BarChart3,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  FileClock,
  Loader2,
  LockKeyhole,
  LogIn,
  LogOut,
  PackagePlus,
  Search,
  Settings,
  Truck,
  Users,
  Building2,
  X,
  Sun,
  Moon,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type PageId = "dashboard" | "create" | "track" | "parcelActivity" | "auditLogs" | "users" | "branches" | "login";

interface LayoutProps {
  children: React.ReactNode;
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;
}

const pagePaths: Record<PageId, string> = {
  dashboard: "/dashboard",
  create: "/create",
  track: "/track",
  parcelActivity: "/parcel-activity",
  auditLogs: "/audit-logs",
  users: "/users",
  branches: "/branches",
  login: "/login",
};

type NavItem = {
  id: PageId;
  label: string;
  icon: LucideIcon;
  badge: null;
  roles: AppRole[];
  accent: string;
};

const NavIcon = ({ icon: Icon, active = false }: { icon: LucideIcon; active?: boolean }) => (
  <Icon className={`h-[18px] w-[18px] ${active ? 'stroke-[2.6]' : 'stroke-2'}`} aria-hidden="true" />
);

const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, updateUserProfile } = useAuth();
  const { activeRouteCount } = useRouteSyncStatus();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileNavCollapsed, setIsMobileNavCollapsed] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const offlineQueue = useOfflineQueue();
  const [isOfflineQueueOpen, setIsOfflineQueueOpen] = useState(false);

  const currentRole = normalizeRole(user?.role ?? 'GUEST');
  const hideGuestMobileTopBar = currentRole === 'GUEST' && (currentPage === 'create' || currentPage === 'track');
  const dashboardLabel = currentRole === 'MESSENGER' ? UI_COPY.nav.messengerDashboard : UI_COPY.nav.adminDashboard;
  const dashboardIcon =
    currentRole === 'MESSENGER'
      ? Truck
      : BarChart3;
  const allNavItems: NavItem[] = [
    { id: "dashboard", label: dashboardLabel, icon: dashboardIcon, badge: null, roles: ['ADMIN', 'MESSENGER'], accent: "from-sky-400 to-blue-500" },
    { id: "create",    label: UI_COPY.nav.create, icon: PackagePlus, badge: null, roles: ['ADMIN', 'GUEST'], accent: "from-amber-300 to-orange-500" },
    { id: "track",     label: UI_COPY.nav.track, icon: Search, badge: null, roles: ['GUEST'], accent: "from-violet-300 to-indigo-500" },
    { id: "login",     label: UI_COPY.nav.staffLogin, icon: LogIn, badge: null, roles: ['GUEST'], accent: "from-zinc-500 to-zinc-900" },
    { id: "parcelActivity", label: UI_COPY.nav.parcelActivity, icon: FileClock, badge: null, roles: ['ADMIN'], accent: "from-cyan-300 to-blue-600" },
    { id: "auditLogs", label: UI_COPY.nav.auditLogs, icon: ClipboardList, badge: null, roles: ['ADMIN'], accent: "from-emerald-300 to-teal-600" },
    { id: "users",     label: UI_COPY.nav.users, icon: Users, badge: null, roles: ['ADMIN'], accent: "from-rose-300 to-red-500" },
    { id: "branches",  label: "แผนก/สาขา", icon: Building2, badge: null, roles: ['ADMIN'], accent: "from-slate-400 to-slate-700" },
  ];
  const navItems = allNavItems.filter(item => item.roles.includes(currentRole));
  const canCollapseMobileNav = currentRole === 'ADMIN' && navItems.length > 3;
  const currentNavItem = navItems.find(n => n.id === currentPage);
  const mobileBottomPadding = canCollapseMobileNav && isMobileNavCollapsed ? 'pb-16' : 'pb-24';

  useEffect(() => {
    if (!canCollapseMobileNav) setIsMobileNavCollapsed(false);
  }, [canCollapseMobileNav]);

  const handleNav = (event: React.MouseEvent<HTMLAnchorElement>, id: PageId) => {
    event.preventDefault();
    setCurrentPage(id);
  };

  const openProfile = () => {
    setProfileForm({ name: user?.name ?? '', currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowPasswordFields(false);
    setIsProfileOpen(true);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, currentPassword, newPassword, confirmPassword } = profileForm;
    if (!name.trim()) { toast.error('กรุณากรอกชื่อ-นามสกุล'); return; }
    if (showPasswordFields && !currentPassword) { toast.error('กรุณากรอกรหัสผ่านปัจจุบัน'); return; }
    if (showPasswordFields && !newPassword) { toast.error('กรุณากรอกรหัสผ่านใหม่'); return; }
    if (showPasswordFields && newPassword.length < 4) { toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร'); return; }
    if (showPasswordFields && newPassword !== confirmPassword) { toast.error('รหัสผ่านใหม่ไม่ตรงกัน'); return; }

    setProfileLoading(true);
    const res = await updateUserProfile(
      name.trim() !== user?.name ? name.trim() : undefined,
      showPasswordFields ? newPassword : undefined,
      showPasswordFields ? currentPassword : undefined,
    );
    setProfileLoading(false);

    if (res.success) {
      toast.success('บันทึกข้อมูลสำเร็จ');
      setIsProfileOpen(false);
    } else {
      toast.error(res.error || 'เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="min-h-screen bg-background font-body text-on-background">
      {/* ── Main content ── */}
      <div className="flex min-h-screen flex-col">
        {/* Top bar */}
        <header
          className={`sticky top-0 z-40 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85 ${hideGuestMobileTopBar ? 'hidden md:block' : ''}`}
        >
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/55 sm:block">{UI_COPY.appName}</p>
              <h1 className="truncate text-base font-semibold leading-tight text-primary sm:text-lg">
                {navItems.find(n => n.id === currentPage)?.label ?? currentPage}
              </h1>
            </div>

            {navItems.length > 1 && (
              <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
                {navItems.map((item) => {
                  const active = currentPage === item.id;
                  return (
                    <a
                      key={item.id}
                      href={pagePaths[item.id]}
                      onClick={(event) => handleNav(event, item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <NavIcon icon={item.icon} active={active} />
                      <span className="hidden lg:inline">{item.label}</span>
                    </a>
                  );
                })}
              </nav>
            )}

            <div className="flex shrink-0 items-center gap-1">
              {activeRouteCount > 0 && (
                <div
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50/60 px-2.5 py-1 text-[11px] font-bold text-red-600 sm:px-2.5"
                  title="กำลังบันทึกเส้นทางส่ง"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span>บันทึกเส้นทาง ({activeRouteCount})</span>
                </div>
              )}
              {offlineQueue.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsOfflineQueueOpen(true)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold sm:px-2.5 transition-all ${
                    offlineQueue.some(item => item.status === 'failed')
                      ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                  title="ดูรายการจัดส่งออฟไลน์ที่รอซิงค์"
                >
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">sync_problem</span>
                  <span>คิวออฟไลน์ ({offlineQueue.length})</span>
                </button>
              )}
              {toggleTheme && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 active:scale-95"
                  title={theme === "light" ? "โหมดกลางคืน" : "โหมดสว่าง"}
                  aria-label="เปลี่ยนธีม"
                >
                  {theme === "light" ? (
                    <Moon className="h-4.5 w-4.5" aria-hidden="true" />
                  ) : (
                    <Sun className="h-4.5 w-4.5" aria-hidden="true" />
                  )}
                </button>
              )}
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={openProfile}
                    className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                    title="โปรไฟล์"
                    aria-label="โปรไฟล์"
                  >
                    <span className="text-sm font-black uppercase">{user.name.charAt(0)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 bg-white text-red-600 transition-all hover:bg-red-50 active:scale-95"
                    title="ออกจากระบบ"
                    aria-label="ออกจากระบบ"
                  >
                    <LogOut className="h-4.5 w-4.5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                null
              )}
            </div>
          </div>
        </header>

        {!isOnline && (
          <div className="bg-amber-500 text-white text-xs font-bold text-center py-2 px-4 animate-in slide-in-from-top duration-300 shadow-sm flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span>โหมดออฟไลน์ — การส่งพัสดุและบันทึกพิกัดจะถูกเก็บไว้ชั่วคราวและซิงค์เมื่อเน็ตกลับมา</span>
          </div>
        )}

        <main className={`mx-auto w-full max-w-7xl flex-1 px-3 ${mobileBottomPadding} sm:px-5 md:px-6 md:pb-10 lg:px-8 ${hideGuestMobileTopBar ? 'pt-3 md:pt-4' : 'pt-4'}`}>
          {children}
        </main>
      </div>

      {navItems.length > 1 && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
          {canCollapseMobileNav && isMobileNavCollapsed ? (
            <div className="mx-auto flex h-11 max-w-md items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3">
              <div className="flex min-w-0 items-center gap-2 text-slate-700">
                {currentNavItem && <NavIcon icon={currentNavItem.icon} active />}
                <span className="truncate text-sm font-black">{currentNavItem?.label ?? currentPage}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavCollapsed(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
                aria-label="ขยายเมนู"
                title="ขยายเมนู"
              >
                <ChevronUp className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              {canCollapseMobileNav && (
                <button
                  type="button"
                  onClick={() => setIsMobileNavCollapsed(true)}
                  className="mx-auto mb-1 flex h-6 items-center gap-1 rounded-full px-3 text-[10px] font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="ย่อเมนู"
                  title="ย่อเมนู"
                >
                  ย่อเมนู
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              <div className="mx-auto flex max-w-md gap-1 overflow-x-auto no-scrollbar snap-x">
                {navItems.map((item) => {
                  const active = currentPage === item.id;
                  return (
                    <a
                      key={item.id}
                      href={pagePaths[item.id]}
                      onClick={(event) => handleNav(event, item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-14 min-w-[72px] flex-1 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                      }`}
                    >
                      <NavIcon icon={item.icon} active={active} />
                      <span className="w-full truncate px-1 text-center">{item.label}</span>
                    </a>
                  );
                })}
              </div>
            </>
          )}
        </nav>
      )}

      {/* ── Edit Profile Dialog ── */}
      <ProfileDialog
        isProfileOpen={isProfileOpen}
        setIsProfileOpen={setIsProfileOpen}
        handleProfileSave={handleProfileSave}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        profileLoading={profileLoading}
        showPasswordFields={showPasswordFields}
        setShowPasswordFields={setShowPasswordFields}
        showCurrentPassword={showCurrentPassword}
        setShowCurrentPassword={setShowCurrentPassword}
        showNewPassword={showNewPassword}
        setShowNewPassword={setShowNewPassword}
        showConfirmPassword={showConfirmPassword}
        setShowConfirmPassword={setShowConfirmPassword}
      />

      {/* ── Offline Queue Dialog ── */}
      <OfflineQueueDialog
        isOpen={isOfflineQueueOpen}
        onClose={() => setIsOfflineQueueOpen(false)}
        queue={offlineQueue}
      />
    </div>
  );
};

export default Layout;
