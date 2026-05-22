import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { lazy, Suspense, useState } from 'react';
import Timeline from '@/components/Timeline';
import type { Parcel } from '@/types/parcel';
import type { TimelineEvent } from '@/types/timeline';

const TrackingMap = lazy(() => import('@/components/TrackingMap'));

const MapFallback = () => (
  <div className="grid h-[62vh] max-h-[560px] min-h-[340px] place-items-center rounded-2xl bg-white text-primary">
    <div className="flex flex-col items-center gap-3">
      <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
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
              aria-label="ปิดรายละเอียดพัสดุ"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
            <DialogTitle className="pr-8 text-sm font-semibold leading-tight text-white">ลำดับการจัดส่ง</DialogTitle>
            <p className="mt-1 min-w-0 pr-8 text-[10px] tracking-wide text-slate-400">
              <code className="font-mono font-semibold text-slate-400 break-all">{selectedParcel.TrackingID}</code>
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4">
            <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-500">
                    <span className="material-symbols-outlined text-sm">route</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800">สถานะล่าสุด</p>
                    <p className="mt-0.5 truncate text-[10px] text-gray-400">เรียงจากล่าสุด</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => hasKnownBranches && setIsMapOpen(true)}
                  disabled={!hasKnownBranches}
                  className="inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-2.5 text-[10px] font-medium text-gray-600 transition-all hover:bg-gray-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                  title={hasKnownBranches ? 'เปิดแผนที่' : 'ยังไม่มีพิกัด GPS'}
                  aria-label={hasKnownBranches ? 'เปิดแผนที่' : 'ยังไม่มีพิกัด GPS'}
                >
                  <span className="material-symbols-outlined text-sm">{hasKnownBranches ? 'map' : 'map_off'}</span>
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
          className="w-[calc(100vw-1rem)] max-w-3xl overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-2xl"
        >
          <DialogTitle className="sr-only">แผนที่การจัดส่ง</DialogTitle>
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
