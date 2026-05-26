import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { lazy, Suspense, useState } from 'react';
import Timeline from '@/components/Timeline';
import { Spinner } from '@/components/ui/spinner';
import type { Parcel } from '@/types/parcel';
import type { TimelineEvent } from '@/types/timeline';

const TrackingMap = lazy(() => import('@/components/TrackingMap'));

const MapFallback = () => (
  <div className="grid h-[62vh] max-h-[560px] min-h-[340px] place-items-center rounded-2xl bg-white text-primary">
    <div className="flex flex-col items-center gap-3">
      <Spinner className="h-7 w-7" />
      <p className="text-sm font-black">กำลังโหลดแผนที่...</p>
    </div>
  </div>
);

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
}: ParcelTimelineModalProps) {
  const [isMapOpen, setIsMapOpen] = useState(false);

  if (!selectedParcel) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[380px] max-h-[86vh] overflow-hidden rounded-[22px] border-none bg-white p-0 shadow-[0_20px_50px_rgba(0,0,0,0.18)]" showCloseButton={false}>
        <div className="flex max-h-[86vh] flex-col">
          <DialogHeader className="relative shrink-0 bg-slate-900 px-5 py-4 text-white">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-3 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="ปิดรายละเอียดรายการส่ง"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
            </button>
            <DialogTitle className="pr-8 text-sm font-semibold leading-tight text-white">Milestone การจัดส่ง</DialogTitle>
            <p className="mt-1 min-w-0 pr-8 text-[10px] tracking-wide text-slate-400">
              <code className="font-mono font-semibold text-slate-400 break-all">{selectedParcel.TrackingID}</code>
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4">
            <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-500">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">route</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-gray-800">Milestone การจัดส่ง</p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-gray-400">ล่าสุดอยู่ด้านบน</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => hasKnownBranches && setIsMapOpen(true)}
                  disabled={!hasKnownBranches}
                  className="inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-2.5 text-[10px] font-medium text-gray-600 transition-all hover:bg-gray-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                  title={hasKnownBranches ? 'เปิดแผนที่' : 'ยังไม่มีตำแหน่ง GPS'}
                  aria-label={hasKnownBranches ? 'เปิดแผนที่' : 'ยังไม่มีตำแหน่ง GPS'}
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">{hasKnownBranches ? 'map' : 'map_off'}</span>
                  แผนที่
                </button>
              </div>
              <Timeline events={selectedTimelineEvents} compact />
            </div>
          </div>
        </div>
      </DialogContent>

      {isMapOpen && (
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100vw-1rem)] max-w-3xl overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white p-0 shadow-xl"
        >
          <div className="flex max-h-[92vh] flex-col">
            <div className="relative bg-slate-950 px-5 py-5 text-white">
              <button
                type="button"
                onClick={() => setIsMapOpen(false)}
                className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="ปิดแผนที่"
              >
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">close</span>
              </button>
              <DialogTitle className="pr-12 font-display text-xl font-black leading-tight text-white">
                แผนที่การจัดส่ง
              </DialogTitle>
              <p className="mt-1 break-all font-mono text-sm font-black tracking-wide text-blue-200">{selectedParcel.TrackingID}</p>
            </div>
            <div className="bg-white p-4">
              <Suspense fallback={<MapFallback />}>
                <TrackingMap
                  events={selectedTimelineEvents}
                  className="h-[62vh] max-h-[560px] min-h-[340px] rounded-2xl"
                  mapClassName="min-h-0"
                />
              </Suspense>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}
    </Dialog>
  );
}
