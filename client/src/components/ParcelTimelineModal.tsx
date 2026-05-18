import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';
import Timeline from '@/components/Timeline';
import TrackingMap from '@/components/TrackingMap';
import type { Parcel } from '@/types/parcel';
import type { TimelineEvent } from '@/types/timeline';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/roles';
import { applyDerivedStatus } from '@/lib/parcelStatus';

interface ParcelTimelineModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedParcel: Parcel | null;
  selectedTimelineEvents: TimelineEvent[];
  hasKnownBranches: boolean;
  onConfirmParcel: (trackingId: string) => void;
  onDeleteParcel: () => void;
}

export default function ParcelTimelineModal({
  isOpen,
  setIsOpen,
  selectedParcel,
  selectedTimelineEvents,
  hasKnownBranches,
  onConfirmParcel,
}: ParcelTimelineModalProps) {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const canConfirmParcel = role === 'ADMIN' || role === 'MESSENGER';
  const [isMapOpen, setIsMapOpen] = useState(false);

  if (!selectedParcel) return null;

  // Use derived status so forwarded parcels show correctly
  const derivedParcel = applyDerivedStatus(selectedParcel);
  const isActuallyDelivered = derivedParcel['สถานะ'] === 'ส่งสำเร็จ';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-full max-w-[92vw] sm:max-w-3xl max-h-[88vh] overflow-hidden p-0 rounded-2xl border-none shadow-2xl" showCloseButton={false}>
        <div className="flex flex-col max-h-[88vh]">
          <DialogHeader className="shrink-0 p-4 sm:p-5 text-white"
            style={{ background: 'linear-gradient(135deg, #0d1f3c 0%, #091426 100%)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base sm:text-lg font-black font-display text-white leading-tight">ลำดับการจัดส่ง</DialogTitle>
                <p className="mt-1 min-w-0 text-xs leading-tight text-white/55">
                  หมายเลขติดตาม: <code className="font-mono text-white/80 font-bold break-all">{selectedParcel.TrackingID}</code>
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2">
                {canConfirmParcel && !isActuallyDelivered && (
                  <button
                    onClick={() => { setIsOpen(false); onConfirmParcel(selectedParcel.TrackingID); }}
                    className="hidden items-center gap-1.5 px-3 py-2 bg-secondary text-primary rounded-xl font-display font-bold text-xs hover:opacity-90 active:scale-95 transition-all sm:flex"
                  >
                    <span className="material-symbols-outlined text-base">add_a_photo</span>
                    บันทึกผลการส่ง
                  </button>
                )}
                <button onClick={() => setIsOpen(false)}
                  className="p-1.5 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                  <span className="material-symbols-outlined text-white text-lg">close</span>
                </button>
              </div>
            </div>
            {canConfirmParcel && !isActuallyDelivered && (
              <div className="mt-3 flex justify-start">
                <button
                  onClick={() => { setIsOpen(false); onConfirmParcel(selectedParcel.TrackingID); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-primary rounded-xl font-display font-bold text-xs hover:opacity-90 active:scale-95 transition-all sm:hidden"
                >
                  <span className="material-symbols-outlined text-base">add_a_photo</span>
                  บันทึกผลการส่ง
                </button>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto bg-background p-3 sm:p-4">
            <div className="rounded-3xl border border-outline-variant/20 bg-white p-3 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-on-surface-variant/45">
                    <span className="material-symbols-outlined text-sm">route</span>
                    ลำดับการจัดส่ง
                  </p>
                  <p className="mt-1 text-xs font-semibold text-on-surface-variant/55">เรียงจากเหตุการณ์ล่าสุดไปยังจุดเริ่มต้น</p>
                </div>
                <button
                  type="button"
                  onClick={() => hasKnownBranches && setIsMapOpen(true)}
                  disabled={!hasKnownBranches}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-outline-variant/25 bg-white px-3 text-xs font-black text-primary transition-all hover:border-primary/30 hover:bg-primary/5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                  title={hasKnownBranches ? 'เปิดแผนที่' : 'ยังไม่มีพิกัด GPS'}
                  aria-label={hasKnownBranches ? 'เปิดแผนที่' : 'ยังไม่มีพิกัด GPS'}
                >
                  <span className="material-symbols-outlined text-[18px]">{hasKnownBranches ? 'map' : 'map_off'}</span>
                  แผนที่
                </button>
              </div>
              <Timeline events={selectedTimelineEvents} compact />
            </div>
          </div>
        </div>
      </DialogContent>

      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100vw-1rem)] max-w-3xl overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-2xl"
        >
          <div className="bg-transparent p-2 sm:p-3">
            <div className="relative">
              <div className="pointer-events-none absolute bottom-12 left-3 z-[500] inline-flex items-center gap-2 rounded-2xl bg-primary/90 px-3 py-2 text-white shadow-lg backdrop-blur-sm sm:bottom-auto sm:left-4 sm:top-4">
                <span className="material-symbols-outlined text-lg text-secondary">map</span>
                <span className="text-sm font-black">แผนที่การจัดส่ง</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMapOpen(false)}
                className="absolute right-3 top-3 z-[500] grid h-11 w-11 place-items-center rounded-2xl bg-white text-primary shadow-lg shadow-black/20 transition-all hover:bg-secondary active:scale-95"
                aria-label="ปิดแผนที่"
              >
                <span className="material-symbols-outlined text-2xl font-black">close</span>
              </button>
              <TrackingMap
                events={selectedTimelineEvents}
                className="h-[62vh] max-h-[560px] min-h-[340px] rounded-2xl"
                mapClassName="min-h-0"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
