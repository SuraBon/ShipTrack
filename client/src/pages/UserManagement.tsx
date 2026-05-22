import { useState, useEffect, useMemo, useRef } from 'react';
import { createUser, deleteUser, disableUser, getBranches, getUsers, loadBranches, updateUser, updateUserRole, UserRow } from '@/lib/parcelService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SYSTEM_ROLES, type AppRole, type SystemRole } from '@/lib/roles';
import { isValidEmployeeId, normalizeEmployeeId, sanitizeTextInput, validatePassword, validateRequiredText } from '@/lib/validation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Search, RefreshCw, Users, ShieldCheck, Truck, UserX, Edit3, Trash2, Ban } from 'lucide-react';

const ROLE_CONFIG: Record<AppRole, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  ADMIN: {
    label: 'Admin',
    color: 'text-foreground',
    bg: 'bg-muted',
    border: 'border-border',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  MESSENGER: {
    label: 'พนักงานส่ง',
    color: 'text-foreground',
    bg: 'bg-muted',
    border: 'border-border',
    icon: <Truck className="h-3.5 w-3.5" />,
  },
  GUEST: {
    label: 'ไม่มีสิทธิ์พนักงาน',
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    border: 'border-border',
    icon: <UserX className="h-3.5 w-3.5" />,
  },
};

const USER_MOBILE_BATCH_SIZE = 10;
const USER_DESKTOP_PAGE_SIZE = 20;

function RoleDropdown({
  value,
  onChange,
  disabled,
}: {
  value: AppRole;
  onChange: (role: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = ROLE_CONFIG[value] ?? ROLE_CONFIG.GUEST;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all
          ${cfg.color} ${cfg.bg} ${cfg.border}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
      >
        {cfg.icon}
        {cfg.label}
        {!disabled && (
          <span className={`material-symbols-outlined text-[14px] transition-transform ${open ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-44 overflow-hidden rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-md">
          {SYSTEM_ROLES.map(role => {
            const c = ROLE_CONFIG[role];
            return (
              <button
                key={role}
                type="button"
                onClick={() => { onChange(role); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors
                  ${value === role ? `${c.bg} ${c.color}` : 'text-foreground hover:bg-muted'}`}
              >
                <span className={c.color}>{c.icon}</span>
                {c.label}
                {value === role && (
                  <span className="material-symbols-outlined text-[14px] ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AppRole>('ALL');
  const [userPage, setUserPage] = useState(1);
  const [mobileVisibleUsers, setMobileVisibleUsers] = useState(USER_MOBILE_BATCH_SIZE);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [branches, setBranches] = useState<string[]>(() => getBranches());
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', branch: '', role: 'MESSENGER' as SystemRole, password: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    employeeId: '',
    name: '',
    branch: '',
    role: 'MESSENGER' as SystemRole,
    password: '',
  });

  useEffect(() => {
    fetchUsers();
    void loadBranches().then(setBranches);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await getUsers();
    if (res.success && res.users) {
      setUsers(res.users);
    } else {
      toast.error('ไม่สามารถดึงข้อมูลผู้ใช้ได้');
    }
    setLoading(false);
  };

  const handleRoleChange = async (employeeId: string, newRole: string) => {
    if (employeeId === currentUser?.employeeId) {
      toast.error('ไม่สามารถเปลี่ยนสิทธิ์ของตนเองได้');
      return;
    }
    setUpdatingId(employeeId);
    const res = await updateUserRole(employeeId, newRole);
    if (res.success) {
      toast.success('เปลี่ยนสิทธิ์ผู้ใช้สำเร็จ');
      setUsers(prev => prev.map(u => u.employeeId === employeeId ? { ...u, role: newRole as AppRole } : u));
    } else {
      toast.error(res.error || 'ไม่สามารถเปลี่ยนสิทธิ์ได้');
    }
    setUpdatingId(null);
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    const employeeId = normalizeEmployeeId(newUser.employeeId);
    const name = sanitizeTextInput(newUser.name, 100);
    const branch = sanitizeTextInput(newUser.branch, 100);
    const role = newUser.role;
    const password = newUser.password.trim();

    const nameError = validateRequiredText(name, 'ชื่อ-นามสกุล', 1, 100);
    const branchError = validateRequiredText(branch, 'แผนก/สาขา', 1, 100);
    const passwordError = validatePassword(password, 100);
    if (!isValidEmployeeId(employeeId)) {
      toast.error('รหัสพนักงานต้องใช้ A-Z, 0-9 หรือ _ เท่านั้น');
      return;
    }
    if (nameError || branchError || passwordError) {
      toast.error(nameError || branchError || passwordError || 'กรุณาตรวจสอบข้อมูลผู้ใช้');
      return;
    }

    setCreatingUser(true);
    const res = await createUser({ employeeId, name, branch, role, password });
    setCreatingUser(false);

    if (res.success && res.user) {
      setUsers(prev => [res.user!, ...prev.filter(user => user.employeeId !== employeeId)]);
      setNewUser({ employeeId: '', name: '', branch: '', role: 'MESSENGER', password: '' });
      toast.success('สร้างผู้ใช้สำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถสร้างผู้ใช้ได้');
    }
  };

  const openEditUser = (target: UserRow) => {
    setEditingUser(target);
    setEditForm({
      name: target.name,
      branch: target.branch,
      role: (target.role === 'ADMIN' ? 'ADMIN' : 'MESSENGER') as SystemRole,
      password: '',
    });
  };

  const handleSaveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    const name = sanitizeTextInput(editForm.name, 100);
    const branch = sanitizeTextInput(editForm.branch, 100);
    const password = editForm.password.trim();
    const nameError = validateRequiredText(name, 'ชื่อ-นามสกุล', 1, 100);
    const branchError = validateRequiredText(branch, 'แผนก/สาขา', 1, 100);
    const passwordError = password ? validatePassword(password, 100) : undefined;
    if (nameError || branchError || passwordError) {
      toast.error(nameError || branchError || passwordError || 'กรุณาตรวจสอบข้อมูลผู้ใช้');
      return;
    }

    setEditSaving(true);
    const res = await updateUser({
      targetId: editingUser.employeeId,
      name,
      branch,
      role: editForm.role,
      password: password || undefined,
    });
    setEditSaving(false);

    if (res.success && res.user) {
      setUsers(prev => prev.map(u => u.employeeId === res.user!.employeeId ? res.user! : u));
      setEditingUser(null);
      toast.success('บันทึกข้อมูลผู้ใช้สำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถบันทึกข้อมูลผู้ใช้ได้');
    }
  };

  const handleDisableUser = async (target: UserRow) => {
    if (target.employeeId === currentUser?.employeeId) {
      toast.error('ไม่สามารถปิดบัญชีของตนเองได้');
      return;
    }
    if (!window.confirm(`ปิดบัญชี ${target.employeeId}? ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้`)) return;
    setDeletingId(target.employeeId);
    const res = await disableUser(target.employeeId);
    setDeletingId(null);
    if (res.success && res.user) {
      setUsers(prev => prev.map(u => u.employeeId === res.user!.employeeId ? res.user! : u));
      toast.success('ปิดบัญชีผู้ใช้สำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถปิดบัญชีผู้ใช้ได้');
    }
  };

  const handleDeleteUser = async (target: UserRow) => {
    if (target.employeeId === currentUser?.employeeId) {
      toast.error('ไม่สามารถลบบัญชีของตนเองได้');
      return;
    }
    if (!window.confirm(`ลบผู้ใช้ ${target.employeeId} ถาวร?`)) return;
    setDeletingId(target.employeeId);
    const res = await deleteUser(target.employeeId);
    setDeletingId(null);
    if (res.success) {
      setUsers(prev => prev.filter(u => u.employeeId !== target.employeeId));
      toast.success('ลบผู้ใช้สำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถลบผู้ใช้ได้');
    }
  };

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    return (
      u.employeeId.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.branch.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  }), [users, search, roleFilter]);

  const totalUserPages = Math.max(1, Math.ceil(filtered.length / USER_DESKTOP_PAGE_SIZE));
  const paginatedUsers = filtered.slice((userPage - 1) * USER_DESKTOP_PAGE_SIZE, userPage * USER_DESKTOP_PAGE_SIZE);
  const visibleMobileUsers = filtered.slice(0, mobileVisibleUsers);
  const userStartIndex = filtered.length === 0 ? 0 : (userPage - 1) * USER_DESKTOP_PAGE_SIZE + 1;
  const userEndIndex = Math.min(userPage * USER_DESKTOP_PAGE_SIZE, filtered.length);

  useEffect(() => {
    setUserPage(1);
    setMobileVisibleUsers(USER_MOBILE_BATCH_SIZE);
  }, [search, roleFilter]);

  useEffect(() => {
    if (userPage > totalUserPages) setUserPage(totalUserPages);
  }, [userPage, totalUserPages]);

  const counts = {
    total: users.length,
    admin: users.filter(u => u.role === 'ADMIN').length,
    messenger: users.filter(u => u.role === 'MESSENGER').length,
    guest: users.filter(u => u.role === 'GUEST').length,
  };

  return (
    <div className="app-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="app-page-header">
        <div className="flex items-center gap-4">
          <div className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white md:flex">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="app-page-title">จัดการพนักงาน</h1>
            <p className="app-page-subtitle">สร้างรหัสพนักงานและกำหนดสิทธิ์ Admin/พนักงานส่ง</p>
          </div>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="app-secondary-button h-10 px-3"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      <form
        onSubmit={handleCreateUser}
        className="app-panel grid gap-3 p-4 lg:grid-cols-[1fr_1.4fr_1.2fr_0.9fr_1fr_auto]"
      >
        <div className="lg:col-span-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Plus className="h-4 w-4" aria-hidden="true" />
            สร้างผู้ใช้ใหม่
          </div>
        </div>
        <input
          value={newUser.employeeId}
          onChange={e => setNewUser(current => ({ ...current, employeeId: normalizeEmployeeId(e.target.value) }))}
          disabled={creatingUser}
          placeholder="รหัสพนักงาน"
          className="app-input uppercase"
        />
        <input
          value={newUser.name}
          onChange={e => setNewUser(current => ({ ...current, name: e.target.value }))}
          disabled={creatingUser}
          placeholder="ชื่อ-นามสกุล"
          className="app-input"
        />
        <input
          value={newUser.branch}
          onChange={e => setNewUser(current => ({ ...current, branch: e.target.value }))}
          disabled={creatingUser}
          placeholder="แผนก/สาขา"
          className="app-input"
        />
        <select
          value={newUser.role}
          onChange={e => setNewUser(current => ({ ...current, role: e.target.value as SystemRole }))}
          disabled={creatingUser}
          className="app-input font-medium"
        >
          {SYSTEM_ROLES.map(role => (
            <option key={role} value={role}>{ROLE_CONFIG[role].label}</option>
          ))}
        </select>
        <input
          type="password"
          value={newUser.password}
          onChange={e => setNewUser(current => ({ ...current, password: e.target.value }))}
          disabled={creatingUser}
          placeholder="รหัสผ่านเริ่มต้น"
          className="app-input"
        />
        <button
          type="submit"
          disabled={creatingUser}
          className="app-primary-button"
        >
          {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          สร้าง
        </button>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { key: 'ALL' as const, label: 'ทั้งหมด', value: counts.total, icon: <Users className="h-4 w-4" /> },
          { key: 'ADMIN' as const, label: 'Admin', value: counts.admin, icon: <ShieldCheck className="h-4 w-4" /> },
          { key: 'MESSENGER' as const, label: 'พนักงานส่ง', value: counts.messenger, icon: <Truck className="h-4 w-4" /> },
          { key: 'GUEST' as const, label: 'ไม่มีสิทธิ์', value: counts.guest, icon: <UserX className="h-4 w-4" /> },
        ].map(s => (
          <button
            key={s.label}
            type="button"
            onClick={() => setRoleFilter(s.key)}
            className={`app-compact-card flex items-center gap-3 text-left transition-all active:scale-[0.99] ${
              roleFilter === s.key
                ? 'border-primary ring-2 ring-ring/10'
                : 'hover:bg-muted/40'
            }`}
            aria-pressed={roleFilter === s.key}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-semibold leading-none text-foreground sm:text-2xl">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาด้วยรหัสพนักงาน ชื่อ แผนก/สาขา หรือสิทธิ์..."
          className="app-input w-full pl-10"
        />
      </div>

      {/* Users */}
      <div className="app-panel overflow-hidden">
        <div className="sm:hidden">
          {loading ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
              <p className="text-sm text-on-surface-variant mt-2">กำลังโหลด...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="mx-auto h-10 w-10 text-on-surface-variant/20 mb-2" />
              <p className="text-sm font-bold text-on-surface-variant/50">
                {search ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ยังไม่มีผู้ใช้งาน'}
              </p>
            </div>
          ) : (
            <>
            <div className="divide-y divide-outline-variant/10">
              {visibleMobileUsers.map(u => {
                const isSelf = u.employeeId === currentUser?.employeeId;
                const isUpdating = updatingId === u.employeeId;
                return (
                  <div key={u.employeeId} className={`p-4 ${isSelf ? 'bg-slate-50' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-base font-black uppercase text-slate-700">
                        {u.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <code className="truncate font-mono text-sm font-black text-primary">{u.employeeId}</code>
                          {isSelf && (
                            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary/60">คุณ</span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-base font-black leading-tight text-on-surface">{u.name}</p>
                        <p className="mt-0.5 truncate text-sm text-on-surface-variant/70">{u.branch}</p>
                      </div>
                      <div className="shrink-0">
                        {isUpdating ? (
                          <span className="material-symbols-outlined animate-spin text-lg text-primary">progress_activity</span>
                        ) : (
                          <RoleDropdown
                            value={u.role}
                            onChange={(role) => handleRoleChange(u.employeeId, role)}
                            disabled={isSelf}
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 pl-14">
                      {u.status === 'DISABLED' && (
                        <span className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">ปิดใช้งาน</span>
                      )}
                      <button type="button" onClick={() => openEditUser(u)} className="app-secondary-button h-9 px-3 text-xs">
                        <Edit3 className="h-3.5 w-3.5" /> แก้ไข
                      </button>
                      {!isSelf && (
                        <>
                          <button type="button" onClick={() => handleDisableUser(u)} disabled={deletingId === u.employeeId || u.status === 'DISABLED'} className="app-secondary-button h-9 px-3 text-xs">
                            {deletingId === u.employeeId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} ปิดบัญชี
                          </button>
                          <button type="button" onClick={() => handleDeleteUser(u)} disabled={deletingId === u.employeeId} className="h-9 rounded-lg px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50">
                            <Trash2 className="mr-1 inline h-3.5 w-3.5" /> ลบ
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length > mobileVisibleUsers && (
              <div className="border-t border-outline-variant/10 p-3">
                <button
                  type="button"
                  onClick={() => setMobileVisibleUsers(current => current + USER_MOBILE_BATCH_SIZE)}
                  className="app-secondary-button h-10 w-full text-xs"
                >
                  แสดงเพิ่ม {Math.min(USER_MOBILE_BATCH_SIZE, filtered.length - mobileVisibleUsers)} รายการ
                </button>
              </div>
            )}
            </>
          )}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">รหัสพนักงาน</th>
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">ชื่อ-นามสกุล</th>
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">แผนก/สาขา</th>
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">สิทธิ์</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
                    <p className="text-sm text-on-surface-variant mt-2">กำลังโหลด...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <Users className="mx-auto h-10 w-10 text-on-surface-variant/20 mb-2" />
                    <p className="text-sm font-bold text-on-surface-variant/50">
                      {search ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ยังไม่มีผู้ใช้งาน'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map(u => {
                  const isSelf = u.employeeId === currentUser?.employeeId;
                  const isUpdating = updatingId === u.employeeId;
                  return (
                    <tr key={u.employeeId} className={`transition-colors ${isSelf ? 'bg-primary/[0.03]' : 'hover:bg-surface-container-lowest/60'}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm font-black text-primary">{u.employeeId}</code>
                          {isSelf && (
                            <span className="text-[10px] font-bold text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded-md">คุณ</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-surface-container flex items-center justify-center shrink-0 text-xs font-black text-on-surface-variant uppercase">
                            {u.name.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-on-surface">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-on-surface-variant">{u.branch}</span>
                      </td>
                      <td className="px-5 py-4">
                        {isUpdating ? (
                          <span className="material-symbols-outlined animate-spin text-lg text-primary">progress_activity</span>
                        ) : (
                          <RoleDropdown
                            value={u.role}
                            onChange={(role) => handleRoleChange(u.employeeId, role)}
                            disabled={isSelf}
                          />
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {u.status === 'DISABLED' && (
                            <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600">ปิดใช้งาน</span>
                          )}
                          <button type="button" onClick={() => openEditUser(u)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100">
                            แก้ไข
                          </button>
                          {!isSelf && (
                            <>
                              <button type="button" onClick={() => handleDisableUser(u)} disabled={deletingId === u.employeeId || u.status === 'DISABLED'} className="rounded-md px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-40">
                                ปิดบัญชี
                              </button>
                              <button type="button" onClick={() => handleDeleteUser(u)} disabled={deletingId === u.employeeId} className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">
                                ลบ
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-outline-variant/10 bg-surface-container-lowest/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-on-surface-variant/50">
              <span className="sm:hidden">แสดง {Math.min(mobileVisibleUsers, filtered.length)} จาก {filtered.length} รายการ</span>
              <span className="hidden sm:inline">แสดง {userStartIndex}-{userEndIndex} จาก {filtered.length} รายการ</span>
              {filtered.length !== users.length && <span className="text-on-surface-variant/35"> (ทั้งหมด {users.length})</span>}
            </p>
            {totalUserPages > 1 && (
              <div className="hidden items-center gap-1 rounded-xl border border-gray-100 bg-white p-1 sm:flex">
                <button onClick={() => setUserPage(page => Math.max(1, page - 1))} disabled={userPage === 1} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30">
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <span className="px-2 text-xs font-black text-primary">{userPage}/{totalUserPages}</span>
                <button onClick={() => setUserPage(page => Math.min(totalUserPages, page + 1))} disabled={userPage === totalUserPages} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30">
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-xl border bg-white p-0">
          <DialogHeader className="border-b border-outline-variant/20 px-5 py-4">
            <DialogTitle className="text-lg font-semibold text-primary">แก้ไขผู้ใช้</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              แก้ชื่อ แผนก/สาขา สิทธิ์ หรือ reset PIN/password
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveUser} className="space-y-4 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">รหัสพนักงาน</label>
              <input value={editingUser?.employeeId ?? ''} disabled className="app-input w-full opacity-70" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">ชื่อ-นามสกุล</label>
              <input
                value={editForm.name}
                onChange={event => setEditForm(current => ({ ...current, name: event.target.value }))}
                disabled={editSaving}
                className="app-input w-full"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">แผนก/สาขา</label>
              <input
                value={editForm.branch}
                onChange={event => setEditForm(current => ({ ...current, branch: event.target.value }))}
                disabled={editSaving}
                list="edit-user-branch-options"
                className="app-input w-full"
              />
              <datalist id="edit-user-branch-options">
                {branches.map(branch => <option key={branch} value={branch} />)}
              </datalist>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">สิทธิ์</label>
              <select
                value={editForm.role}
                onChange={event => setEditForm(current => ({ ...current, role: event.target.value as SystemRole }))}
                disabled={editSaving || editingUser?.employeeId === currentUser?.employeeId}
                className="app-input w-full"
              >
                {SYSTEM_ROLES.map(role => <option key={role} value={role}>{ROLE_CONFIG[role].label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">รหัสผ่านใหม่ (ไม่กรอก = ไม่เปลี่ยน)</label>
              <input
                type="password"
                value={editForm.password}
                onChange={event => setEditForm(current => ({ ...current, password: event.target.value }))}
                disabled={editSaving}
                className="app-input w-full"
              />
            </div>
            <div className="flex gap-2 border-t border-outline-variant/15 pt-4">
              <button type="button" onClick={() => setEditingUser(null)} disabled={editSaving} className="app-secondary-button h-11 flex-1">
                ยกเลิก
              </button>
              <button type="submit" disabled={editSaving} className="app-primary-button h-11 flex-1">
                {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                บันทึก
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
