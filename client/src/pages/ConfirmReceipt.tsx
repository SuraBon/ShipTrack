/**
 * Confirm Receipt Page
 * ยืนยันส่งสำเร็จด้วยรูปภาพ
 * Design: Premium Stepper UI
 */

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useParcelStore } from '@/hooks/useParcelStore';
import { getBranches, getParcel } from '@/lib/parcelService';
import NativeSelect, { resolveSelectValue } from '@/components/NativeSelect';
import { toast } from 'sonner';
import type { DeliveryMatchStatus, Parcel } from '@/types/parcel';
import { useGeolocation } from '@/hooks/useGeolocation';
import { MapView } from '@/components/Map';
import { isValidTrackingId, sanitizeTextInput } from '@/lib/validation';
import { getErrorMessage } from '@/lib/apiErrorHelper';
import { buildGpsEvidenceNote, getGpsQuality, needsGpsOverrideReason as shouldRequireGpsOverrideReason } from '@/lib/gpsQuality';
import { processProofImageFile } from '@/lib/imageProofHelper';
import { buildDeliveryActionPayload, getCurrentBranchFromParcel, isParcelTrulyDelivered } from '@/lib/deliveryActionBuilder';


/** Rendered outside the main component so it never remounts on state changes. */
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center mb-8 sm:mb-10">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-500 font-display font-bold text-base sm:text-lg ${
            currentStep === step
              ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-110'
              : currentStep > step
                ? 'bg-green-500 text-white'
                : 'bg-surface-container text-on-surface-variant/40'
          }`}>
            {currentStep > step
              ? <span className="material-symbols-outlined text-xl sm:text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              : step}
          </div>
          {step < 3 && (
            <div className="w-8 sm:w-12 h-1 mx-1 sm:mx-2 rounded-full overflow-hidden bg-surface-container">
              <div className={`h-full bg-green-500 transition-all duration-500 ${currentStep > step ? 'w-full' : 'w-0'}`} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ParcelJobSummary({ parcel }: { parcel: Parcel }) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-3 text-left">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/55">งานส่งนี้</p>
          <p className="truncate font-display text-base font-black leading-tight text-primary">ผู้รับ: {parcel['ผู้รับ'] || '-'}</p>
        </div>
        <code className="shrink-0 rounded-lg bg-white px-2 py-1 font-mono text-[11px] font-black text-primary shadow-sm ring-1 ring-outline-variant/10">
          {parcel.TrackingID}
        </code>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <div className="min-w-0 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-outline-variant/10">
          <div className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-on-surface-variant/50">
            <span className="material-symbols-outlined text-[13px]">package_2</span>
            ต้นทาง
          </div>
          <p className="truncate text-sm font-black leading-tight text-primary">{parcel['สาขาผู้ส่ง'] || '-'}</p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-on-surface-variant/60">{parcel['ผู้ส่ง'] || '-'}</p>
        </div>
        <div className="grid w-8 place-items-center text-primary">
          <span className="material-symbols-outlined text-xl">arrow_forward</span>
        </div>
        <div className="min-w-0 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-outline-variant/10">
          <div className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-on-surface-variant/50">
            <span className="material-symbols-outlined text-[13px]">flag</span>
            ปลายทาง
          </div>
          <p className="truncate text-sm font-black leading-tight text-primary">{parcel['สาขาผู้รับ'] || '-'}</p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-on-surface-variant/60">ผู้รับ: {parcel['ผู้รับ'] || '-'}</p>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmReceipt({
  initialTrackingId,
  onInitialTrackingIdConsumed,
  autoCheckInitial = false,
  autoOpenCamera = false,
  embedded = false,
  onComplete,
  onPreparingCameraChange,
}: {
  initialTrackingId?: string | null;
  onInitialTrackingIdConsumed?: () => void;
  autoCheckInitial?: boolean;
  autoOpenCamera?: boolean;
  embedded?: boolean;
  onComplete?: () => void;
  onPreparingCameraChange?: (isPreparing: boolean) => void;
}) {
  const { confirmReceipt, updateParcelLocally, loadParcels } = useParcelStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const branches = getBranches();

  // Steps: 1 (Check), 2 (Photo), 3 (Confirm)
  const [currentStep, setCurrentStep] = useState(1);
  const [trackingId, setTrackingId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const { position, status: geoStatus, errorMessage: geoError, requestLocation, reset: resetGeo } = useGeolocation();

  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardSender, setForwardSender] = useState('');
  const [forwardFromBranch, setForwardFromBranch] = useState('');
  const [forwardToBranch, setForwardToBranch] = useState('');
  const [isProxy, setIsProxy] = useState(false);
  const [proxyName, setProxyName] = useState('');
  const [deliveryMatchStatus, setDeliveryMatchStatus] = useState<DeliveryMatchStatus>('MATCHED_DECLARED_DESTINATION');
  const [deliveryMismatchReason, setDeliveryMismatchReason] = useState('');
  const [gpsOverrideReason, setGpsOverrideReason] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isAutoPreparingCamera, setIsAutoPreparingCamera] = useState(false);
  const [checkedParcel, setCheckedParcel] = useState<Parcel | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isDelivered, setIsDelivered] = useState(false);

  const gpsQuality = getGpsQuality(geoStatus, position);
  const hasLowAccuracyGps = gpsQuality === 'low_accuracy';
  const needsGpsOverrideReason = shouldRequireGpsOverrideReason(geoStatus);
  const canProceedFromPhoto = Boolean(photoPreview) && (
    geoStatus === 'success' ||
    (needsGpsOverrideReason && gpsOverrideReason.trim().length > 0)
  );

  useEffect(() => {
    onPreparingCameraChange?.(isAutoPreparingCamera);
  }, [isAutoPreparingCamera, onPreparingCameraChange]);

  // Re-request GPS whenever entering step 2 (handles back-navigation from step 3)
  useEffect(() => {
    if (currentStep === 2 && geoStatus === 'idle') {
      requestLocation();
    }
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoading) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLoading]);

  const checkParcelByTrackingId = async (rawTrackingId: string, shouldOpenCamera = false) => {
    const safeTrackingId = sanitizeTextInput(rawTrackingId, 100).toUpperCase();
    if (!safeTrackingId) {
      toast.error('กรุณากรอกหมายเลขติดตามก่อนตรวจสอบ');
      return;
    }
    if (!isValidTrackingId(safeTrackingId)) {
      toast.error('รูปแบบหมายเลขติดตามไม่ถูกต้อง');
      return;
    }

    setIsChecking(true);
    try {
      const res = await getParcel(safeTrackingId);
      if (res.success && res.parcel) {
        const p = res.parcel;

        setForwardFromBranch(getCurrentBranchFromParcel(p, branches));

        setCheckedParcel(p);
        setDeliveryMatchStatus('MATCHED_DECLARED_DESTINATION');
        setDeliveryMismatchReason('');

        const actuallyDelivered = isParcelTrulyDelivered(p);
        setIsDelivered(actuallyDelivered);

        if (actuallyDelivered) {
          toast.warning(`พัสดุนี้ถูกจัดส่งถึงที่หมายเรียบร้อยแล้ว`);
        } else {
          toast.success(`พบข้อมูลพัสดุ ต้องส่งไปที่: ${p['สาขาผู้รับ']}`);
          setCurrentStep(2); // Auto move to photo step
          requestLocation(); // Request GPS automatically on step 2
          if (shouldOpenCamera) {
            setTimeout(() => fileInputRef.current?.click(), 250);
          }
        }
      } else {
        toast.error('ไม่พบข้อมูลพัสดุ หรือหมายเลขติดตามไม่ถูกต้อง');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการตรวจสอบ');
    } finally {
      setIsChecking(false);
    }
  };

  const handleCheckParcel = async () => {
    await checkParcelByTrackingId(trackingId);
  };

  // Auto-fill tracking ID เมื่อถูกเปิดจาก Dashboard และตรวจสอบทันที
  useEffect(() => {
    if (!initialTrackingId) return;

    const safeTrackingId = sanitizeTextInput(initialTrackingId, 100).toUpperCase();
    setCurrentStep(1);
    setTrackingId(safeTrackingId);
    setPhotoUrl('');
    setPhotoPreview(null);
    setNote('');
    setIsForwarding(false);
    setForwardSender('');
    setForwardFromBranch('');
    setForwardToBranch('');
    setIsProxy(false);
    setProxyName('');
    setGpsOverrideReason('');
    setShowAdvancedOptions(false);
    setDeliveryMatchStatus('MATCHED_DECLARED_DESTINATION');
    setDeliveryMismatchReason('');
    setCheckedParcel(null);
    setIsDelivered(false);
    setIsConfirmDialogOpen(false);
    resetGeo();
    if (fileInputRef.current) fileInputRef.current.value = '';

    onInitialTrackingIdConsumed?.();
    if (autoCheckInitial) {
      setIsAutoPreparingCamera(true);
      setTimeout(() => {
        void checkParcelByTrackingId(safeTrackingId, autoOpenCamera)
          .finally(() => setIsAutoPreparingCamera(false));
      }, 0);
    }
  }, [initialTrackingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePasteTrackingID = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const safeText = sanitizeTextInput(text, 100).toUpperCase();
      if (safeText) {
        setTrackingId(safeText);
        toast.success('วางหมายเลขติดตามเรียบร้อย');
      }
    } catch {
      toast.error('ไม่สามารถวางข้อมูลได้');
    }
  };

  const processImageFile = async (file: File) => {
    try {
      const image = await processProofImageFile(file);
      setPhotoPreview(image.dataUrl);
      setPhotoUrl(image.dataUrl);
      toast.success('แนบรูปหลักฐานแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ'));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processImageFile(file);
  };

  const executeConfirm = async () => {
    if (isLoading) return;
    setIsConfirmDialogOpen(false);
    setIsLoading(true);
    try {
      const safeGpsOverrideReason = sanitizeTextInput(gpsOverrideReason, 300);
      const actionPayload = checkedParcel
        ? buildDeliveryActionPayload(checkedParcel, {
            note,
            isForwarding,
            forwardSender,
            forwardFromBranch,
            forwardToBranch,
            isProxy,
            proxyName,
            deliveryMatchStatus,
            deliveryMismatchReason,
          })
        : null;

      const validationError =
        !photoUrl ? 'กรุณาแนบรูปหลักฐาน' :
        needsGpsOverrideReason && !safeGpsOverrideReason ? 'กรุณาระบุเหตุผลที่ยืนยันโดยไม่มี GPS' :
        !actionPayload ? 'กรุณาตรวจสอบพัสดุก่อนยืนยัน' :
        actionPayload.validationError || null;

      if (validationError) {
        toast.error(validationError);
        setIsLoading(false);
        return;
      }
      if (!actionPayload) {
        setIsLoading(false);
        return;
      }

      const finalTrackingId = sanitizeTextInput(trackingId, 100).toUpperCase();
      const finalEventType = actionPayload.eventType;
      
      // Optimistic Update
      const newStatus = isForwarding ? 'กำลังจัดส่ง' : 'ส่งสำเร็จ';
      if (typeof updateParcelLocally === 'function') {
        updateParcelLocally(finalTrackingId, { 'สถานะ': newStatus });
      }

      toast.success('กำลังบันทึกการจัดส่ง...');
      
      const finalNote = [
        actionPayload.note,
        ...buildGpsEvidenceNote({ status: geoStatus, position, overrideReason: safeGpsOverrideReason }),
      ].filter(Boolean).join(' ');

      const response = await confirmReceipt(
        finalTrackingId,
        photoUrl,
        finalNote,
        position?.latitude,
        position?.longitude,
        finalEventType,
        actionPayload.location,
        actionPayload.destLocation,
        actionPayload.person,
        actionPayload.deliveryMatchStatus,
        actionPayload.deliveryMismatchReason
      );
      
      if (response && response.success) {
        toast.success('บันทึกการจัดส่งเรียบร้อยแล้ว');
        // Reset all state
        setCurrentStep(1);
        setTrackingId('');
        setPhotoUrl('');
        setPhotoPreview(null);
        setNote('');
        setIsForwarding(false);
        setForwardSender('');
        setForwardFromBranch('');
        setForwardToBranch('');
        setIsProxy(false);
        setProxyName('');
        setGpsOverrideReason('');
        setShowAdvancedOptions(false);
        setDeliveryMatchStatus('MATCHED_DECLARED_DESTINATION');
        setDeliveryMismatchReason('');
        setCheckedParcel(null);
        setIsDelivered(false);
        resetGeo();
        onComplete?.();
      } else {
        toast.error(response?.error ? `เกิดข้อผิดพลาด: ${response.error}` : 'ไม่สามารถบันทึกการจัดส่งได้ กรุณาลองใหม่');
        // Revert local update
        if (typeof loadParcels === 'function') loadParcels(undefined, true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`${embedded ? 'max-w-none pb-4' : 'max-w-2xl mx-auto pb-20'} space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700`}>
      {/* Header Section */}
      <div className={`${embedded ? 'hidden' : 'text-center space-y-2 mb-8 sm:mb-10'}`}>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">งานส่งพัสดุ</h1>
        <p className="text-xs sm:text-sm text-on-surface-variant">สแกนหรือกรอกหมายเลข แล้วดูต้นทาง ปลายทาง และผู้รับทันที</p>
      </div>

      {!embedded && <StepIndicator currentStep={currentStep} />}

      {isLoading && createPortal(
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
          </div>
          <p className="text-lg font-bold text-primary font-display">กำลังบันทึกการจัดส่ง...</p>
          <p className="text-on-surface-variant text-sm">กรุณารอสักครู่ ระบบกำลังประมวลผล</p>
        </div>,
        document.body
      )}

      {isAutoPreparingCamera && currentStep === 1 && (
        <div className="rounded-3xl border border-outline-variant bg-white p-8 text-center shadow-xl animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
          </div>
          <h2 className="font-display text-xl font-black text-primary">กำลังเปิดกล้อง...</h2>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant/60">ระบบกำลังตรวจสอบพัสดุและเตรียมถ่ายรูปหลักฐาน</p>
        </div>
      )}

      {/* Step 1: Check Tracking ID */}
      {currentStep === 1 && !isAutoPreparingCamera && (
        <div className="bg-white border border-outline-variant rounded-3xl overflow-hidden shadow-xl animate-in slide-in-from-right-4 duration-500">
          <div className="bg-surface-container-low/30 p-5 sm:p-8 border-b border-outline-variant/10 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>search</span>
            </div>
            <h2 className="font-display text-xl font-bold text-primary">ระบุหมายเลขติดตาม</h2>
            <p className="text-xs text-on-surface-variant uppercase font-bold tracking-widest mt-1">กรอกหมายเลขติดตามเพื่อดูต้นทาง ปลายทาง และผู้รับ</p>
          </div>
          <div className="p-5 sm:p-8 space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <input
                  placeholder="เช่น TRK20260420001"
                  value={trackingId}
                  onChange={(e) => setTrackingId(sanitizeTextInput(e.target.value, 100).toUpperCase())}
                  className="w-full h-14 sm:h-16 text-xl sm:text-2xl font-mono tracking-[0.2em] pl-6 pr-14 rounded-2xl border-2 border-outline-variant focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-primary placeholder:text-outline-variant placeholder:font-sans placeholder:text-base sm:placeholder:text-lg placeholder:tracking-normal"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handlePasteTrackingID}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all"
                  title="วางจากคลิปบอร์ด"
                >
                  <span className="material-symbols-outlined text-2xl">content_paste</span>
                </button>
              </div>

              {checkedParcel && isDelivered && (
                <div className="p-4 bg-error-container/30 border border-error/10 rounded-2xl text-error text-sm flex items-start gap-3 animate-in shake duration-300">
                  <span className="material-symbols-outlined text-xl">block</span>
                  <div>
                    <p className="font-bold">พัสดุนี้ถูกจัดส่งถึงที่หมายแล้ว</p>
                    <p className="opacity-80">ไม่สามารถยืนยันซ้ำได้ กรุณาตรวจสอบ ID อีกครั้ง</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCheckParcel}
              disabled={isChecking || !trackingId || isDelivered}
              className="w-full group flex items-center justify-center gap-3 h-16 bg-primary text-white rounded-2xl font-display font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              {isChecking ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  กำลังตรวจสอบ...
                </>
              ) : (
                <>
                  ดูงานส่งนี้
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Photo Evidence */}
      {currentStep === 2 && (
        <div className="overflow-hidden rounded-3xl border border-outline-variant bg-white shadow-xl animate-in slide-in-from-right-4 duration-500">
          <div className="border-b border-outline-variant/10 bg-surface-container-low/30 p-4 text-center sm:p-5">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
            </div>
            <h2 className="font-display text-lg font-black text-primary">ถ่ายรูปหลักฐาน</h2>
            <p className="mt-0.5 text-xs font-semibold text-on-surface-variant/60">ถ่ายรูปพัสดุหรือหลักฐานการจัดส่ง</p>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            {checkedParcel && <ParcelJobSummary parcel={checkedParcel} />}

            {!photoPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-outline-variant p-5 text-center transition-all hover:border-primary hover:bg-surface-container-lowest sm:p-6"
              >
                {/* hidden file input — capture="environment" เปิดกล้องหลังโดยตรงบน mobile */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-all group-hover:scale-105 group-hover:bg-primary/15">
                  <span className="material-symbols-outlined text-3xl text-primary transition-colors">photo_camera</span>
                </div>
                <p className="font-display text-base font-black text-primary">แตะเพื่อถ่ายรูป</p>
                <p className="mt-1 text-xs font-semibold text-on-surface-variant/60">ระบบจะบีบอัดรูปให้อัตโนมัติ</p>
              </div>
            ) : (
              <div className="relative rounded-3xl overflow-hidden border border-outline-variant shadow-inner group aspect-video bg-surface-container-lowest">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 backdrop-blur-[2px]">
                  <button
                    className="flex items-center gap-2 px-6 py-2.5 bg-white text-primary rounded-xl font-bold active:scale-95 transition-all shadow-lg hover:bg-primary hover:text-white"
                    onClick={() => {
                      setPhotoPreview(null);
                      setPhotoUrl('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <span className="material-symbols-outlined">restart_alt</span>
                    ถ่ายใหม่
                  </button>
                  <p className="text-white font-medium text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">zoom_out_map</span>
                    แสดงภาพเต็ม
                  </p>
                </div>
              </div>
            )}

            {/* GPS Status Indicator */}
            <div className={`flex items-start gap-3 rounded-2xl border p-3 ${
              geoStatus === 'success' && !hasLowAccuracyGps ? 'bg-green-50 border-green-200 text-green-800' :
              geoStatus === 'success' && hasLowAccuracyGps ? 'bg-amber-50 border-amber-200 text-amber-900' :
              geoStatus === 'error' || geoStatus === 'denied' ? 'bg-error-container/30 border-error/20 text-error' :
              'bg-surface-container-low border-outline-variant text-on-surface-variant'
            }`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                geoStatus === 'success' && !hasLowAccuracyGps ? 'bg-green-100 text-green-700' :
                geoStatus === 'success' && hasLowAccuracyGps ? 'bg-amber-100 text-amber-700' :
                geoStatus === 'error' || geoStatus === 'denied' ? 'bg-error-container text-error' :
                'bg-surface-container text-on-surface-variant'
              }`}>
                <span className={`material-symbols-outlined text-lg ${geoStatus === 'loading' ? 'animate-spin' : ''}`}>
                  {geoStatus === 'success' ? 'my_location' :
                   geoStatus === 'loading' ? 'progress_activity' :
                   geoStatus === 'error' || geoStatus === 'denied' ? 'location_disabled' : 'location_searching'}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-black leading-tight">
                  {geoStatus === 'success' && !hasLowAccuracyGps ? 'พร้อมบันทึกตำแหน่ง' :
                   geoStatus === 'success' && hasLowAccuracyGps ? 'ตำแหน่งแม่นยำต่ำ' :
                   geoStatus === 'loading' ? 'กำลังหาตำแหน่ง' :
                   geoStatus === 'denied' || geoStatus === 'error' ? 'ตำแหน่งไม่พร้อม' : 'รอเริ่มหาตำแหน่ง'}
                </p>
                <p className="mt-0.5 text-xs leading-snug opacity-75">
                  {geoStatus === 'success' && position
                    ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)} (ประมาณ ${Math.round(position.accuracy)}m${hasLowAccuracyGps ? ' - ใช้ได้แต่ควรตรวจปลายทางด้วยตา' : ''})`
                    : geoError ? geoError
                    : 'ระบบจะบันทึกตำแหน่งไว้เป็นหลักฐานประกอบ'}
                </p>
                {(geoStatus === 'error' || geoStatus === 'denied') && (
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={requestLocation}
                      className="text-xs font-black underline underline-offset-2 hover:opacity-80"
                    >
                      ลองดึงตำแหน่งอีกครั้ง
                    </button>
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider opacity-70">เหตุผลถ้าต้องยืนยันโดยไม่มี GPS</label>
                      <textarea
                        value={gpsOverrideReason}
                        onChange={(event) => setGpsOverrideReason(sanitizeTextInput(event.target.value, 300))}
                        placeholder="เช่น อยู่ในอาคาร, สัญญาณไม่ขึ้น, ลูกค้ารีบ"
                        className="min-h-[64px] w-full resize-none rounded-xl border border-error/20 bg-white px-3 py-2 text-sm text-on-surface outline-none focus:ring-1 focus:ring-error"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <button
                onClick={() => {
                  if (!canProceedFromPhoto) {
                    if (!photoPreview) {
                      toast.warning('กรุณาถ่ายรูปหลักฐานก่อน');
                    } else if (needsGpsOverrideReason) {
                      toast.warning('กรุณากรอกเหตุผลที่ยืนยันโดยไม่มี GPS');
                    } else if (geoStatus !== 'loading') {
                      toast.warning('กรุณารอให้ระบบดึงตำแหน่ง หรือลองดึงตำแหน่งใหม่');
                      requestLocation();
                    } else {
                      toast.warning('กำลังหาตำแหน่ง กรุณารอสักครู่');
                    }
                    return;
                  }
                  setCurrentStep(3);
                }}
                disabled={!photoPreview || geoStatus === 'loading' || (needsGpsOverrideReason && !gpsOverrideReason.trim())}
                className="group flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-display text-base font-black text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] hover:bg-primary/95 active:scale-[0.98] disabled:scale-100 disabled:bg-on-surface-variant/30 disabled:shadow-none"
              >
                {needsGpsOverrideReason ? 'ยืนยันโดยไม่มี GPS' : 'ไปขั้นตอนต่อไป'}
                <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Final Details & Confirm */}
      {currentStep === 3 && (
        <div className="overflow-hidden rounded-3xl border border-outline-variant bg-white shadow-xl animate-in slide-in-from-right-4 duration-500">
          <div className="border-b border-outline-variant/10 bg-surface-container-low/30 p-4 text-center sm:p-5">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
            </div>
            <h2 className="font-display text-lg font-black text-primary">เช็กปลายทางก่อนบันทึก</h2>
            <p className="mt-0.5 text-xs font-semibold text-on-surface-variant/60">ตรวจต้นทาง ปลายทาง และผู้รับก่อนยืนยัน</p>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            {checkedParcel && <ParcelJobSummary parcel={checkedParcel} />}

            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-lg text-primary">barcode_scanner</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 leading-none">หมายเลขติดตาม</span>
                  <span className="font-mono text-sm font-black leading-tight text-primary">{trackingId}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-lg text-primary">person</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 leading-none">ผู้รับ</span>
                  <span className="text-sm font-black leading-tight text-primary">{checkedParcel?.['ผู้รับ']}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined mt-0.5 text-lg text-primary">flag</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">ปลายทางที่ระบุไว้</p>
                  <p className="break-words font-display text-base font-black leading-snug text-primary">
                    {checkedParcel?.['สาขาผู้รับ'] || '-'}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-on-surface-variant/70">
                    GPS ด้านล่างเป็นหลักฐานตำแหน่งตอนกดส่ง ไม่ได้ใช้ตัดสินอัตโนมัติว่าตรงปลายทาง
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-green-900">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined mt-0.5 text-xl">task_alt</span>
                  <div>
                    <p className="font-display text-sm font-black">ค่าเริ่มต้น: ส่งสำเร็จตามปลายทาง</p>
                    <p className="text-xs font-semibold leading-snug opacity-75">ถ้าส่งตามงานปกติ ไม่ต้องเลือกอะไรเพิ่ม กดบันทึกผลการส่งได้เลย</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedOptions(value => !value)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-outline-variant/50 bg-white font-display text-sm font-black text-primary transition-all hover:bg-surface-container-lowest"
              >
                <span className="material-symbols-outlined text-lg">tune</span>
                ตัวเลือกเพิ่มเติม
                <span className={`material-symbols-outlined text-lg transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`}>expand_more</span>
              </button>

              {showAdvancedOptions && (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <div className={`rounded-2xl border-2 p-3 transition-all duration-300 ${isProxy ? 'bg-blue-50 border-blue-500' : 'bg-white border-outline-variant/30 hover:border-outline-variant'}`}>
                    <div className="flex cursor-pointer items-center justify-between group" onClick={() => { setIsProxy(!isProxy); if (!isProxy) { setIsForwarding(false); setDeliveryMatchStatus('MATCHED_DECLARED_DESTINATION'); setDeliveryMismatchReason(''); } }}>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${isProxy ? 'bg-blue-600 text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                          <span className="material-symbols-outlined text-xl">account_circle</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-black text-primary">มีผู้รับแทน</p>
                          <p className="text-[11px] leading-tight text-on-surface-variant/60">ส่งถึงปลายทางแล้ว แต่คนอื่นรับแทนผู้รับตามรายการ</p>
                        </div>
                      </div>
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isProxy ? 'border-blue-600 bg-blue-600' : 'border-outline-variant group-hover:border-primary'}`}>
                        {isProxy && <span className="material-symbols-outlined text-white text-base">check</span>}
                      </div>
                    </div>
                    {isProxy && (
                      <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">person</span>
                          <input
                            placeholder="ชื่อคนที่รับแทน"
                            value={proxyName}
                            onChange={(e) => setProxyName(sanitizeTextInput(e.target.value, 200))}
                            className="w-full rounded-2xl border border-outline-variant bg-white py-2.5 pl-10 pr-4 font-display text-sm outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {!isForwarding && (
                    <div className={`rounded-2xl border-2 p-3 transition-all duration-300 ${deliveryMatchStatus === 'DELIVERED_ELSEWHERE' ? 'bg-amber-50 border-amber-500' : 'bg-white border-outline-variant/30 hover:border-outline-variant'}`}>
                      <div className="flex cursor-pointer items-center justify-between group" onClick={() => { setDeliveryMatchStatus(deliveryMatchStatus === 'DELIVERED_ELSEWHERE' ? 'MATCHED_DECLARED_DESTINATION' : 'DELIVERED_ELSEWHERE'); }}>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${deliveryMatchStatus === 'DELIVERED_ELSEWHERE' ? 'bg-amber-500 text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                            <span className="material-symbols-outlined text-xl">move_location</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-display text-sm font-black text-primary">ส่งคนละจุด / ฝากไว้ที่อื่น</p>
                            <p className="text-[11px] leading-tight text-on-surface-variant/60">ใช้เมื่อปลายทางจริงไม่ตรงกับที่ระบุไว้ในงาน</p>
                          </div>
                        </div>
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${deliveryMatchStatus === 'DELIVERED_ELSEWHERE' ? 'border-amber-500 bg-amber-500' : 'border-outline-variant group-hover:border-primary'}`}>
                          {deliveryMatchStatus === 'DELIVERED_ELSEWHERE' && <span className="material-symbols-outlined text-white text-base">check</span>}
                        </div>
                      </div>
                      {deliveryMatchStatus === 'DELIVERED_ELSEWHERE' && (
                        <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                          <label className="mb-1.5 block px-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                            เหตุผลที่ส่งคนละจุด
                          </label>
                          <textarea
                            placeholder="เช่น ลูกค้าให้ฝากอีกแผนก, ฝากไว้ที่ป้อมยาม, ชื่อสถานที่ในระบบไม่ละเอียด..."
                            value={deliveryMismatchReason}
                            onChange={(e) => setDeliveryMismatchReason(sanitizeTextInput(e.target.value, 500))}
                            className="min-h-[72px] w-full resize-none rounded-2xl border border-amber-200 bg-white px-4 py-2.5 font-display text-sm outline-none transition-all focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`rounded-2xl border-2 p-3 transition-all duration-300 ${isForwarding ? 'bg-secondary-fixed/10 border-secondary-container' : 'bg-white border-outline-variant/30 hover:border-outline-variant'}`}>
                    <div className="flex cursor-pointer items-center justify-between group" onClick={() => { setIsForwarding(!isForwarding); if (!isForwarding) { setIsProxy(false); setProxyName(''); setDeliveryMatchStatus('MATCHED_DECLARED_DESTINATION'); setDeliveryMismatchReason(''); } }}>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${isForwarding ? 'bg-secondary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                          <span className="material-symbols-outlined text-xl">fork_right</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-black text-primary">ส่งต่อไปจุดถัดไป</p>
                          <p className="text-[11px] leading-tight text-on-surface-variant/60">ยังไม่ถึงผู้รับ ต้องส่งต่อให้คนหรือสาขาอื่น</p>
                        </div>
                      </div>
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isForwarding ? 'border-secondary bg-secondary' : 'border-outline-variant group-hover:border-primary'}`}>
                        {isForwarding && <span className="material-symbols-outlined text-white text-base">check</span>}
                      </div>
                    </div>
                    {isForwarding && (
                      <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">person</span>
                          <input
                            placeholder="ชื่อคนที่รับช่วงต่อ"
                            value={forwardSender}
                            onChange={(e) => setForwardSender(sanitizeTextInput(e.target.value, 200))}
                            className="w-full rounded-2xl border border-outline-variant bg-white py-2.5 pl-10 pr-4 font-display text-sm outline-none focus:ring-1 focus:ring-secondary"
                          />
                        </div>
                        <NativeSelect
                          value={forwardToBranch}
                          onChange={setForwardToBranch}
                          options={branches}
                          placeholder="ส่งต่อไปที่"
                          icon="flight_land"
                          otherLabel="อื่นๆ"
                          otherPlaceholder="ระบุจุดหมายถัดไป"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">หมายเหตุเพิ่มเติม (ไม่บังคับ)</label>
                <textarea
                  placeholder="เช่น กล่องบุบนิดหน่อย, วางไว้ที่ป้อมยาม, ฝากไว้ที่เคาน์เตอร์..."
                  value={note}
                  onChange={(e) => setNote(sanitizeTextInput(e.target.value, 2000))}
                  className="min-h-[68px] w-full resize-none rounded-2xl border border-outline-variant bg-white px-4 py-2.5 font-display text-sm outline-none transition-all focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-[0.9fr_1.4fr] gap-2.5 sm:gap-3">
              <button
                onClick={() => setCurrentStep(2)}
                className="flex h-13 min-w-0 items-center justify-center gap-1.5 rounded-2xl border border-outline-variant/70 bg-white px-2 font-display text-sm font-black text-on-surface-variant shadow-sm transition-all hover:border-primary/30 hover:bg-surface-container-lowest hover:text-primary active:scale-[0.98] sm:text-base"
              >
                <span className="material-symbols-outlined text-lg sm:text-xl">arrow_back</span>
                ย้อนกลับ
              </button>
              <button
                onClick={() => setIsConfirmDialogOpen(true)}
                disabled={isLoading
                  || (isForwarding && (
                    !forwardSender.trim()
                    || !resolveSelectValue(forwardToBranch)
                  ))
                  || (isProxy && !proxyName.trim())
                  || (!isForwarding && deliveryMatchStatus === 'DELIVERED_ELSEWHERE' && !deliveryMismatchReason.trim())}
                className="group flex h-13 min-w-0 items-center justify-center gap-2 rounded-2xl bg-primary px-3 font-display text-sm font-black text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] hover:bg-primary/95 active:scale-[0.98] disabled:scale-100 disabled:bg-on-surface-variant/30 disabled:shadow-none sm:text-base"
              >
                บันทึกผลการส่ง
                <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1 sm:text-2xl">verified</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent showCloseButton={false} className="w-[calc(100vw-1rem)] max-w-[92vw] sm:max-w-2xl max-h-[90vh] rounded-3xl p-0 border-none shadow-2xl bg-white overflow-hidden flex flex-col">
          {/* Header */}
          <div className={`px-6 pt-6 pb-5 flex items-center gap-4 ${
            isForwarding ? 'bg-gradient-to-br from-secondary/15 to-secondary/5' :
            isProxy ? 'bg-gradient-to-br from-blue-500/15 to-blue-500/5' :
            'bg-gradient-to-br from-green-500/15 to-green-500/5'
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
              isForwarding ? 'bg-secondary text-white' :
              isProxy ? 'bg-blue-600 text-white' :
              'bg-green-600 text-white'
            }`}>
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isForwarding ? 'fork_right' : isProxy ? 'account_circle' : 'check_circle'}
              </span>
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-black font-display text-primary leading-tight">
                {isForwarding ? 'ยืนยันส่งต่อไปจุดถัดไป' : isProxy ? 'ยืนยันว่ามีผู้รับแทน' : 'ยืนยันว่าส่งถึงผู้รับแล้ว'}
              </DialogTitle>
              <p className="text-xs text-on-surface-variant mt-0.5">กรุณาตรวจสอบข้อมูลก่อนยืนยัน</p>
            </div>
            <button
              onClick={() => setIsConfirmDialogOpen(false)}
              className="p-2 rounded-xl text-on-surface-variant/50 hover:bg-black/5 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Tracking ID row */}
            <div className="flex flex-col gap-2 bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant/20 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-base">barcode_scanner</span>
                <span className="text-xs font-bold uppercase tracking-wider">หมายเลขติดตาม</span>
              </div>
              <code className="min-w-0 break-all font-mono font-black text-primary text-base tracking-wider">{trackingId}</code>
            </div>

            {/* Forwarding details */}
            {isForwarding && (
              <div className="bg-secondary/5 rounded-2xl p-4 border border-secondary/15 space-y-3">
                <div className="flex items-center gap-2 text-secondary">
                  <span className="material-symbols-outlined text-base">person</span>
                  <span className="text-xs font-bold">ผู้รับช่วงต่อ: <span className="text-primary">{forwardSender || '-'}</span></span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-outline-variant/20 text-center">
                    <p className="text-[9px] text-on-surface-variant/50 font-bold uppercase tracking-wider mb-0.5">จากสาขา</p>
                    <p className="text-sm font-black text-primary truncate">
                      {resolveSelectValue(forwardFromBranch)}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant text-xl shrink-0">arrow_forward</span>
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
                <span className="material-symbols-outlined text-blue-500 text-xl">how_to_reg</span>
                <div>
                  <p className="text-[10px] text-blue-600/70 font-bold uppercase tracking-wider">ผู้รับแทน</p>
                  <p className="font-bold text-blue-900 text-sm">{proxyName || '-'}</p>
                </div>
              </div>
            )}

            {/* Normal receipt */}
            {!isForwarding && !isProxy && (
              <div className="bg-green-50 rounded-2xl px-4 py-3 border border-green-100 flex items-center gap-3">
                <span className="material-symbols-outlined text-green-600 text-xl">verified_user</span>
                <div>
                  <p className="text-[10px] text-green-600/70 font-bold uppercase tracking-wider">ผู้รับ</p>
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
                <span className="material-symbols-outlined text-xl">
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
              <div className="relative h-48 sm:h-56 rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-lowest group cursor-pointer transition-all hover:border-primary/50" onClick={() => {
                // If user wants to see popup, we can open it in a new window or just rely on object-contain
                const w = window.open();
                if(w) w.document.write(`<body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${photoPreview}" style="max-width:100%;max-height:100%;object-fit:contain;" /></body>`);
              }}>
                <img src={photoPreview} alt="หลักฐาน" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-white">
                    <span className="material-symbols-outlined">zoom_in</span>
                    <span className="text-sm font-bold tracking-wide">คลิกเพื่อดูภาพขยาย</span>
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white pointer-events-none">
                  <span className="material-symbols-outlined text-base shadow-sm">photo_camera</span>
                  <span className="text-xs font-bold uppercase tracking-wider drop-shadow-md">รูปหลักฐาน</span>
                </div>
              </div>
            )}

            {/* GPS Map Preview */}
            {position && (
              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/20">
                <div className="px-4 py-2 bg-surface-container-low/50 border-b border-outline-variant/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm text-green-600">my_location</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">พิกัด GPS ที่บันทึก</span>
                  </div>
                  <span className="text-[10px] font-mono text-on-surface-variant/60">
                    {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
                  </span>
                </div>
                <div className="h-32 w-full relative pointer-events-none">
                  <MapView 
                    className="w-full h-full" 
                    initialCenter={{ lat: position.latitude, lng: position.longitude }} 
                    initialZoom={16}
                    onMapReady={(map) => {
                      // disable interactions for simple preview
                      map.dragging.disable();
                      map.touchZoom.disable();
                      map.doubleClickZoom.disable();
                      map.scrollWheelZoom.disable();
                      map.boxZoom.disable();
                      map.keyboard.disable();
                      const tappableMap = map as L.Map & { tap?: { disable: () => void } };
                      tappableMap.tap?.disable();
                      
                      const icon = L.divIcon({
                        className: 'custom-gps-marker',
                        html: `<div style="width:16px;height:16px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,0.3);"></div>`,
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                      });
                      L.marker([position.latitude, position.longitude], { icon }).addTo(map);
                    }}
                  />
                  <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] z-[400] pointer-events-none" />
                </div>
              </div>
            )}

            {!position && gpsOverrideReason && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-amber-950">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-xl">location_off</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">ยืนยันโดยไม่มี GPS</p>
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
          <div className="shrink-0 px-6 pb-6 pt-3 border-t border-outline-variant/10 flex gap-3">
            <button
              onClick={() => setIsConfirmDialogOpen(false)}
              className="flex-1 h-12 rounded-2xl font-display font-bold border-2 border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              แก้ไข
            </button>
            <button
              onClick={executeConfirm}
              disabled={isLoading}
              className="flex-[2] flex items-center justify-center gap-2 h-12 bg-primary text-white rounded-2xl font-display font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <>
                  ยืนยันรายการ
                  <span className="material-symbols-outlined text-xl">verified</span>
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
