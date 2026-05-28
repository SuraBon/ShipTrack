import React, { useState, useEffect, useRef } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { useRouteSyncStatus } from '@/hooks/useRouteSyncStatus';
import { normalizeRole, type AppRole } from '@/lib/roles';
import { toast } from 'sonner';
import { UI_COPY } from '@/lib/uiCopy';
import { ROUTE_TRACKING_ERROR_EVENT } from '@/lib/routeTracking';
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
  const routeSyncStatus = useRouteSyncStatus();
  const { activeRouteCount } = routeSyncStatus;
  const routePopoverShouldShow =
    activeRouteCount > 0 ||
    routeSyncStatus.pendingRouteSampleCount > 0 ||
    routeSyncStatus.isRouteSyncing ||
    !!routeSyncStatus.lastRouteSyncError;
  const routeButtonCount =
    activeRouteCount > 0
      ? activeRouteCount
      : routeSyncStatus.pendingRouteSampleCount > 0
        ? routeSyncStatus.pendingRouteSampleCount
        : routeSyncStatus.isRouteSyncing
          ? 1
          : 0;
  const routeSavingCount = routeButtonCount;
  const routeHealthRows = routeSyncStatus.pendingRoutes.slice(0, 6);
  const hiddenRouteHealthCount = Math.max(routeSyncStatus.pendingRoutes.length - routeHealthRows.length, 0);
  const [isRoutePopoverOpen, setIsRoutePopoverOpen] = useState(false);
  const routePopoverRef = useRef<HTMLDivElement>(null);

  const formatSyncTime = (value: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  // ปิด popover เมื่อคลิกนอก
  useEffect(() => {
    if (!isRoutePopoverOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (routePopoverRef.current && !routePopoverRef.current.contains(e.target as Node)) {
        setIsRoutePopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isRoutePopoverOpen]);
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
    if (typeof window === 'undefined') return;
    const handleRouteError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) toast.warning(detail.message);
    };
    window.addEventListener(ROUTE_TRACKING_ERROR_EVENT, handleRouteError);
    return () => window.removeEventListener(ROUTE_TRACKING_ERROR_EVENT, handleRouteError);
  }, []);

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
          className="sticky top-0 z-40 border-b border-gray-100 dark:border-white/[0.06] bg-white/95 dark:bg-[#091325]/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:supports-[backdrop-filter]:bg-[#091325]/85"
        >
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#091426] p-1 shadow-sm shrink-0">
                <svg className="h-full w-full" viewBox="0 0 64 64" role="img" aria-label="ShipTrack">
                  <path d="M 35.0 9.2 A 23 23 0 0 1 53.2 40.8" fill="none" stroke="#5f738c" strokeWidth="4.5" strokeLinecap="butt" />
                  <path d="M 50.3 46.0 A 23 23 0 0 1 13.7 46.0" fill="none" stroke="#5f738c" strokeWidth="4.5" strokeLinecap="butt" />
                  <path d="M 10.8 40.8 A 23 23 0 0 1 29.0 9.2" fill="none" stroke="#5f738c" strokeWidth="4.5" strokeLinecap="butt" />
                  <path d="M 18.5 41.5 L 32 20 L 45.5 41.5" fill="none" stroke="#06b6d4" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="butt" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="hidden text-[9px] font-black uppercase tracking-[0.18em] text-on-surface-variant/55 leading-none sm:block">{UI_COPY.appName}</p>
                <h1 className="truncate mt-0.5 text-sm font-semibold leading-none text-primary dark:text-white sm:text-lg sm:mt-1">
                  {navItems.find(n => n.id === currentPage)?.label ?? currentPage}
                </h1>
              </div>
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
                          ? 'bg-slate-900 dark:bg-white/10 text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <NavIcon icon={item.icon} active={active} />
                      <span className="hidden lg:inline">{item.label}</span>
                    </a>
                  );
                })}
              </nav>
            )}

            <div className="flex shrink-0 items-center gap-1 text-slate-700 dark:text-slate-100">
              {routePopoverShouldShow && (
                <div className="relative" ref={routePopoverRef}>
                  <button
                    type="button"
                    onClick={() => setIsRoutePopoverOpen(v => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-600 transition-all hover:bg-red-500/20 hover:text-red-500 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 sm:px-2.5"
                    title="กำลังบันทึกเส้นทางส่ง"
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span>บันทึกเส้นทาง ({routeButtonCount})</span>
                  </button>

                  {isRoutePopoverOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-slate-200/70 dark:border-white/[0.12] bg-card shadow-xl">
                      <div className="px-4 py-3 border-b border-slate-200/60 dark:border-white/[0.08]">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-foreground">บันทึกเส้นทาง</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            routeSyncStatus.isRouteSyncing
                              ? 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                              : routeSyncStatus.lastRouteSyncError
                                ? 'bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                                : 'bg-surface-container text-muted-foreground'
                          }`}>
                            {routeSyncStatus.isRouteSyncing ? 'กำลังซิงค์' : routeSyncStatus.lastRouteSyncError ? 'ซิงค์ไม่สำเร็จ' : 'พร้อมซิงค์'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          กำลังบันทึกพิกัด {routeSavingCount} งาน
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-3">
                        <div className="rounded-xl bg-surface-container px-2.5 py-2">
                          <p className="text-[9px] font-black text-muted-foreground">พิกัดค้างส่ง</p>
                          <p className="mt-0.5 text-sm font-black text-foreground">{routeSyncStatus.pendingRouteSampleCount}</p>
                        </div>
                        <div className="rounded-xl bg-surface-container px-2.5 py-2">
                          <p className="text-[9px] font-black text-muted-foreground">บันทึกล่าสุด</p>
                          <p className="mt-0.5 text-sm font-black text-foreground">{formatSyncTime(routeSyncStatus.latestRouteSampleAt)}</p>
                        </div>
                        <div className="rounded-xl bg-surface-container px-2.5 py-2">
                          <p className="text-[9px] font-black text-muted-foreground">ซิงค์ล่าสุด</p>
                          <p className="mt-0.5 text-sm font-black text-foreground">{formatSyncTime(routeSyncStatus.lastRouteSyncAt)}</p>
                        </div>
                      </div>
                      {routeSyncStatus.lastRouteSyncError && (
                        <p className="px-3 pb-3 text-[11px] font-semibold text-red-700 dark:text-red-300">
                          {routeSyncStatus.lastRouteSyncError}
                        </p>
                      )}
                      {routeHealthRows.length > 0 && (
                        <div className="border-t border-slate-200/60 px-3 py-3 dark:border-white/[0.08]">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[11px] font-black text-foreground">งานที่กำลังบันทึก/ค้างซิงค์</p>
                            <span className="text-[10px] font-bold text-muted-foreground">{routeSyncStatus.pendingRoutes.length} งาน</span>
                          </div>
                          <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                            {routeHealthRows.map(route => (
                              <div key={route.trackingID} className="rounded-xl bg-surface-container px-2.5 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="min-w-0 truncate text-[11px] font-black text-foreground">{route.trackingID}</p>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${
                                    route.pendingCount > 0
                                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  }`}>
                                    {route.pendingCount > 0 ? `${route.pendingCount} ค้าง` : 'ทันล่าสุด'}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-muted-foreground">
                                  <span>{route.active ? 'กำลังติดตาม GPS' : 'รอซิงค์ย้อนหลัง'}</span>
                                  <span>{formatSyncTime(route.latestSampleAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          {hiddenRouteHealthCount > 0 && (
                            <p className="mt-2 text-[10px] font-semibold text-muted-foreground">
                              และอีก {hiddenRouteHealthCount} งาน
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {offlineQueue.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsOfflineQueueOpen(true)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold sm:px-2.5 transition-all ${
                    offlineQueue.some(item => item.status === 'failed')
                      ? 'border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20'
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
                  className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-white/10 active:scale-95"
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
                    className="grid h-9 w-9 place-items-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 transition-all hover:bg-red-500/20 hover:text-red-500 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 active:scale-95"
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

        <main className={`mx-auto w-full max-w-7xl flex-1 px-3 ${mobileBottomPadding} sm:px-5 md:px-6 md:pb-10 lg:px-8 pt-4`}>
          {children}
        </main>
      </div>

      {navItems.length > 1 && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 dark:border-white/[0.06] bg-white/95 dark:bg-[#091325]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.3)] backdrop-blur md:hidden">
          {canCollapseMobileNav && isMobileNavCollapsed ? (
            <div className="mx-auto flex h-11 max-w-md items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-white/5 px-3">
              <div className="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
                {currentNavItem && <NavIcon icon={currentNavItem.icon} active />}
                <span className="truncate text-sm font-black">{currentNavItem?.label ?? currentPage}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavCollapsed(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 dark:text-slate-400 transition-colors hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-200"
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
                  className="mx-auto mb-1 flex h-6 items-center gap-1 rounded-full px-3 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground"
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
                          ? 'bg-white/10 text-white'
                          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
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
