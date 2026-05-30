import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, Edit3, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createBranch, deleteBranch, renameBranch } from '@/lib/parcelService';
import { useBranches } from '@/hooks/useBranches';
import EmptyState from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
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

const MOBILE_BATCH_SIZE = 10;

export default function BranchManagement() {
  const { branches, loading, refreshBranches } = useBranches();
  const [saving, setSaving] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);
  const [branchToEdit, setBranchToEdit] = useState<string | null>(null);
  const [editBranchName, setEditBranchName] = useState('');
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [visibleCount, setVisibleCount] = useState(MOBILE_BATCH_SIZE);

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
      if (!res.branches) await refreshBranches();
      setNewBranch('');
      toast.success('เพิ่มแผนก/สาขาสำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถเพิ่มแผนก/สาขาได้');
    }
  };

  const handleDelete = async (name: string) => {
    setDeletingName(name);
    const res = await deleteBranch(name);
    setDeletingName(null);
    if (res.success) {
      setBranchToDelete(null);
      if (!res.branches) await refreshBranches();
      toast.success('ลบแผนก/สาขาสำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถลบแผนก/สาขาได้');
    }
  };

  const handleEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!branchToEdit) return;
    const oldName = branchToEdit;
    const newName = editBranchName.trim();
    if (!newName) {
      toast.error('กรุณากรอกชื่อแผนก/สาขา');
      return;
    }
    if (newName.length > 100) {
      toast.error('ชื่อแผนก/สาขายาวเกินไป');
      return;
    }
    if (oldName.toLowerCase() === newName.toLowerCase()) {
      setBranchToEdit(null);
      return;
    }
    if (branches.some(b => b.toLowerCase() === newName.toLowerCase() && b.toLowerCase() !== oldName.toLowerCase())) {
      toast.error('มีแผนก/สาขานี้แล้ว');
      return;
    }

    setEditing(true);
    const res = await renameBranch(oldName, newName);
    setEditing(false);
    if (res.success) {
      setBranchToEdit(null);
      if (!res.branches) await refreshBranches();
      toast.success('แก้ไขแผนก/สาขาสำเร็จ');
    } else {
      toast.error(res.error || 'ไม่สามารถแก้ไขแผนก/สาขาได้');
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
            <p className="app-page-subtitle">เพิ่มหรือลบรายการตัวเลือกที่ใช้ในเมนูเลือกของระบบ</p>
          </div>
        </div>
        <button onClick={refreshBranches} disabled={loading} className="app-secondary-button h-10 px-3">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          รีเฟรช
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-[320px_1fr] lg:grid-cols-[380px_1fr] items-start">
        {/* Left Column: Create Form & Search */}
        <div className="space-y-4">
          <form onSubmit={handleCreate} className="app-panel flex flex-col gap-4 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Plus className="h-4 w-4 text-primary" aria-hidden="true" />
              เพิ่มแผนก/สาขาใหม่
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">ชื่อแผนก/สาขา</label>
              <input
                value={newBranch}
                onChange={event => setNewBranch(event.target.value)}
                disabled={saving}
                placeholder="เช่น Accounting - COM7"
                className="app-input w-full"
              />
            </div>
            <button type="submit" disabled={saving} className="app-primary-button w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              เพิ่มแผนก/สาขา
            </button>
          </form>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="ค้นหาแผนก/สาขา..."
              className="app-input w-full pl-10"
            />
          </div>
        </div>

        {/* Right Column: Branch List */}
        <div className="app-panel overflow-hidden">
          <div className="border-b border-outline-variant/10 bg-surface-container-lowest/50 px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground">
              แสดง {filtered.length} จาก {branches.length} รายการ
            </p>
          </div>

          <div className="sm:hidden">
            {loading ? (
              <div className="divide-y divide-outline-variant/10">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                    <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                    <Skeleton className="h-5 w-3/4 rounded-md" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Building2 className="h-7 w-7 text-slate-400" />}
                  title="ไม่พบแผนก/สาขา"
                  description="ไม่พบแผนกหรือสาขาที่ตรงกับเงื่อนไขการค้นหา"
                />
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {visibleMobileBranches.map(branch => (
                  <div key={branch} className="flex items-center gap-3 p-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{branch}</div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setBranchToEdit(branch);
                          setEditBranchName(branch);
                        }}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-50"
                        aria-label={`แก้ไข ${branch}`}
                      >
                        <Edit3 className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setBranchToDelete(branch)}
                        disabled={deletingName === branch}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        aria-label={`ลบ ${branch}`}
                      >
                        {deletingName === branch ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                {loading ? (
                  <>
                    {[...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 py-4"><Skeleton className="h-5 w-48 rounded-md" /></td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Skeleton className="h-9 w-16 rounded-lg animate-pulse" />
                            <Skeleton className="h-9 w-16 rounded-lg animate-pulse" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-4">
                      <EmptyState
                        icon={<Building2 className="h-7 w-7 text-slate-400" />}
                        title="ไม่พบแผนก/สาขา"
                        description="ไม่พบแผนกหรือสาขาที่ตรงกับเงื่อนไขการค้นหา"
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map(branch => (
                    <tr key={branch} className="transition-colors hover:bg-surface-container-lowest/60">
                      <td className="px-5 py-4 text-sm font-semibold text-foreground">{branch}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setBranchToEdit(branch);
                              setEditBranchName(branch);
                            }}
                            className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                          >
                            <Edit3 className="h-4 w-4" aria-hidden="true" />
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => setBranchToDelete(branch)}
                            disabled={deletingName === branch}
                            className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingName === branch ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
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
        </div>
      </div>



      <AlertDialog open={!!branchToDelete} onOpenChange={(open) => !open && setBranchToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border border-outline-variant bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary">ลบแผนก/สาขา</AlertDialogTitle>
            <AlertDialogDescription>
              ลบ “{branchToDelete}” ออกจากรายการตัวเลือกเท่านั้น ข้อมูลรายการส่งและประวัติเก่าที่ใช้ชื่อนี้จะไม่ถูกแก้ไข
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingName} className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={!branchToDelete || !!deletingName}
              onClick={(event) => {
                event.preventDefault();
                if (branchToDelete) void handleDelete(branchToDelete);
              }}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              {deletingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />}
              ลบถาวร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!branchToEdit} onOpenChange={(open) => !open && !editing && setBranchToEdit(null)}>
        <DialogContent className="rounded-2xl border border-outline-variant bg-white">
          <DialogHeader>
            <DialogTitle className="text-primary">แก้ไขแผนก/สาขา</DialogTitle>
            <DialogDescription>
              แก้ไขชื่อแผนกหรือสาขาในระบบ ข้อมูลเก่าจะไม่ได้รับผลกระทบ
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="grid gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">ชื่อแผนก/สาขา</label>
              <input
                value={editBranchName}
                onChange={event => setEditBranchName(event.target.value)}
                disabled={editing}
                placeholder="เช่น Accounting - COM7"
                className="app-input w-full"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBranchToEdit(null)}
                disabled={editing}
                className="app-secondary-button rounded-xl px-4"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={editing}
                className="app-primary-button rounded-xl px-4"
              >
                {editing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Edit3 className="mr-2 h-4 w-4" aria-hidden="true" />}
                บันทึก
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
