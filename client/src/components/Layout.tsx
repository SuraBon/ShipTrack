import React, { useState, useRef, useEffect, useMemo } from "react";
import { useParcelStore } from '@/hooks/useParcelStore';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useRouteSyncStatus } from '@/hooks/useRouteSyncStatus';
import type { Parcel } from '@/types/parcel';
import { formatThaiDateTime, getDateTime } from '@/lib/dateUtils';
import { normalizeRole, type AppRole } from '@/lib/roles';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { UI_COPY } from '@/lib/uiCopy';
import {
  BarChart3,
  Bell,
  BellRing,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  FileClock,
  Inbox,
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
  type LucideIcon,
} from 'lucide-react';

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
  const { parcels } = useParcelStore();
  const { user, logout, updateUserProfile } = useAuth();
  const offlineQueue = useOfflineQueue();
  const { pendingRouteSampleCount, activeRouteCount } = useRouteSyncStatus();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileNavCollapsed, setIsMobileNavCollapsed] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('seen_parcel_ids');
      if (!stored) return new Set();
      const data = JSON.parse(stored);
      if (data.timestamp && Date.now() - data.timestamp > 30 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem('seen_parcel_ids');
        return new Set();
      }
      return new Set(Array.isArray(data.ids) ? data.ids : data);
    } catch {
      return new Set();
    }
  });
  const notifRef = useRef<HTMLDivElement>(null);

  const recentParcels = useMemo(() => [...parcels]
      .sort((a, b) => {
        const da = getDateTime(a['วันที่รับ'] || a['วันที่สร้าง']);
        const db = getDateTime(b['วันที่รับ'] || b['วันที่สร้าง']);
        return db - da;
      })
      .slice(0, 8),
    [parcels],
  );

  const unreadCount = recentParcels.filter(p => !seenIds.has(p.TrackingID)).length;
  const pendingOfflineCount = offlineQueue.filter(item => item.status === 'pending' || item.status === 'failed').length;
  const pendingSyncCount = pendingOfflineCount + pendingRouteSampleCount;

  const markAllSeen = () => {
    const next = new Set([...Array.from(seenIds), ...recentParcels.map(p => p.TrackingID)]);
    setSeenIds(next);
    localStorage.setItem('seen_parcel_ids', JSON.stringify({
      ids: Array.from(next),
      timestamp: Date.now(),
    }));
  };

  const handleBellClick = () => {
    const opening = !isNotifOpen;
    setIsNotifOpen(opening);
    if (opening) markAllSeen();
  };

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleMouse);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouse);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const getStatusColor = (status: Parcel['สถานะ']) => {
    if (status === 'ส่งสำเร็จ') return 'bg-emerald-500';
    if (status === 'กำลังจัดส่ง') return 'bg-blue-500';
    return 'bg-amber-500';
  };

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
    <div className="min-h-screen bg-[#f8fafc] font-body text-on-background">
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
              {pendingSyncCount > 0 && (
                <div
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 sm:px-2.5"
                  title={pendingRouteSampleCount > 0 ? 'มีรายการและเส้นทางรอซิงค์' : 'มีรายการรอซิงค์'}
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">sync_problem</span>
                  <span className="hidden sm:inline">รอซิงค์</span> {pendingSyncCount}
                </div>
              )}
              {activeRouteCount > 0 && (
                <div
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800 sm:px-2.5"
                  title="กำลังบันทึกเส้นทางส่ง"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">near_me</span>
                  <span className="hidden sm:inline">บันทึกเส้นทาง</span> {activeRouteCount}
                </div>
              )}
              {user && (
              <div className="relative" ref={notifRef}>
                  <button
                    onClick={handleBellClick}
                    className="relative grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                    aria-label="อัปเดตล่าสุด"
                  >
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    {unreadCount > 0 && (
                      <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-destructive px-0.5 text-[9px] font-semibold leading-none text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {isNotifOpen && (
                  <div className="fixed right-3 top-16 z-50 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-outline-variant bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between border-b border-outline-variant/60 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BellRing className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span className="text-sm font-semibold text-primary">อัปเดตล่าสุด</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">{recentParcels.length} รายการ</span>
                    </div>
                    <div className="max-h-72 divide-y divide-outline-variant/50 overflow-y-auto">
                      {recentParcels.length === 0 ? (
                        <div className="grid place-items-center gap-2 py-8 text-center text-sm text-on-surface-variant/60">
                          <Inbox className="h-7 w-7 opacity-50" aria-hidden="true" />
                          ยังไม่มีรายการ
                        </div>
                      ) : recentParcels.map(p => (
                        <div key={p.TrackingID} className="px-4 py-3 hover:bg-surface-container-lowest transition-colors cursor-default">
                          <div className="flex items-start gap-3">
                            <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${getStatusColor(p['สถานะ'])}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <code className="min-w-0 break-all text-xs font-mono font-black text-primary">{p.TrackingID}</code>
                                <span className="text-[10px] text-on-surface-variant/40 shrink-0">{p['สถานะ']}</span>
                              </div>
                              <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                                {p['ผู้ส่ง']} → {p['ผู้รับ']}
                              </p>
                              <p className="text-[10px] text-on-surface-variant/40 mt-0.5">
                                {formatThaiDateTime(p['วันที่รับ'] || p['วันที่สร้าง'])}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}
              </div>
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
              <div className={`mx-auto grid max-w-md gap-1 ${navItems.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {navItems.map((item) => {
                  const active = currentPage === item.id;
                  return (
                    <a
                      key={item.id}
                      href={pagePaths[item.id]}
                      onClick={(event) => handleNav(event, item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors ${
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
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent showCloseButton={false} className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md flex-col overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white p-0 shadow-xl sm:max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="relative bg-slate-950 px-5 py-5 text-white">
            <button
              type="button"
              onClick={() => setIsProfileOpen(false)}
              className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="ปิดแก้ไขโปรไฟล์"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-3 pr-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                <Settings className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white">แก้ไขโปรไฟล์</DialogTitle>
                <DialogDescription className="mt-1 text-xs font-semibold text-slate-300">
                  แก้ไขชื่อหรือรหัสผ่านของคุณ
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleProfileSave} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-bold text-on-surface-variant mb-1.5">ชื่อ-นามสกุล</label>
              <input
                type="text"
                value={profileForm.name}
                onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                disabled={profileLoading}
                className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
                placeholder="ชื่อ-นามสกุล"
              />
            </div>

            <div className="border-t border-outline-variant/20 pt-3">
              {!showPasswordFields ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordFields(true)}
                  disabled={profileLoading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white text-sm font-semibold text-primary transition-all hover:bg-surface-container disabled:opacity-50"
                >
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  เปลี่ยนรหัสผ่าน
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-on-surface-variant/50 uppercase tracking-wider">เปลี่ยนรหัสผ่าน</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordFields(false);
                        setProfileForm(f => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }));
                      }}
                      disabled={profileLoading}
                      className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-on-surface-variant/65 transition-colors hover:bg-surface-container hover:text-primary disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      ไม่เปลี่ยน
                    </button>
                  </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1.5">รหัสผ่านปัจจุบัน</label>
                  <input
                    type="password"
                    value={profileForm.currentPassword}
                    onChange={e => setProfileForm(f => ({ ...f, currentPassword: e.target.value }))}
                    disabled={profileLoading}
                    className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1.5">รหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={profileForm.newPassword}
                    onChange={e => setProfileForm(f => ({ ...f, newPassword: e.target.value }))}
                    disabled={profileLoading}
                    className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
                    placeholder="อย่างน้อย 4 ตัวอักษร"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1.5">ยืนยันรหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={profileForm.confirmPassword}
                    onChange={e => setProfileForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    disabled={profileLoading}
                    className="h-11 w-full rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
                    placeholder="••••••••"
                  />
                </div>
                </div>
              )}
            </div>

            </div>

            <div className="flex shrink-0 gap-3 border-t border-outline-variant/15 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                disabled={profileLoading}
                className="h-11 flex-1 rounded-lg border border-outline-variant font-semibold text-on-surface-variant transition-all hover:bg-surface-container disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={profileLoading}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {profileLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : 'บันทึก'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Layout;
