import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import type { Parcel } from '@/types/parcel';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBranches } from '@/hooks/useBranches';

type EditParcelForm = {
  senderName: string;
  senderBranch: string;
  receiverName: string;
  receiverBranch: string;
  description: string;
};

type AdminEditParcelDialogProps = {
  parcel: Parcel | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (updates: EditParcelForm) => Promise<void>;
};

const getParcelValue = (parcel: Parcel | null, key: string) => {
  return parcel ? String(((parcel as unknown) as Record<string, unknown>)[key] || '') : '';
};

const toForm = (parcel: Parcel | null): EditParcelForm => ({
  senderName: getParcelValue(parcel, 'ผู้ส่ง'),
  senderBranch: getParcelValue(parcel, 'สาขาผู้ส่ง'),
  receiverName: getParcelValue(parcel, 'ผู้รับ'),
  receiverBranch: getParcelValue(parcel, 'สาขาผู้รับ'),
  description: getParcelValue(parcel, 'รายละเอียด'),
});

export function AdminEditParcelDialog({
  parcel,
  open,
  saving,
  onOpenChange,
  onSubmit,
}: AdminEditParcelDialogProps) {
  const { branches } = useBranches();
  const [form, setForm] = useState<EditParcelForm>(() => toForm(parcel));

  useEffect(() => {
    if (open) setForm(toForm(parcel));
  }, [open, parcel]);

  const hasChanges = useMemo(() => {
    const original = toForm(parcel);
    return Object.keys(original).some((key) => {
      const field = key as keyof EditParcelForm;
      return form[field].trim() !== original[field].trim();
    });
  }, [form, parcel]);

  const updateField = (field: keyof EditParcelForm, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      senderName: form.senderName.trim(),
      senderBranch: form.senderBranch.trim(),
      receiverName: form.receiverName.trim(),
      receiverBranch: form.receiverBranch.trim(),
      description: form.description.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-hidden rounded-2xl border border-outline-variant bg-card p-0 shadow-2xl">
        <form onSubmit={handleSubmit} className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-outline-variant px-5 py-4 text-left">
            <DialogTitle className="font-display text-xl text-primary">แก้ไขข้อมูลพัสดุ</DialogTitle>
            <DialogDescription>
              Tracking ID <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">{parcel?.TrackingID || '-'}</code>
            </DialogDescription>
          </DialogHeader>

          <div className="modal-scroll grid gap-4 overflow-y-auto p-5 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600">ผู้ส่ง</span>
              <input
                value={form.senderName}
                onChange={(event) => updateField('senderName', event.target.value)}
                className="app-input"
                maxLength={200}
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600">สาขาผู้ส่ง</span>
              <input
                value={form.senderBranch}
                onChange={(event) => updateField('senderBranch', event.target.value)}
                list="admin-edit-branches"
                className="app-input"
                maxLength={200}
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600">ผู้รับ</span>
              <input
                value={form.receiverName}
                onChange={(event) => updateField('receiverName', event.target.value)}
                className="app-input"
                maxLength={200}
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600">สาขาผู้รับ</span>
              <input
                value={form.receiverBranch}
                onChange={(event) => updateField('receiverBranch', event.target.value)}
                list="admin-edit-branches"
                className="app-input"
                maxLength={200}
                required
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-bold text-slate-600">รายละเอียด</span>
              <textarea
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                className="app-input min-h-24 resize-none"
                maxLength={200}
              />
            </label>
            <datalist id="admin-edit-branches">
              {branches.map(branch => <option key={branch} value={branch} />)}
            </datalist>
          </div>

          <DialogFooter className="border-t border-outline-variant px-5 py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="app-secondary-button h-10 px-4 text-sm"
              disabled={saving}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="app-primary-button h-10 px-4 text-sm"
              disabled={saving || !hasChanges}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              บันทึก
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AdminEditParcelDialog;
