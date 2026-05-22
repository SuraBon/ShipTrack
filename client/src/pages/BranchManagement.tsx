import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createBranch, deleteBranch, getBranches, loadBranches } from '@/lib/parcelService';

const MOBILE_BATCH_SIZE = 10;

export default function BranchManagement() {
  const [branches, setBranches] = useState<string[]>(() => getBranches());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [visibleCount, setVisibleCount] = useState(MOBILE_BATCH_SIZE);

  const refreshBranches = async () => {
    setLoading(true);
    const nextBranches = await loadBranches();
    setBranches(nextBranches);
    setLoading(false);
  };

  useEffect(() => {
    void refreshBranches();
  }, []);

  useEffect(() => {
    setVisibleCount(MOBILE_BATCH_SIZE);
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(branch => branch.toLowerCase().includes(q));
  }, [branches, search]);

  const visibleMobileBranches = filtered.slice(0, visibleCount);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const name = newBranch.trim();
    if (!name) {
      toast.error('กรุณากรอกชื่อแผนก/สาขา');
      return;
    }
    if (name.length > 100) {
      toast.error('ชื่อแผนก/สาขายาวเกินไป');
      return;
    }
    if (branches.some(branch => branch.toLowerCase() === name.toLowerCase())) {
      toast.error('มีแผนก/สาขานี้แล้ว');
      return;
    }

    setSaving(true);
    const res = await createBranch(name);
    setSaving(false);
    if (res.success) {
      const nextBranches = res.branches ?? await loadBranches();
      setBranches(nextBranches);
      setNewBranch('');
      toast.success('เพิ่มแผนก/สาขาสำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถเพิ่มแผนก/สาขาได้');
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`ลบ "${name}" ออกจากรายการแผนก/สาขา? ข้อมูลพัสดุเก่าจะไม่ถูกแก้ไข`)) return;
    setDeletingName(name);
    const res = await deleteBranch(name);
    setDeletingName(null);
    if (res.success) {
      const nextBranches = res.branches ?? await loadBranches();
      setBranches(nextBranches);
      toast.success('ลบแผนก/สาขาสำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถลบแผนก/สาขาได้');
    }
  };

  return (
    <div className="app-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="app-page-header">
        <div className="flex items-center gap-4">
          <div className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white md:flex">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="app-page-title">จัดการแผนก/สาขา</h1>
            <p className="app-page-subtitle">เพิ่มหรือลบ master list ที่ใช้ใน dropdown ของระบบ</p>
          </div>
        </div>
        <button onClick={refreshBranches} disabled={loading} className="app-secondary-button h-10 px-3">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          รีเฟรช
        </button>
      </div>

      <form onSubmit={handleCreate} className="app-panel grid gap-3 p-4 md:grid-cols-[1fr_auto]">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">ชื่อแผนก/สาขาใหม่</label>
          <input
            value={newBranch}
            onChange={event => setNewBranch(event.target.value)}
            disabled={saving}
            placeholder="เช่น Accounting - COM7 หรือ เดอะมอลล์บางกะปิ"
            className="app-input w-full"
          />
        </div>
        <button type="submit" disabled={saving} className="app-primary-button self-end">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          เพิ่ม
        </button>
      </form>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="ค้นหาแผนก/สาขา..."
          className="app-input w-full pl-10"
        />
      </div>

      <div className="app-panel overflow-hidden">
        <div className="border-b border-outline-variant/10 bg-surface-container-lowest/50 px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">
            แสดง {filtered.length} จาก {branches.length} รายการ
          </p>
        </div>

        {loading ? (
          <div className="grid place-items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            กำลังโหลด...
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <Building2 className="h-10 w-10 opacity-30" />
            ไม่พบแผนก/สาขา
          </div>
        ) : (
          <>
            <div className="divide-y divide-outline-variant/10 sm:hidden">
              {visibleMobileBranches.map(branch => (
                <div key={branch} className="flex items-center gap-3 p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{branch}</p>
                  <button
                    type="button"
                    onClick={() => handleDelete(branch)}
                    disabled={deletingName === branch}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    aria-label={`ลบ ${branch}`}
                  >
                    {deletingName === branch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">แผนก/สาขา</th>
                    <th className="w-24 px-5 py-3 text-right text-[11px] font-black uppercase tracking-widest text-muted-foreground">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filtered.map(branch => (
                    <tr key={branch} className="transition-colors hover:bg-surface-container-lowest/60">
                      <td className="px-5 py-4 text-sm font-semibold text-foreground">{branch}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(branch)}
                          disabled={deletingName === branch}
                          className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingName === branch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > visibleCount && (
              <div className="border-t border-outline-variant/10 p-3 sm:hidden">
                <button
                  type="button"
                  onClick={() => setVisibleCount(current => current + MOBILE_BATCH_SIZE)}
                  className="app-secondary-button h-10 w-full text-xs"
                >
                  แสดงเพิ่ม {Math.min(MOBILE_BATCH_SIZE, filtered.length - visibleCount)} รายการ
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
