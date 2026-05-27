import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Loader2, PackageCheck } from 'lucide-react';
import type { Parcel } from '@/types/parcel';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useProofImage } from '@/hooks/useProofImage';
import { useGeolocation } from '@/hooks/useGeolocation';
import { sanitizeTextInput } from '@/lib/validation';
import { buildGpsEvidenceNote, needsGpsOverrideReason } from '@/lib/gpsQuality';

type BatchConfirmDeliveryDialogProps = {
  open: boolean;
  parcels: Parcel[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    photoUrl: string;
    note: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<boolean>;
};

export function BatchConfirmDeliveryDialog({
  open,
  parcels,
  submitting,
  onOpenChange,
  onSubmit,
}: BatchConfirmDeliveryDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { imageUrl, previewUrl, isProcessingImage, processImageFile, clearImage } = useProofImage();
  const { position, status: geoStatus, errorMessage: geoError, requestLocation } = useGeolocation();
  const [note, setNote] = useState('');
  const [gpsOverrideReason, setGpsOverrideReason] = useState('');

  const needsOverride = needsGpsOverrideReason(geoStatus);
  const canSubmit = Boolean(imageUrl)
    && !isProcessingImage
    && !submitting
    && geoStatus !== 'loading'
    && (!needsOverride || gpsOverrideReason.trim().length > 0);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const processed = await processImageFile(file);
    if (processed && geoStatus === 'idle') requestLocation();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!imageUrl || !canSubmit) return;
    const finalNote = [
      sanitizeTextInput(note, 2000),
      ...buildGpsEvidenceNote({ status: geoStatus, position, overrideReason: sanitizeTextInput(gpsOverrideReason, 300) }),
    ].filter(Boolean).join(' ');
    const submitted = await onSubmit({
      photoUrl: imageUrl,
      note: finalNote,
      latitude: position?.latitude,
      longitude: position?.longitude,
    });
    if (!submitted) return;
    clearImage();
    setNote('');
    setGpsOverrideReason('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (submitting) return;
    if (!nextOpen) {
      clearImage();
      setNote('');
      setGpsOverrideReason('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,100vh)] w-[calc(100vw-0.75rem)] max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-0 shadow-2xl sm:w-[calc(100vw-1rem)]">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0 border-b border-gray-100 px-4 py-3 text-left sm:px-5 sm:py-4">
            <DialogTitle className="font-display text-lg text-primary sm:text-xl">ส่งสำเร็จพร้อมกัน</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              ถ่ายรูปเดียวแนบให้ {parcels.length} รายการ
            </DialogDescription>
          </DialogHeader>

          <div className="modal-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:space-y-4 sm:p-5">
            <div className="rounded-xl bg-slate-50 p-2.5 sm:rounded-2xl sm:p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">รายการที่เลือก</p>
              <div className="mt-1.5 flex max-h-16 flex-wrap gap-1 overflow-y-auto sm:max-h-20">
                {parcels.map(parcel => (
                  <code key={parcel.TrackingID} className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 ring-1 ring-slate-100 sm:rounded-lg sm:px-2 sm:py-1">
                    {parcel.TrackingID}
                  </code>
                ))}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            {previewUrl ? (
              <div className="relative h-48 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 sm:h-56 sm:rounded-2xl">
                <img src={previewUrl} alt="หลักฐานการส่งพร้อมกัน" className="h-full w-full object-contain" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white active:scale-95 sm:text-sm"
                >
                  ถ่ายใหม่
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isProcessingImage}
                onClick={() => fileInputRef.current?.click()}
                className="grid min-h-[10.5rem] w-full place-items-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center transition hover:border-primary/40 hover:bg-gray-100 sm:min-h-44 sm:rounded-2xl sm:p-6"
              >
                {isProcessingImage ? (
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-primary">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    กำลังบีบอัดรูป...
                  </span>
                ) : (
                  <span className="text-sm font-black text-slate-700 sm:text-base">แตะเพื่อถ่ายรูปหลักฐาน</span>
                )}
              </button>
            )}

            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:rounded-2xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800">
                    {geoStatus === 'success' ? 'ระบุตำแหน่งสำเร็จ' : geoStatus === 'loading' ? 'กำลังดึงตำแหน่ง...' : 'ยังไม่มีตำแหน่ง'}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    {geoStatus === 'success' ? `แม่นยำ ~${Math.round(position?.accuracy || 0)} เมตร` : geoError || 'ใช้เป็นหลักฐานประกอบการส่ง'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="app-secondary-button h-11 w-full shrink-0 px-4 text-xs sm:w-auto sm:min-w-[6.5rem]"
                >
                  ดึง GPS
                </button>
              </div>
              {needsOverride && (
                <textarea
                  value={gpsOverrideReason}
                  onChange={(event) => setGpsOverrideReason(sanitizeTextInput(event.target.value, 300))}
                  placeholder="ระบุเหตุผลที่ยืนยันโดยไม่มี GPS"
                  className="min-h-[4.5rem] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
                />
              )}
            </div>

            <textarea
              value={note}
              onChange={(event) => setNote(sanitizeTextInput(event.target.value, 2000))}
              placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
              className="min-h-[4.5rem] w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
            />
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-gray-100 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-5 sm:py-4">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="app-secondary-button order-2 min-h-12 w-full px-4 text-sm sm:order-1 sm:w-auto"
              disabled={submitting}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="app-primary-button order-1 min-h-12 w-full gap-2 px-4 text-sm sm:order-2 sm:w-auto"
              disabled={!canSubmit}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PackageCheck className="h-4 w-4 shrink-0" aria-hidden="true" />}
              <span className="truncate">
                {geoStatus === 'loading' ? 'รอ GPS...' : `ยืนยันส่ง ${parcels.length} รายการ`}
              </span>
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default BatchConfirmDeliveryDialog;
