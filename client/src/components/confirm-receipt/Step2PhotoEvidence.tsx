import { Spinner } from '@/components/ui/spinner';
import { sanitizeTextInput } from '@/lib/validation';
import { confirmNavButtonClass, embeddedStepBodyClass, ParcelJobSummary } from './ConfirmReceiptShared';
import { useConfirmReceiptContext } from '@/contexts/ConfirmReceiptContext';

interface Step2PhotoEvidenceProps {
  embedded: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function Step2PhotoEvidence({
  embedded,
  fileInputRef,
}: Step2PhotoEvidenceProps) {
  const {
    checkedParcel,
    handleFileSelect,
    photoPreview,
    isProcessingImage,
    effectiveGeoStatus,
    position,
    geoError,
    isGpsBypassed,
    setIsGpsBypassed,
    requestLocation,
    needsGpsOverrideReason,
    gpsOverrideReason,
    setGpsOverrideReason,
    setCurrentStep,
    canProceedFromPhoto,
  } = useConfirmReceiptContext();
  return (
    <div className="animate-in slide-in-from-right-4 duration-500">
      <div className={embedded ? '' : 'app-panel overflow-hidden'}>
        {!embedded && (
          <div className="app-panel-header p-5 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <span className="material-symbols-outlined text-xl" aria-hidden="true">photo_camera</span>
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-primary">ถ่ายรูปหลักฐานการจัดส่ง</h2>
              <p className="text-xs text-on-surface-variant/60 mt-0.5">
                ถ่ายรูปสิ่งที่ส่งหรือหลักฐานการจัดส่ง (พัสดุ: {checkedParcel?.TrackingID})
              </p>
            </div>
          </div>
        )}
        <div className={embedded ? embeddedStepBodyClass : 'p-6 sm:p-8 space-y-6'}>
          {checkedParcel && <ParcelJobSummary parcel={checkedParcel} compact={embedded} />}

          <input
            ref={fileInputRef as any}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          {!photoPreview ? (
            <button
              type="button"
              disabled={isProcessingImage}
              onClick={() => fileInputRef.current?.click()}
              className="group relative w-full overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center transition-all hover:border-primary/40 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-75 sm:rounded-3xl sm:p-10 min-h-[11rem]"
            >
              {isProcessingImage ? (
                <>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-slate-900 transition-all">
                    <Spinner className="h-7 w-7" />
                  </div>
                  <p className="font-display text-lg font-black text-slate-950">กำลังบีบอัดรูปภาพ...</p>
                  <p className="mt-1 text-xs font-semibold text-on-surface-variant/60">กรุณารอสักครู่ขณะประมวลผลรูปภาพ</p>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-slate-900 transition-all group-hover:scale-105 group-hover:bg-slate-300">
                    <span className="material-symbols-outlined text-3xl transition-colors" aria-hidden="true">photo_camera</span>
                  </div>
                  <p className="font-display text-lg font-black text-slate-950">แตะเพื่อถ่ายรูป</p>
                  <p className="mt-1 text-xs font-semibold text-on-surface-variant/60">ระบบจะบีบอัดรูปให้อัตโนมัติ</p>
                </>
              )}
            </button>
          ) : (
            <div className="relative h-52 w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 sm:h-72">
              <img
                src={photoPreview}
                alt="หลักฐานการจัดส่ง"
                className="w-full h-full object-contain animate-in fade-in zoom-in-95 duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
              {isProcessingImage && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white gap-2">
                  <Spinner className="h-7 w-7" />
                  <span className="text-xs font-semibold">กำลังประมวลผล...</span>
                </div>
              )}
              <button
                type="button"
                disabled={isProcessingImage}
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-3 right-3 z-10 flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50 sm:bottom-4 sm:right-4"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">photo_camera</span>
                ถ่ายใหม่
              </button>
              <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-white/95 drop-shadow-md">
                <span className="material-symbols-outlined text-base" aria-hidden="true">verified</span>
                <span className="text-xs font-bold uppercase tracking-wider">แนบรูปถ่ายสำเร็จ</span>
              </div>
            </div>
          )}

          {/* GPS status panel */}
          <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 sm:space-y-4 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                    effectiveGeoStatus === 'success'
                      ? 'bg-green-500/10 text-green-600'
                      : needsGpsOverrideReason
                        ? 'bg-error/10 text-error'
                        : 'bg-amber-500/10 text-amber-600'
                  }`}
                >
                  {effectiveGeoStatus === 'loading' ? (
                    <Spinner className="h-5 w-5" />
                  ) : (
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                      {effectiveGeoStatus === 'success' ? 'my_location' : 'location_off'}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="font-display text-sm font-black text-primary">
                    {effectiveGeoStatus === 'success'
                      ? 'ระบุตำแหน่งสำเร็จ'
                      : effectiveGeoStatus === 'loading'
                        ? 'กำลังดึงตำแหน่ง...'
                        : 'ไม่พบตำแหน่ง'}
                  </p>
                  <p className="text-xs text-on-surface-variant/70 font-semibold leading-normal">
                    {effectiveGeoStatus === 'success'
                      ? `ตำแหน่งแม่นยำ ~${Math.round(position?.accuracy || 0)} เมตร`
                      : effectiveGeoStatus === 'loading'
                        ? 'กรุณารอสักครู่ กำลังระบุตำแหน่งเพื่อใช้เป็นหลักฐานการส่ง'
                        : geoError || 'ไม่สามารถดึงตำแหน่งได้'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                {/* Skip/Bypass GPS Button */}
                {!isGpsBypassed && effectiveGeoStatus !== 'success' && (
                  <button
                    type="button"
                    onClick={() => setIsGpsBypassed(true)}
                    className="w-full min-h-11 font-display text-xs font-black text-amber-600 hover:text-amber-700 border border-amber-200 hover:bg-amber-50 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] cursor-pointer sm:w-auto"
                  >
                    ข้ามระบุตำแหน่ง
                  </button>
                )}

                {/* GPS Retry Button */}
                {effectiveGeoStatus !== 'loading' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsGpsBypassed(false);
                      requestLocation();
                    }}
                    className="w-full min-h-11 font-display text-xs font-black text-primary hover:text-primary/95 border border-primary/20 hover:bg-primary/5 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] cursor-pointer sm:w-auto"
                  >
                    {isGpsBypassed ? 'เปิดระบุตำแหน่ง' : 'ลองดึงตำแหน่งใหม่'}
                  </button>
                )}
              </div>
            </div>

            {/* If bypassed / error / denied, we need a reason */}
            {needsGpsOverrideReason && (
              <div className="space-y-2 border-t border-outline-variant/10 pt-4 animate-in slide-in-from-top-2 duration-300">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-error px-1">
                  ระบุเหตุผลที่ยืนยันโดยไม่มีตำแหน่ง GPS <span className="text-error font-bold">*</span>
                </label>
                <textarea
                  placeholder="เช่น สัญญาณเน็ตล่ม, อยู่ในอาคารชั้นใต้ดิน, ลูกค้ามารับนอกพื้นที่..."
                  value={gpsOverrideReason}
                  onChange={(e) => setGpsOverrideReason(sanitizeTextInput(e.target.value, 300))}
                  className="min-h-[72px] w-full resize-none rounded-2xl border-2 border-error/20 bg-white px-3.5 py-2.5 font-display text-sm outline-none transition-all focus:border-error focus:ring-4 focus:ring-error/5 text-primary placeholder:text-on-surface-variant/40"
                />
              </div>
            )}
          </div>

          {/* Navigation controls */}
          <div className="grid grid-cols-1 gap-2 pt-1 min-[400px]:grid-cols-[0.9fr_1.4fr] sm:gap-3 sm:pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`${confirmNavButtonClass} border border-outline-variant/70 bg-white text-on-surface-variant shadow-sm hover:border-primary/30 hover:bg-surface-container-lowest hover:text-primary`}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl" aria-hidden="true">arrow_back</span>
              ย้อนกลับ
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              disabled={!canProceedFromPhoto}
              className={`${confirmNavButtonClass} group gap-2 bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.01] hover:bg-primary/95 disabled:scale-100 disabled:bg-on-surface-variant/30 disabled:shadow-none`}
            >
              ขั้นตอนถัดไป
              <span
                className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1 sm:text-2xl font-black"
                aria-hidden="true"
              >
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
