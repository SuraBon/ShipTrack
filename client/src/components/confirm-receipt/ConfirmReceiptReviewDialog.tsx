import { lazy, Suspense } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { resolveSelectValue } from '@/components/NativeSelect';
import type { DeliveryMatchStatus, Parcel } from '@/types/parcel';
import type { GeoPosition } from '@/hooks/useGeolocation';

const GpsPreviewMap = lazy(() => import('./GpsPreviewMap'));

type ConfirmReceiptReviewDialogProps = {
  isConfirmDialogOpen: boolean;
  setIsConfirmDialogOpen: (open: boolean) => void;
  isForwarding: boolean;
  isProxy: boolean;
  forwardSender: string;
  forwardFromBranch: string;
  forwardToBranch: string;
  proxyName: string;
  checkedParcel: Parcel | null;
  deliveryMatchStatus: DeliveryMatchStatus;
  deliveryMismatchReason: string;
  photoPreview: string | null;
  position: GeoPosition | null;
  gpsOverrideReason: string;
  note: string;
  trackingId: string;
  executeConfirm: () => void;
  isLoading: boolean;
};

export function ConfirmReceiptReviewDialog({
  isConfirmDialogOpen,
  setIsConfirmDialogOpen,
  isForwarding,
  isProxy,
  forwardSender,
  forwardFromBranch,
  forwardToBranch,
  proxyName,
  checkedParcel,
  deliveryMatchStatus,
  deliveryMismatchReason,
  photoPreview,
  position,
  gpsOverrideReason,
  note,
  trackingId,
  executeConfirm,
  isLoading,
}: ConfirmReceiptReviewDialogProps) {
  return (
    <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
      <DialogContent showCloseButton={false} className="w-[calc(100vw-1rem)] max-w-[92vw] sm:max-w-2xl max-h-[90vh] rounded-[1.75rem] p-0 border border-gray-100 shadow-2xl bg-white overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative flex items-center gap-4 bg-slate-950 px-6 py-6 text-white">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white shadow-sm">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
              {isForwarding ? 'fork_right' : isProxy ? 'account_circle' : 'check_circle'}
            </span>
          </div>
          <div className="flex-1">
            <DialogTitle className="font-display text-xl font-black leading-tight text-white">
              {isForwarding ? 'ยืนยันส่งต่อไปจุดถัดไป' : isProxy ? 'ยืนยันว่ามีผู้รับแทน' : 'ยืนยันว่าส่งถึงผู้รับแล้ว'}
            </DialogTitle>
            <p className="mt-1 text-xs font-semibold text-slate-300">กรุณาตรวจสอบข้อมูลก่อนยืนยัน</p>
          </div>
          <button
            onClick={() => setIsConfirmDialogOpen(false)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">close</span>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto bg-white px-5 py-5 space-y-4 sm:px-6">
          {/* Tracking ID row */}
          <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="material-symbols-outlined text-base" aria-hidden="true">barcode_scanner</span>
              <span className="text-xs font-bold">หมายเลขติดตาม</span>
            </div>
            <code className="min-w-0 break-all font-mono text-base font-black tracking-wider text-slate-900">{trackingId}</code>
          </div>

          {/* Forwarding details */}
          {isForwarding && (
            <div className="bg-secondary/5 rounded-2xl p-4 border border-secondary/15 space-y-3">
              <div className="flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined text-base" aria-hidden="true">person</span>
                <span className="text-xs font-bold">ผู้รับช่วงต่อ: <span className="text-primary">{forwardSender || '-'}</span></span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-outline-variant/20 text-center">
                  <p className="text-[9px] text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">จากแผนก/สาขา</p>
                  <p className="text-sm font-black text-primary truncate">
                    {resolveSelectValue(forwardFromBranch)}
                  </p>
                </div>
                <span className="material-symbols-outlined text-outline-variant text-xl shrink-0" aria-hidden="true">arrow_forward</span>
                <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-outline-variant/20 text-center">
                  <p className="text-[9px] text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">ส่งต่อไปที่</p>
                  <p className="text-sm font-black text-primary truncate">
                    {resolveSelectValue(forwardToBranch)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Proxy details */}
          {isProxy && (
            <div className="bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100 flex items-center gap-3">
              <span className="material-symbols-outlined text-blue-500 text-xl" aria-hidden="true">how_to_reg</span>
              <div>
                <p className="text-[10px] text-blue-600/70 font-bold uppercase tracking-wider">ผู้รับแทน</p>
                <p className="font-bold text-blue-900 text-sm">{proxyName || '-'}</p>
              </div>
            </div>
          )}

          {/* Normal receipt */}
          {!isForwarding && !isProxy && (
            <div className="bg-green-50 rounded-2xl px-4 py-3 border border-green-100 flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600 text-xl" aria-hidden="true">verified_user</span>
              <div>
                <p className="text-[10px] text-green-600/70 font-bold">ผู้รับ</p>
                <p className="font-bold text-green-900 text-sm">{checkedParcel?.['ผู้รับ'] || '-'}</p>
              </div>
            </div>
          )}

          {!isForwarding && (
            <div className={`rounded-2xl px-4 py-3 border flex items-start gap-3 ${
              deliveryMatchStatus === 'DELIVERED_ELSEWHERE'
                ? 'bg-amber-50 border-amber-100 text-amber-950'
                : 'bg-green-50 border-green-100 text-green-900'
            }`}>
              <span className="material-symbols-outlined text-xl" aria-hidden="true">
                {deliveryMatchStatus === 'DELIVERED_ELSEWHERE' ? 'move_location' : 'task_alt'}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">ยืนยันจุดส่งจริง</p>
                <p className="text-sm font-black">
                  {deliveryMatchStatus === 'DELIVERED_ELSEWHERE' ? 'ส่งคนละจุด / ฝากไว้ที่อื่น' : 'ส่งตรงตามปลายทางที่ระบุ'}
                </p>
                {deliveryMatchStatus === 'DELIVERED_ELSEWHERE' && (
                  <p className="mt-1 break-words text-xs font-semibold leading-snug opacity-80">
                    {deliveryMismatchReason || '-'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Photo preview */}
          {photoPreview && (
            <div className="group relative h-52 overflow-hidden rounded-2xl border border-gray-100 bg-slate-50 shadow-sm transition-all hover:border-slate-300 sm:h-64" onClick={() => {
              const w = window.open();
              if (!w) return;
              w.document.body.style.margin = '0';
              w.document.body.style.background = '#000';
              w.document.body.style.display = 'flex';
              w.document.body.style.alignItems = 'center';
              w.document.body.style.justifyContent = 'center';
              w.document.body.style.height = '100vh';
              const img = w.document.createElement('img');
              img.src = photoPreview;
              img.alt = 'หลักฐานการส่ง';
              img.style.maxWidth = '100%';
              img.style.maxHeight = '100%';
              img.style.objectFit = 'contain';
              w.document.body.appendChild(img);
            }}>
              <img src={photoPreview} alt="หลักฐาน" className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-white">
                  <span className="material-symbols-outlined" aria-hidden="true">zoom_in</span>
                  <span className="text-sm font-bold tracking-wide">คลิกเพื่อดูภาพขยาย</span>
                </div>
              </div>
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white pointer-events-none">
                <span className="material-symbols-outlined text-base shadow-sm" aria-hidden="true">photo_camera</span>
                <span className="text-xs font-bold uppercase tracking-wider drop-shadow-md">รูปหลักฐาน</span>
              </div>
            </div>
          )}

          {/* GPS Map Preview */}
          {position && (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-slate-50 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-2">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="material-symbols-outlined text-sm text-green-600" aria-hidden="true">my_location</span>
                  <span className="text-[10px] font-bold">ตำแหน่ง GPS ที่บันทึก</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
                </span>
              </div>
              <div className="h-32 w-full relative pointer-events-none">
                <Suspense fallback={<div className="grid h-full w-full place-items-center bg-slate-100 text-xs font-semibold text-slate-500">กำลังโหลดแผนที่...</div>}>
                  <GpsPreviewMap position={position} />
                </Suspense>
                <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] z-[400] pointer-events-none" />
              </div>
            </div>
          )}

          {!position && gpsOverrideReason && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-amber-950">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-xl" aria-hidden="true">location_off</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">ยืนยันโดยไม่มีตำแหน่ง GPS</p>
                  <p className="text-sm font-bold leading-snug">{gpsOverrideReason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Note */}
          {note && (
            <div className="bg-surface-container-low rounded-2xl px-4 py-3 border border-outline-variant/20">
              <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-wider mb-1">หมายเหตุ</p>
              <p className="text-sm text-on-surface italic">{note}</p>
            </div>
          )}
        </div>

        {/* Footer — sticky */}
        <div className="flex shrink-0 gap-3 border-t border-gray-100 bg-white px-5 pb-5 pt-3 sm:px-6">
          <button
            onClick={() => setIsConfirmDialogOpen(false)}
            className="h-12 flex-1 rounded-xl border border-gray-200 bg-white font-display font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            แก้ไข
          </button>
          <button
            onClick={executeConfirm}
            disabled={isLoading}
            className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-slate-950 font-display font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-900 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <>
                ยืนยันรายการ
                <span className="material-symbols-outlined text-xl" aria-hidden="true">verified</span>
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>

  );
}
