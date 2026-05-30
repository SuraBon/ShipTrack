import type { Parcel } from '@/types/parcel';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { translateSystemNote } from '@/lib/translationUtils';
import { formatThaiDateTime } from '@/lib/dateUtils';
import { getCleanNote, DeliveryInfoRow } from './DashboardComponents';

export const DeliveryJobDetailsModal = ({
  parcel,
  open,
  onOpenChange,
}: {
  parcel: Parcel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  if (!parcel) return null;

  const note = translateSystemNote(getCleanNote(parcel));
  const itemDescription = parcel['รายละเอียด'] || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[88vh] w-[calc(100vw-1rem)] max-w-md overflow-hidden rounded-[1.5rem] border border-outline-variant bg-card p-0 shadow-2xl"
      >
        <div className="flex max-h-[88vh] flex-col">
          <div className="relative shrink-0 bg-primary px-5 py-4 text-primary-foreground">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="ปิดรายละเอียดงานส่ง"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
            </button>
            <DialogTitle className="pr-10 font-display text-lg font-black leading-tight text-white">
              รายละเอียดงานส่ง
            </DialogTitle>
            <p className="mt-1 break-all font-mono text-xs font-black tracking-wide text-blue-200">{parcel.TrackingID}</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-surface-container p-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-950">
              <p className="text-[10px] font-bold text-blue-600">ต้องไปส่งที่</p>
              <p className="mt-1 break-words font-display text-xl font-black leading-tight">
                {parcel['สาขาผู้รับ'] || '-'}
              </p>
              <p className="mt-1 text-xs font-semibold text-blue-700/80">ผู้รับ: {parcel['ผู้รับ'] || '-'}</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <DeliveryInfoRow icon="person" label="ผู้ส่ง" value={parcel['ผู้ส่ง']} tone="slate" />
              <DeliveryInfoRow icon="apartment" label="ต้นทาง" value={parcel['สาขาผู้ส่ง']} tone="slate" />
              <DeliveryInfoRow icon="person_check" label="ผู้รับ" value={parcel['ผู้รับ']} tone="blue" />
              <DeliveryInfoRow icon="flag" label="ปลายทาง" value={parcel['สาขาผู้รับ']} tone="blue" />
              <DeliveryInfoRow icon="inventory_2" label="สิ่งที่ส่ง" value={itemDescription} tone="emerald" />
              {note && <DeliveryInfoRow icon="sticky_note_2" label="หมายเหตุ" value={note} tone="orange" />}
              <DeliveryInfoRow icon="schedule" label="สร้างรายการเมื่อ" value={formatThaiDateTime(parcel['วันที่สร้าง'])} tone="slate" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
