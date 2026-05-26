import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Ban, Edit3, Loader2, Plus, RefreshCw, Search, ShieldCheck, Trash2, Truck, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { createUser, deleteUser, disableUser, getUsers, updateUser, updateUserRole, type UserRow } from '@/lib/parcelService';
import { SYSTEM_ROLES, type AppRole, type SystemRole } from '@/lib/roles';
import { isValidEmployeeId, normalizeEmployeeId, sanitizeTextInput, validatePassword, validateRequiredText } from '@/lib/validation';

const USER_MOBILE_BATCH_SIZE = 10;
const USER_DESKTOP_PAGE_SIZE = 20;

type PendingUserAction = {
  type: 'disable' | 'delete';
  user: UserRow;
} | null;

const ROLE_CONFIG: Record<AppRole, { label: string; icon: React.ReactNode }> = {
  ADMIN: { label: 'ผู้ดูแลระบบ', icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> },
  MESSENGER: { label: 'พนักงานส่ง', icon: <Truck className="h-3.5 w-3.5" aria-hidden="true" /> },
  GUEST: { label: 'ไม่มีสิทธิ์พนักงาน', icon: <UserX className="h-3.5 w-3.5" aria-hidden="true" /> },
};

function StatusBadge({ status }: { status?: UserRow['status'] }) {
  const disabled = status === 'DISABLED';
  return (
    <span className={`inline-flex h-7 items-center rounded-lg px-2.5 text-xs font-semibold ${
      disabled ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
    }`}>
      {disabled ? 'ปิดใช้งาน' : 'ใช้งานอยู่'}
    </span>
  );
}

function RoleDropdown({
  value,
  onChange,
  disabled,
}: {
  value: AppRole;
  onChange: (role: SystemRole) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value === 'ADMIN' ? 'ADMIN' : 'MESSENGER'}
      onChange={event => onChange(event.target.value as SystemRole)}
      disabled={disabled}
      className="h-9 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {SYSTEM_ROLES.map(role => (
        <option key={role} value={role}>{ROLE_CONFIG[role].label}</option>
      ))}
    </select>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AppRole | 'DISABLED'>('ALL');
  const [userPage, setUserPage] = useState(1);
  const [mobileVisibleUsers, setMobileVisibleUsers] = useState(USER_MOBILE_BATCH_SIZE);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: 'MESSENGER' as SystemRole, password: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingUserAction, setPendingUserAction] = useState<PendingUserAction>(null);
  const [newUser, setNewUser] = useState({
    employeeId: '',
    name: '',
    role: 'MESSENGER' as SystemRole,
    password: '',
  });

  const fetchUsers = async () => {
    setLoading(true);
    const res = await getUsers();
    if (res.success && res.users) {
      setUsers(res.users);
    } else {
      toast.error(res.error || 'ไม่สามารถดึงข้อมูลผู้ใช้ได้');
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const filtered = useMemo(() => users.filter(u => {
    const q = search.trim().toLowerCase();
    if (roleFilter === 'DISABLED' && u.status !== 'DISABLED') return false;
    if (roleFilter !== 'ALL' && roleFilter !== 'DISABLED' && u.role !== roleFilter) return false;
    if (!q) return true;
    return [u.employeeId, u.name, u.role, u.status ?? 'ACTIVE']
      .some(value => String(value).toLowerCase().includes(q));
  }), [roleFilter, search, users]);

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
  }, [totalUserPages, userPage]);

  const counts = {
    total: users.length,
    admin: users.filter(u => u.role === 'ADMIN').length,
    messenger: users.filter(u => u.role === 'MESSENGER').length,
    disabled: users.filter(u => u.status === 'DISABLED').length,
  };

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    const employeeId = normalizeEmployeeId(newUser.employeeId);
    const name = sanitizeTextInput(newUser.name, 100);
    const password = newUser.password.trim();
    const nameError = validateRequiredText(name, 'ชื่อ-นามสกุล', 1, 100);
    const passwordError = validatePassword(password, 100);

    if (!isValidEmployeeId(employeeId)) {
      toast.error('รหัสพนักงานต้องใช้ A-Z, 0-9 หรือ _ เท่านั้น');
      return;
    }
    if (nameError || passwordError) {
      toast.error(nameError || passwordError || 'กรุณาตรวจสอบข้อมูลผู้ใช้');
      return;
    }

    setCreatingUser(true);
    const res = await createUser({ employeeId, name, role: newUser.role, password });
    setCreatingUser(false);
    if (res.success && res.user) {
      setUsers(prev => [res.user!, ...prev.filter(user => user.employeeId !== employeeId)]);
      setNewUser({ employeeId: '', name: '', role: 'MESSENGER', password: '' });
      toast.success('สร้างผู้ใช้สำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถสร้างผู้ใช้ได้');
    }
  };

  const handleRoleChange = async (employeeId: string, newRole: SystemRole) => {
    if (employeeId === currentUser?.employeeId) {
      toast.error('ไม่สามารถเปลี่ยนสิทธิ์ของตนเองได้');
      return;
    }
    setUpdatingId(employeeId);
    const res = await updateUserRole(employeeId, newRole);
    setUpdatingId(null);
    if (res.success) {
      setUsers(prev => prev.map(u => u.employeeId === employeeId ? { ...u, role: newRole } : u));
      toast.success('เปลี่ยนสิทธิ์ผู้ใช้สำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถเปลี่ยนสิทธิ์ได้');
    }
  };

  const openEditUser = (target: UserRow) => {
    setEditingUser(target);
    setEditForm({
      name: target.name,
      role: target.role === 'ADMIN' ? 'ADMIN' : 'MESSENGER',
      password: '',
    });
  };

  const handleSaveUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    const name = sanitizeTextInput(editForm.name, 100);
    const password = editForm.password.trim();
    const nameError = validateRequiredText(name, 'ชื่อ-นามสกุล', 1, 100);
    const passwordError = password ? validatePassword(password, 100) : undefined;
    if (nameError || passwordError) {
      toast.error(nameError || passwordError || 'กรุณาตรวจสอบข้อมูลผู้ใช้');
      return;
    }

    setEditSaving(true);
    const res = await updateUser({
      targetId: editingUser.employeeId,
      name,
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
    setDeletingId(target.employeeId);
    const res = await disableUser(target.employeeId);
    setDeletingId(null);
    if (res.success && res.user) {
      setUsers(prev => prev.map(u => u.employeeId === res.user!.employeeId ? res.user! : u));
      setPendingUserAction(null);
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
    setDeletingId(target.employeeId);
    const res = await deleteUser(target.employeeId);
    setDeletingId(null);
    if (res.success) {
      setUsers(prev => prev.filter(u => u.employeeId !== target.employeeId));
      setPendingUserAction(null);
      toast.success('ลบผู้ใช้สำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถลบผู้ใช้ได้');
    }
  };

  const renderActions = (u: UserRow, compact = false) => {
    const isSelf = u.employeeId === currentUser?.employeeId;
    const busy = deletingId === u.employeeId;
    return (
      <div className={`flex flex-wrap ${compact ? 'gap-2' : 'justify-end gap-1.5'}`}>
        <button type="button" onClick={() => openEditUser(u)} className="app-secondary-button h-9 px-3 text-xs">
          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" /> แก้ไข
        </button>
        {!isSelf && (
          <>
            <button
              type="button"
              onClick={() => setPendingUserAction({ type: 'disable', user: u })}
              disabled={busy || u.status === 'DISABLED'}
              className="app-secondary-button h-9 px-3 text-xs"
            >
              {busy && pendingUserAction?.type === 'disable' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Ban className="h-3.5 w-3.5" aria-hidden="true" />}
              ปิดบัญชี
            </button>
            <button
              type="button"
              onClick={() => setPendingUserAction({ type: 'delete', user: u })}
              disabled={busy}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {busy && pendingUserAction?.type === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              ลบ
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="app-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="app-page-header">
        <div className="flex items-center gap-4">
          <div className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white md:flex">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="app-page-title">จัดการพนักงาน</h1>
            <p className="app-page-subtitle">สร้าง แก้ไข ปิดบัญชี และกำหนดสิทธิ์ผู้ดูแลระบบ/พนักงานส่ง</p>
          </div>
        </div>
        <button onClick={fetchUsers} disabled={loading} className="app-secondary-button h-10 px-3">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          รีเฟรช
        </button>
      </div>

      <form onSubmit={handleCreateUser} className="app-panel grid gap-3 p-4 lg:grid-cols-[1fr_1.5fr_0.9fr_1fr_auto]">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Plus className="h-4 w-4" aria-hidden="true" />
            สร้างผู้ใช้ใหม่
          </div>
        </div>
        <input value={newUser.employeeId} onChange={e => setNewUser(v => ({ ...v, employeeId: normalizeEmployeeId(e.target.value) }))} disabled={creatingUser} placeholder="รหัสพนักงาน" className="app-input uppercase" />
        <input value={newUser.name} onChange={e => setNewUser(v => ({ ...v, name: e.target.value }))} disabled={creatingUser} placeholder="ชื่อ-นามสกุล" className="app-input" />
        <select value={newUser.role} onChange={e => setNewUser(v => ({ ...v, role: e.target.value as SystemRole }))} disabled={creatingUser} className="app-input font-medium">
          {SYSTEM_ROLES.map(role => <option key={role} value={role}>{ROLE_CONFIG[role].label}</option>)}
        </select>
        <input type="password" value={newUser.password} onChange={e => setNewUser(v => ({ ...v, password: e.target.value }))} disabled={creatingUser} placeholder="รหัสผ่านเริ่มต้น" className="app-input" />
        <button type="submit" disabled={creatingUser} className="app-primary-button">
          {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          สร้าง
        </button>
      </form>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { key: 'ALL' as const, label: 'ทั้งหมด', value: counts.total, icon: <Users className="h-4 w-4" aria-hidden="true" /> },
          { key: 'ADMIN' as const, label: 'ผู้ดูแลระบบ', value: counts.admin, icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" /> },
          { key: 'MESSENGER' as const, label: 'พนักงานส่ง', value: counts.messenger, icon: <Truck className="h-4 w-4" aria-hidden="true" /> },
          { key: 'DISABLED' as const, label: 'ปิดใช้งาน', value: counts.disabled, icon: <UserX className="h-4 w-4" aria-hidden="true" /> },
        ].map(s => (
          <button
            key={s.label}
            type="button"
            onClick={() => setRoleFilter(s.key)}
            className={`app-compact-card flex items-center gap-3 text-left transition-all active:scale-[0.99] ${
              roleFilter === s.key ? 'border-primary ring-2 ring-ring/10' : 'hover:bg-muted/40'
            }`}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">{s.icon}</div>
            <div>
              <p className="text-xl font-semibold leading-none text-foreground sm:text-2xl">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาด้วยรหัสพนักงาน ชื่อ หรือสิทธิ์..." className="app-input w-full pl-10" />
      </div>

      <div className="app-panel overflow-hidden">
        <div className="sm:hidden">
          {loading ? (
            <div className="grid place-items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground"><Users className="h-10 w-10 opacity-30" aria-hidden="true" />ไม่พบผู้ใช้</div>
          ) : (
            <>
              <div className="divide-y divide-outline-variant/10">
                {visibleMobileUsers.map(u => {
                  const isSelf = u.employeeId === currentUser?.employeeId;
                  return (
                    <div key={u.employeeId} className={`p-4 ${isSelf ? 'bg-slate-50' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-base font-black uppercase text-slate-700">{u.name.charAt(0)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <code className="truncate font-mono text-sm font-black text-primary">{u.employeeId}</code>
                            {isSelf && <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary/60">คุณ</span>}
                          </div>
                          <p className="mt-1 truncate text-base font-black leading-tight text-on-surface">{u.name}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <RoleDropdown value={u.role} onChange={(role) => handleRoleChange(u.employeeId, role)} disabled={isSelf || updatingId === u.employeeId} />
                            <StatusBadge status={u.status} />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pl-14">{renderActions(u, true)}</div>
                    </div>
                  );
                })}
              </div>
              {filtered.length > mobileVisibleUsers && (
                <div className="border-t border-outline-variant/10 p-3">
                  <button type="button" onClick={() => setMobileVisibleUsers(v => v + USER_MOBILE_BATCH_SIZE)} className="app-secondary-button h-10 w-full text-xs">
                    แสดงเพิ่ม {Math.min(USER_MOBILE_BATCH_SIZE, filtered.length - mobileVisibleUsers)} รายการ
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">รหัสพนักงาน</th>
                <th className="px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">ชื่อ-นามสกุล</th>
                <th className="px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">สิทธิ์</th>
                <th className="px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">สถานะ</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-black uppercase tracking-widest text-muted-foreground">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr><td colSpan={5} className="py-16 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" aria-hidden="true" />กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-2 h-10 w-10 opacity-30" aria-hidden="true" />ไม่พบผู้ใช้</td></tr>
              ) : paginatedUsers.map(u => {
                const isSelf = u.employeeId === currentUser?.employeeId;
                return (
                  <tr key={u.employeeId} className={`transition-colors ${isSelf ? 'bg-primary/[0.03]' : 'hover:bg-surface-container-lowest/60'}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm font-black text-primary">{u.employeeId}</code>
                        {isSelf && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary/60">คุณ</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-container text-xs font-black uppercase text-on-surface-variant">{u.name.charAt(0)}</div>
                        <span className="text-sm font-bold text-on-surface">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">{updatingId === u.employeeId ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" /> : <RoleDropdown value={u.role} onChange={(role) => handleRoleChange(u.employeeId, role)} disabled={isSelf} />}</td>
                    <td className="px-5 py-4"><StatusBadge status={u.status} /></td>
                    <td className="px-5 py-4">{renderActions(u)}</td>
                  </tr>
                );
              })}
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
                <button onClick={() => setUserPage(page => Math.max(1, page - 1))} disabled={userPage === 1} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30" aria-label="ไปหน้าก่อนหน้า">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_left</span>
                </button>
                <span className="px-2 text-xs font-black text-primary">{userPage}/{totalUserPages}</span>
                <button onClick={() => setUserPage(page => Math.min(totalUserPages, page + 1))} disabled={userPage === totalUserPages} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30" aria-label="ไปหน้าถัดไป">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white p-0 shadow-xl">
          <DialogHeader className="relative bg-slate-950 px-5 py-5 text-white">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="ปิดแก้ไขผู้ใช้"
            >
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">close</span>
            </button>
            <div className="flex items-center gap-3 pr-12">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white">แก้ไขผู้ใช้</DialogTitle>
                <DialogDescription className="text-xs font-semibold text-slate-300">แก้ชื่อ สิทธิ์ หรือเปลี่ยนรหัสผ่าน</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleSaveUser} className="space-y-4 px-5 py-4">
            <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">รหัสพนักงาน</label><input value={editingUser?.employeeId ?? ''} disabled className="app-input w-full opacity-70" /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">ชื่อ-นามสกุล</label><input value={editForm.name} onChange={event => setEditForm(v => ({ ...v, name: event.target.value }))} disabled={editSaving} className="app-input w-full" /></div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">สิทธิ์</label>
              <select value={editForm.role} onChange={event => setEditForm(v => ({ ...v, role: event.target.value as SystemRole }))} disabled={editSaving || editingUser?.employeeId === currentUser?.employeeId} className="app-input w-full">
                {SYSTEM_ROLES.map(role => <option key={role} value={role}>{ROLE_CONFIG[role].label}</option>)}
              </select>
            </div>
            <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">รหัสผ่านใหม่ (ไม่กรอก = ไม่เปลี่ยน)</label><input type="password" value={editForm.password} onChange={event => setEditForm(v => ({ ...v, password: event.target.value }))} disabled={editSaving} className="app-input w-full" /></div>
            <div className="flex gap-2 border-t border-outline-variant/15 pt-4">
              <button type="button" onClick={() => setEditingUser(null)} disabled={editSaving} className="app-secondary-button h-11 flex-1">ยกเลิก</button>
              <button type="submit" disabled={editSaving} className="app-primary-button h-11 flex-1">{editSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}บันทึก</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingUserAction} onOpenChange={(open) => !open && setPendingUserAction(null)}>
        <AlertDialogContent className="rounded-2xl border border-outline-variant bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary">
              {pendingUserAction?.type === 'delete' ? 'ลบผู้ใช้ถาวร' : 'ปิดบัญชีผู้ใช้'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUserAction?.type === 'delete'
                ? `ลบผู้ใช้ ${pendingUserAction.user.employeeId} ถาวร บัญชีนี้จะถูกลบออกจาก Users sheet และไม่สามารถเข้าสู่ระบบได้อีก`
                : `ปิดบัญชี ${pendingUserAction?.user.employeeId} ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานในอนาคต`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId} className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingUserAction || !!deletingId}
              onClick={(event) => {
                event.preventDefault();
                if (!pendingUserAction) return;
                void (pendingUserAction.type === 'delete' ? handleDeleteUser(pendingUserAction.user) : handleDisableUser(pendingUserAction.user));
              }}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              {deletingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : pendingUserAction?.type === 'delete' ? <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> : <Ban className="mr-2 h-4 w-4" aria-hidden="true" />}
              {pendingUserAction?.type === 'delete' ? 'ลบถาวร' : 'ปิดบัญชี'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
