import { useState, useEffect, useRef } from 'react';
import { createUser, getUsers, updateUserRole, UserRow } from '@/lib/parcelService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SYSTEM_ROLES, type AppRole, type SystemRole } from '@/lib/roles';
import { isValidEmployeeId, normalizeEmployeeId, sanitizeTextInput, validatePassword, validateRequiredText } from '@/lib/validation';
import { Loader2, Plus, Search, RefreshCw, Users, ShieldCheck, Truck, UserX } from 'lucide-react';

const ROLE_CONFIG: Record<AppRole, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  ADMIN: {
    label: 'Admin',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  MESSENGER: {
    label: 'Messenger จัดส่ง',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Truck className="h-3.5 w-3.5" />,
  },
  GUEST: {
    label: 'ไม่มีสิทธิ์พนักงาน',
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    icon: <UserX className="h-3.5 w-3.5" />,
  },
};

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
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all
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
        <div className="absolute z-50 bottom-full mb-1 left-0 w-40 bg-white rounded-2xl border border-outline-variant/30 shadow-xl overflow-hidden py-1">
          {SYSTEM_ROLES.map(role => {
            const c = ROLE_CONFIG[role];
            return (
              <button
                key={role}
                type="button"
                onClick={() => { onChange(role); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-colors
                  ${value === role ? `${c.bg} ${c.color}` : 'hover:bg-surface-container-lowest text-on-surface'}`}
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
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    employeeId: '',
    name: '',
    branch: '',
    role: 'MESSENGER' as SystemRole,
    password: '',
  });

  useEffect(() => { fetchUsers(); }, []);

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
    const branchError = validateRequiredText(branch, 'สาขา', 1, 100);
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

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    return (
      u.employeeId.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.branch.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const counts = {
    total: users.length,
    admin: users.filter(u => u.role === 'ADMIN').length,
    messenger: users.filter(u => u.role === 'MESSENGER').length,
    guest: users.filter(u => u.role === 'GUEST').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
          </div>
          <div>
            <h1 className="text-2xl font-black font-display text-primary">จัดการพนักงาน</h1>
            <p className="text-sm text-on-surface-variant">ตั้งค่าและมอบหมายสิทธิ์การใช้งานระบบ</p>
          </div>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/40 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      <form
        onSubmit={handleCreateUser}
        className="grid gap-3 rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-sm lg:grid-cols-[1fr_1.4fr_1.2fr_0.9fr_1fr_auto]"
      >
        <div className="lg:col-span-6">
          <div className="flex items-center gap-2 text-sm font-black text-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            สร้างผู้ใช้ใหม่
          </div>
        </div>
        <input
          value={newUser.employeeId}
          onChange={e => setNewUser(current => ({ ...current, employeeId: normalizeEmployeeId(e.target.value) }))}
          disabled={creatingUser}
          placeholder="รหัสพนักงาน"
          className="h-11 rounded-xl border border-outline-variant/40 bg-white px-3 text-sm font-bold uppercase outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
        <input
          value={newUser.name}
          onChange={e => setNewUser(current => ({ ...current, name: e.target.value }))}
          disabled={creatingUser}
          placeholder="ชื่อ-นามสกุล"
          className="h-11 rounded-xl border border-outline-variant/40 bg-white px-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
        <input
          value={newUser.branch}
          onChange={e => setNewUser(current => ({ ...current, branch: e.target.value }))}
          disabled={creatingUser}
          placeholder="สาขา"
          className="h-11 rounded-xl border border-outline-variant/40 bg-white px-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
        <select
          value={newUser.role}
          onChange={e => setNewUser(current => ({ ...current, role: e.target.value as SystemRole }))}
          disabled={creatingUser}
          className="h-11 rounded-xl border border-outline-variant/40 bg-white px-3 text-sm font-bold outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
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
          className="h-11 rounded-xl border border-outline-variant/40 bg-white px-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={creatingUser}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
        >
          {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          สร้าง
        </button>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'ALL' as const, label: 'ทั้งหมด', value: counts.total, icon: <Users className="h-5 w-5" />, color: 'text-primary', bg: 'bg-primary/10' },
          { key: 'ADMIN' as const, label: 'Admin', value: counts.admin, icon: <ShieldCheck className="h-5 w-5" />, color: 'text-rose-600', bg: 'bg-rose-50' },
          { key: 'MESSENGER' as const, label: 'Messenger จัดส่ง', value: counts.messenger, icon: <Truck className="h-5 w-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { key: 'GUEST' as const, label: 'ไม่มีสิทธิ์พนักงาน', value: counts.guest, icon: <UserX className="h-5 w-5" />, color: 'text-slate-500', bg: 'bg-slate-50' },
        ].map(s => (
          <button
            key={s.label}
            type="button"
            onClick={() => setRoleFilter(s.key)}
            className={`bg-white rounded-2xl border p-4 flex items-center gap-3 text-left shadow-sm transition-all active:scale-[0.99] ${
              roleFilter === s.key
                ? 'border-primary/45 ring-2 ring-primary/10'
                : 'border-outline-variant/30 hover:border-primary/25 hover:shadow-md'
            }`}
            aria-pressed={roleFilter === s.key}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-black text-primary leading-none">{s.value}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{s.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/40" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาด้วยรหัสพนักงาน ชื่อ สาขา หรือสิทธิ์..."
          className="w-full h-11 pl-11 pr-4 bg-white border border-outline-variant/40 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
      </div>

      {/* Users */}
      <div className="bg-white border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
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
            <div className="divide-y divide-outline-variant/10">
              {filtered.map(u => {
                const isSelf = u.employeeId === currentUser?.employeeId;
                const isUpdating = updatingId === u.employeeId;
                return (
                  <div key={u.employeeId} className={`p-4 ${isSelf ? 'bg-primary/[0.03]' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-base font-black uppercase text-primary">
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-lowest border-b border-outline-variant/20">
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">รหัสพนักงาน</th>
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">ชื่อ-นามสกุล</th>
                <th className="px-5 py-3.5 text-[11px] font-black text-on-surface-variant/60 uppercase tracking-widest">สาขา</th>
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
                filtered.map(u => {
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-outline-variant/10 bg-surface-container-lowest/50">
            <p className="text-xs text-on-surface-variant/50 font-bold">
              แสดง {filtered.length} จาก {users.length} รายการ
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
