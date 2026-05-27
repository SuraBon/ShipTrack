import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, ClipboardList, Loader2, MapPin, PackageCheck, StickyNote } from 'lucide-react';
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
  const gpsTitle = geoStatus === 'success'
    ? 'บันทึก GPS แล้ว'
    : geoStatus === 'loading'
      ? 'กำลังอ่านตำแหน่ง...'
      : 'ยังไม่มี GPS';
  const gpsDescription = geoStatus === 'success'
    ? `แม่นยำประมาณ ${Math.round(position?.accuracy || 0)} เมตร`
    : geoError || 'ใช้เป็นหลักฐานประกอบการส่งพร้อมกัน';

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
          <DialogHeader className="shrink-0 bg-slate-950 px-4 py-4 text-left text-white sm:px-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-sky-200">
                <PackageCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="font-display text-lg font-black text-white sm:text-xl">ยืนยันส่งพร้อมกัน</DialogTitle>
                <DialogDescription className="mt-1 text-xs font-semibold text-slate-300 sm:text-sm">
                  แนบรูปหลักฐานเดียวให้ {parcels.length} รายการ แล้วระบบจะบันทึกส่งสำเร็จพร้อมกัน
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="modal-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50 p-4 sm:space-y-4 sm:p-5">
            <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">รายการที่เลือก</p>
                  <p className="text-xs font-semibold text-slate-500">ตรวจเลขติดตามก่อนยืนยัน</p>
                </div>
              </div>
              <div className="mt-3 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
                {parcels.map(parcel => (
                  <code key={parcel.TrackingID} className="rounded-lg bg-slate-50 px-2 py-1 font-mono text-[10px] font-bold text-slate-600 ring-1 ring-slate-100">
                    {parcel.TrackingID}
                  </code>
                ))}
              </div>
            </section>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
                  <Camera className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">รูปหลักฐาน</p>
                  <p className="text-xs font-semibold text-slate-500">ใช้รูปเดียวกับทุกรายการที่เลือก</p>
                </div>
              </div>
              {previewUrl ? (
                <div className="relative h-48 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 sm:h-56">
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
                  className="grid min-h-[10.5rem] w-full place-items-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center transition hover:border-primary/40 hover:bg-gray-100 sm:min-h-44 sm:p-6"
                >
                  {isProcessingImage ? (
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-primary">
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      กำลังบีบอัดรูป...
                    </span>
                  ) : (
                    <span className="flex flex-col items-center gap-2 text-sm font-black text-slate-700 sm:text-base">
                      <Camera className="h-6 w-6" aria-hidden="true" />
                      แตะเพื่อถ่ายรูปหลักฐาน
                    </span>
                  )}
                </button>
              )}
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                    geoStatus === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{gpsTitle}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{gpsDescription}</p>
                  </div>
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
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <label className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900">
                <StickyNote className="h-4 w-4 text-orange-500" aria-hidden="true" />
                หมายเหตุเพิ่มเติม
              </label>
              <textarea
                value={note}
                onChange={(event) => setNote(sanitizeTextInput(event.target.value, 2000))}
                placeholder="ไม่บังคับ เช่น ส่งที่เคาน์เตอร์, ผู้รับฝากรับแทน"
                className="min-h-[4.5rem] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
              />
            </section>
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
                {submitting ? 'กำลังยืนยัน...' : geoStatus === 'loading' ? 'รอ GPS...' : `ยืนยันส่ง ${parcels.length} รายการ`}
              </span>
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default BatchConfirmDeliveryDialog;
