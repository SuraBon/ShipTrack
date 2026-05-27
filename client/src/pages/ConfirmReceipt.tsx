/**
 * Confirm Receipt Page
 * ยืนยันส่งด้วยรูปภาพ
 * Design: Premium Stepper UI
 */

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '@/components/ui/spinner';
import { useParcelStore } from '@/hooks/useParcelStore';
import { getParcel, syncRouteSamples } from '@/lib/parcelService';
import { useBranches } from '@/hooks/useBranches';
import NativeSelect, { resolveSelectValue } from '@/components/NativeSelect';
import { toast } from 'sonner';
import type { DeliveryMatchStatus, Parcel } from '@/types/parcel';
import { useGeolocation } from '@/hooks/useGeolocation';
import { isValidTrackingId, sanitizeTextInput } from '@/lib/validation';
import { buildGpsEvidenceNote, needsGpsOverrideReason as shouldRequireGpsOverrideReason } from '@/lib/gpsQuality';
import { buildDeliveryActionPayload, getCurrentBranchFromParcel, isParcelTrulyDelivered } from '@/lib/deliveryActionBuilder';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { stopRouteTracking } from '@/lib/routeTracking';
import { ParcelJobSummary } from '@/components/confirm-receipt/ConfirmReceiptShared';
import { useProofImage } from '@/hooks/useProofImage';

export default function ConfirmReceipt({
  initialTrackingId,
  onInitialTrackingIdConsumed,
  autoCheckInitial = false,
  autoOpenCamera = false,
  embedded = false,
  onClose,
  onComplete,
}: {
  initialTrackingId?: string | null;
  onInitialTrackingIdConsumed?: () => void;
  autoCheckInitial?: boolean;
  autoOpenCamera?: boolean;
  embedded?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
}) {
  const { confirmReceipt, updateParcelLocally, loadParcels } = useParcelStore();
  const offlineQueue = useOfflineQueue();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { branches } = useBranches();

  // Steps: 1 (Check), 2 (Photo), 3 (Confirm)
  const [currentStep, setCurrentStep] = useState(1);
  const [trackingId, setTrackingId] = useState('');
  const {
    imageUrl: photoUrl,
    previewUrl: photoPreview,
    isProcessingImage,
    processImageFile,
    clearImage: clearProofImage,
  } = useProofImage();
  const [note, setNote] = useState('');

  const { position, status: geoStatus, errorMessage: geoError, requestLocation, reset: resetGeo } = useGeolocation();
  const [isGpsBypassed, setIsGpsBypassed] = useState(false);

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
  const [isDelivered, setIsDelivered] = useState(false);
  const pendingOfflineCount = offlineQueue.filter(item => item.status === 'pending' || item.status === 'failed').length;
  const resetFormState = () => {
    setCurrentStep(1);
    setTrackingId('');
    clearProofImage();
    setNote('');
    setIsGpsBypassed(false);
    setIsForwarding(false);
    setForwardSender('');
    setForwardFromBranch('');
    setForwardToBranch('');
    setIsProxy(false);
    setProxyName('');
    setDeliveryMatchStatus('MATCHED_DECLARED_DESTINATION');
    setDeliveryMismatchReason('');
    setGpsOverrideReason('');
    setShowAdvancedOptions(false);
    setCheckedParcel(null);
    setIsDelivered(false);
    resetGeo();
  };

  const handleCloseStep = () => {
    if (embedded && onClose) {
      resetFormState();
      onClose();
      return;
    }
    setCurrentStep(1);
  };

  const effectiveGeoStatus = isGpsBypassed ? 'error' : geoStatus;
  const needsGpsOverrideReason = shouldRequireGpsOverrideReason(effectiveGeoStatus);
  const canProceedFromPhoto = Boolean(photoPreview) && !isProcessingImage && (
    effectiveGeoStatus === 'success' ||
    (needsGpsOverrideReason && gpsOverrideReason.trim().length > 0)
  );

  // Re-request GPS whenever entering step 2 (handles back-navigation from step 3)
  useEffect(() => {
    if (currentStep === 2 && geoStatus === 'idle') {
      requestLocation();
    }
  }, [currentStep, geoStatus, requestLocation]);

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
          toast.warning('รายการนี้ถูกส่งถึงที่หมายเรียบร้อยแล้ว');
        } else {
          toast.success(`พบรายการส่ง ต้องส่งไปที่: ${p['สาขาผู้รับ']}`);
          setCurrentStep(2); // Auto move to photo step
          requestLocation(); // Request GPS automatically on step 2
          if (shouldOpenCamera) {
            setTimeout(() => fileInputRef.current?.click(), 250);
          }
        }
      } else {
        toast.error('ไม่พบรายการส่ง หรือหมายเลขติดตามไม่ถูกต้อง');
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

  const initialTriggerRef = useRef({
    onInitialTrackingIdConsumed,
    autoCheckInitial,
    autoOpenCamera,
    checkParcelByTrackingId,
    resetGeo,
  });

  useEffect(() => {
    initialTriggerRef.current = {
      onInitialTrackingIdConsumed,
      autoCheckInitial,
      autoOpenCamera,
      checkParcelByTrackingId,
      resetGeo,
    };
  });

  // Auto-fill tracking ID เมื่อถูกเปิดจาก Dashboard และตรวจสอบทันที
  useEffect(() => {
    if (!initialTrackingId) return;

    const safeTrackingId = sanitizeTextInput(initialTrackingId, 100).toUpperCase();
    setCurrentStep(1);
    setTrackingId(safeTrackingId);
    clearProofImage();
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
    setIsGpsBypassed(false);
    initialTriggerRef.current.resetGeo();
    if (fileInputRef.current) fileInputRef.current.value = '';

    initialTriggerRef.current.onInitialTrackingIdConsumed?.();
    if (initialTriggerRef.current.autoCheckInitial) {
      setIsAutoPreparingCamera(true);
      setTimeout(() => {
        void initialTriggerRef.current.checkParcelByTrackingId(safeTrackingId, initialTriggerRef.current.autoOpenCamera)
          .finally(() => setIsAutoPreparingCamera(false));
      }, 0);
    }
  }, [initialTrackingId]);

  const handlePasteTrackingID = async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      toast.error('เบราว์เซอร์ไม่รองรับการวางอัตโนมัติ (กรุณาใช้ Ctrl+V หรือกดค้างเพื่อวาง)');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const safeText = sanitizeTextInput(text, 100).toUpperCase();
      if (safeText) {
        setTrackingId(safeText);
        toast.success('วางหมายเลขติดตามเรียบร้อย');
      }
    } catch {
      toast.error('ไม่สามารถวางข้อมูลได้ (กรุณาอนุญาตการเข้าถึง Clipboard หรือใช้ Ctrl+V แทน)');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await processImageFile(file);
    if (processed) setCurrentStep(3);
  };

  const executeConfirm = async () => {
    if (isLoading) return;
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
        needsGpsOverrideReason && !safeGpsOverrideReason ? 'กรุณาระบุเหตุผลที่ยืนยันโดยไม่มีตำแหน่ง GPS' :
        !actionPayload ? 'กรุณาตรวจสอบรายการส่งก่อนยืนยัน' :
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

      toast.success('กำลังยืนยันส่ง...');
      
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
        stopRouteTracking(finalTrackingId);
        void syncRouteSamples(finalTrackingId);
        toast.success(response.queued ? 'บันทึกไว้ในเครื่องแล้ว ระบบจะซิงค์เมื่อเชื่อมต่อได้' : 'ยืนยันส่งเรียบร้อยแล้ว');
        // Reset all state
        setCurrentStep(1);
        setTrackingId('');
        clearProofImage();
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
        setIsGpsBypassed(false);
        resetGeo();
        onComplete?.();
      } else {
        toast.error(response?.error ? `ยืนยันส่งไม่สำเร็จ: ${response.error}` : 'ไม่สามารถยืนยันส่งได้ กรุณาลองใหม่');
        // Revert local update
        if (typeof loadParcels === 'function') loadParcels(undefined, true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`${embedded ? 'max-w-none pb-0 overflow-hidden rounded-[1.75rem]' : 'app-page-narrow'} animate-in fade-in slide-in-from-bottom-4 duration-700`}>
      {/* Header Section (Standalone) */}
      {!embedded && (
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">งานส่ง</h1>
            <p className="app-page-subtitle">สแกนหรือกรอกหมายเลข แล้วดูต้นทาง ปลายทาง และผู้รับทันที</p>
          </div>
          {pendingOfflineCount > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              <span className="material-symbols-outlined text-base" aria-hidden="true">sync_problem</span>
              รอซิงค์ {pendingOfflineCount} รายการ
            </div>
          )}
        </div>
      )}

      {/* Header Section (Embedded Modal) */}
      {embedded && (
        <div className="relative shrink-0 bg-slate-950 px-5 py-4 text-white">
          {onClose && (
            <button
              type="button"
              onClick={handleCloseStep}
              className="absolute right-4 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="ปิดหน้านี้"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
            </button>
          )}
          <h2 className="font-display text-sm font-semibold leading-tight text-white">
            {currentStep === 1 && 'ระบุหมายเลขติดตาม'}
            {currentStep === 2 && 'ถ่ายรูปหลักฐานการจัดส่ง'}
            {currentStep === 3 && 'ตรวจสอบและยืนยันข้อมูล'}
          </h2>
          <p className="mt-1 min-w-0 pr-8 text-[10px] tracking-wide text-slate-400">
            {checkedParcel ? (
              <span className="font-mono">{checkedParcel.TrackingID}</span>
            ) : (
              'กรุณาตรวจสอบหมายเลขพัสดุก่อนทำรายการ'
            )}
          </p>
        </div>
      )}

      {isLoading && createPortal(
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-4">
            <Spinner className="h-12 w-12 text-primary" />
          </div>
          <p className="text-lg font-bold text-primary font-display">กำลังยืนยันส่ง...</p>
          <p className="text-on-surface-variant text-sm">กรุณารอสักครู่ ระบบกำลังประมวลผล</p>
        </div>,
        document.body
      )}

      {isAutoPreparingCamera && currentStep === 1 && (
        <div className="app-panel p-8 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Spinner className="h-10 w-10" />
          </div>
          <h2 className="font-display text-xl font-black text-primary">กำลังเปิดกล้อง...</h2>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant/60">ระบบกำลังตรวจสอบรายการส่งและเตรียมถ่ายรูปหลักฐาน</p>
        </div>
      )}

      {/* Step 1: Check Tracking ID */}
      {currentStep === 1 && !isAutoPreparingCamera && (
        <div className="animate-in slide-in-from-right-4 duration-500">
          <div className={embedded ? "" : "app-panel overflow-hidden"}>
            {!embedded && (
              <div className="app-panel-header p-5 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <span className="material-symbols-outlined text-xl" aria-hidden="true">search</span>
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-primary">ระบุหมายเลขติดตาม</h2>
                  <p className="text-xs text-on-surface-variant/60 mt-0.5">กรอกหมายเลขติดตามเพื่อดูต้นทาง ปลายทาง และผู้รับ</p>
                </div>
              </div>
            )}
            <div className={embedded ? "p-5 space-y-5" : "p-6 sm:p-8 space-y-6"}>
            <div className="space-y-4">
              <div className="relative group">
                <input
                  placeholder="เช่น TRK20260420001"
                  value={trackingId}
                  onChange={(e) => setTrackingId(sanitizeTextInput(e.target.value, 100).toUpperCase())}
                  className="app-input h-14 w-full pr-12 font-mono text-base font-semibold tracking-[0.05em] sm:h-14 sm:text-xl sm:tracking-[0.12em]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handlePasteTrackingID}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all"
                  title="วางจากคลิปบอร์ด"
                >
                  <span className="material-symbols-outlined text-2xl" aria-hidden="true">content_paste</span>
                </button>
              </div>

              {checkedParcel && isDelivered && (
                <div className="p-4 bg-error-container/30 border border-error/10 rounded-2xl text-error text-sm flex items-start gap-3 animate-in shake duration-300">
                  <span className="material-symbols-outlined text-xl" aria-hidden="true">block</span>
                  <div>
                    <p className="font-bold">รายการนี้ถูกส่งถึงที่หมายแล้ว</p>
                    <p className="opacity-80">ไม่สามารถยืนยันซ้ำได้ กรุณาตรวจสอบหมายเลขติดตามอีกครั้ง</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCheckParcel}
              disabled={isChecking || !trackingId || isDelivered}
              className="app-primary-button h-12 w-full"
            >
              {isChecking ? (
                <>
                  <Spinner className="h-5 w-5" />
                  กำลังตรวจสอบ...
                </>
              ) : (
                <>
                  ดูงานส่งนี้
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform" aria-hidden="true">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Step 2: Photo Evidence */}
      {currentStep === 2 && (
        <div className="animate-in slide-in-from-right-4 duration-500">
          <div className={embedded ? "" : "app-panel overflow-hidden"}>
            {!embedded && (
              <div className="app-panel-header p-5 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <span className="material-symbols-outlined text-xl" aria-hidden="true">photo_camera</span>
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-primary">ถ่ายรูปหลักฐานการจัดส่ง</h2>
                  <p className="text-xs text-on-surface-variant/60 mt-0.5">ถ่ายรูปสิ่งที่ส่งหรือหลักฐานการจัดส่ง (พัสดุ: {checkedParcel?.TrackingID})</p>
                </div>
              </div>
            )}
            <div className={embedded ? "p-5 space-y-4" : "p-6 sm:p-8 space-y-6"}>
              {checkedParcel && <ParcelJobSummary parcel={checkedParcel} />}

            <input
              ref={fileInputRef}
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
                className="group relative overflow-hidden rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center transition-all hover:border-primary/40 hover:bg-gray-100 sm:p-10 w-full disabled:opacity-75 disabled:pointer-events-none"
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
              <div className="relative h-64 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 sm:h-80 w-full">
                <img src={photoPreview} alt="หลักฐานการจัดส่ง" className="w-full h-full object-contain animate-in fade-in zoom-in-95 duration-500" />
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
                  className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50"
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
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                    effectiveGeoStatus === 'success' ? 'bg-green-500/10 text-green-600' :
                    needsGpsOverrideReason ? 'bg-error/10 text-error' :
                    'bg-amber-500/10 text-amber-600'
                  }`}>
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
                      {effectiveGeoStatus === 'success' ? 'ระบุตำแหน่งสำเร็จ' :
                       effectiveGeoStatus === 'loading' ? 'กำลังดึงตำแหน่ง...' :
                       'ไม่พบตำแหน่ง'}
                    </p>
                    <p className="text-xs text-on-surface-variant/70 font-semibold leading-normal">
                      {effectiveGeoStatus === 'success' ? `ตำแหน่งแม่นยำ ~${Math.round(position?.accuracy || 0)} เมตร` :
                       effectiveGeoStatus === 'loading' ? 'กรุณารอสักครู่ กำลังระบุตำแหน่งเพื่อใช้เป็นหลักฐานการส่ง' :
                       geoError || 'ไม่สามารถดึงตำแหน่งได้'}
                    </p>
                  </div>
                </div>

                {/* GPS Retry Button */}
                {effectiveGeoStatus !== 'loading' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsGpsBypassed(false);
                      requestLocation();
                    }}
                    className="w-full sm:w-auto shrink-0 font-display text-xs font-black text-primary hover:text-primary/95 border border-primary/20 hover:bg-primary/5 px-3 py-2 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                  >
                    ลองดึงตำแหน่งใหม่
                  </button>
                )}
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
            <div className="grid grid-cols-[0.9fr_1.4fr] gap-2.5 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex h-13 min-w-0 items-center justify-center gap-1.5 rounded-2xl border border-outline-variant/70 bg-white px-2 font-display text-sm font-black text-on-surface-variant shadow-sm transition-all hover:border-primary/30 hover:bg-surface-container-lowest hover:text-primary active:scale-[0.98] cursor-pointer sm:text-base"
              >
                <span className="material-symbols-outlined text-lg sm:text-xl" aria-hidden="true">arrow_back</span>
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                disabled={!canProceedFromPhoto}
                className="group flex h-13 min-w-0 items-center justify-center gap-2 rounded-2xl bg-primary px-3 font-display text-sm font-black text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] hover:bg-primary/95 active:scale-[0.98] disabled:scale-100 disabled:bg-on-surface-variant/30 disabled:shadow-none cursor-pointer sm:text-base"
              >
                ขั้นตอนถัดไป
                <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1 sm:text-2xl font-black" aria-hidden="true">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Step 3: Final Details & Confirm */}
      {currentStep === 3 && (
        <div className="animate-in slide-in-from-right-4 duration-500">
          <div className={embedded ? "" : "app-panel overflow-hidden"}>
            {!embedded && (
              <div className="app-panel-header p-5 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <span className="material-symbols-outlined text-xl" aria-hidden="true">fact_check</span>
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-primary">เช็กปลายทางก่อนบันทึก</h2>
                  <p className="text-xs text-on-surface-variant/60 mt-0.5">ตรวจต้นทาง ปลายทาง และผู้รับก่อนยืนยัน (พัสดุ: {checkedParcel?.TrackingID})</p>
                </div>
              </div>
            )}
            <div className={embedded ? "p-5 space-y-4" : "p-6 sm:p-8 space-y-6"}>
              {checkedParcel && <ParcelJobSummary parcel={checkedParcel} />}

            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2.5 text-slate-600">
                <span className="material-symbols-outlined text-lg text-slate-800" aria-hidden="true">barcode_scanner</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold leading-none text-slate-400">หมายเลขติดตาม</span>
                  <span className="font-mono text-sm font-black leading-tight text-slate-950">{trackingId}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-slate-600">
                <span className="material-symbols-outlined text-lg text-slate-800" aria-hidden="true">person</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold leading-none text-slate-400">ผู้รับ</span>
                  <span className="text-sm font-black leading-tight text-slate-950">{checkedParcel?.['ผู้รับ']}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-slate-50 p-3">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined mt-0.5 text-lg text-slate-700" aria-hidden="true">flag</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400">ปลายทางที่ระบุไว้</p>
                  <p className="break-words font-display text-base font-black leading-snug text-slate-950">
                    {checkedParcel?.['สาขาผู้รับ'] || '-'}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-slate-500">
                    ตำแหน่งด้านล่างเป็นหลักฐานตอนกดส่ง ไม่ได้ใช้ตัดสินอัตโนมัติว่าตรงปลายทาง
                  </p>
                </div>
              </div>
            </div>

            {needsGpsOverrideReason && (
              <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined mt-0.5 text-lg" aria-hidden="true">location_off</span>
                  <div>
                    <p className="font-display text-sm font-black">ยืนยันโดยไม่มีตำแหน่ง GPS</p>
                    <p className="text-xs font-semibold leading-snug opacity-75">กรุณาระบุเหตุผลก่อนกดยืนยันส่ง</p>
                  </div>
                </div>
                <textarea
                  placeholder="เช่น สัญญาณเน็ตล่ม, อยู่ในอาคารชั้นใต้ดิน, ลูกค้ามารับนอกพื้นที่..."
                  value={gpsOverrideReason}
                  onChange={(e) => setGpsOverrideReason(sanitizeTextInput(e.target.value, 300))}
                  className="min-h-[72px] w-full resize-none rounded-2xl border border-amber-200 bg-white px-4 py-2.5 font-display text-sm outline-none transition-all focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-green-900">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined mt-0.5 text-xl" aria-hidden="true">task_alt</span>
                  <div>
                    <p className="font-display text-sm font-black">ค่าเริ่มต้น: ยืนยันส่งตามปลายทาง</p>
                    <p className="text-xs font-semibold leading-snug opacity-75">ถ้าส่งตามงานปกติ ไม่ต้องเลือกอะไรเพิ่ม กดยืนยันส่งได้เลย</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedOptions(value => !value)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-outline-variant/50 bg-white font-display text-sm font-black text-primary transition-all hover:bg-surface-container-lowest"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">tune</span>
                ตัวเลือกเพิ่มเติม
                <span className={`material-symbols-outlined text-lg transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
              </button>

              {showAdvancedOptions && (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <div className={`rounded-2xl border-2 p-3 transition-all duration-300 ${isProxy ? 'bg-blue-50 border-blue-500' : 'bg-white border-outline-variant/30 hover:border-outline-variant'}`}>
                    <div className="flex cursor-pointer items-center justify-between group" onClick={() => { setIsProxy(!isProxy); if (!isProxy) { setIsForwarding(false); setDeliveryMatchStatus('MATCHED_DECLARED_DESTINATION'); setDeliveryMismatchReason(''); } }}>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${isProxy ? 'bg-blue-600 text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                          <span className="material-symbols-outlined text-xl" aria-hidden="true">account_circle</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-black text-primary">มีผู้รับแทน</p>
                          <p className="text-[11px] leading-tight text-on-surface-variant/60">ส่งถึงปลายทางแล้ว แต่คนอื่นรับแทนผู้รับตามรายการ</p>
                        </div>
                      </div>
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isProxy ? 'border-blue-600 bg-blue-600' : 'border-outline-variant group-hover:border-primary'}`}>
                        {isProxy && <span className="material-symbols-outlined text-white text-base" aria-hidden="true">check</span>}
                      </div>
                    </div>
                    {isProxy && (
                      <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg" aria-hidden="true">person</span>
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
                            <span className="material-symbols-outlined text-xl" aria-hidden="true">move_location</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-display text-sm font-black text-primary">ส่งคนละจุด / ฝากไว้ที่อื่น</p>
                            <p className="text-[11px] leading-tight text-on-surface-variant/60">ใช้เมื่อปลายทางจริงไม่ตรงกับที่ระบุไว้ในงาน</p>
                          </div>
                        </div>
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${deliveryMatchStatus === 'DELIVERED_ELSEWHERE' ? 'border-amber-500 bg-amber-500' : 'border-outline-variant group-hover:border-primary'}`}>
                          {deliveryMatchStatus === 'DELIVERED_ELSEWHERE' && <span className="material-symbols-outlined text-white text-base" aria-hidden="true">check</span>}
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
                          <span className="material-symbols-outlined text-xl" aria-hidden="true">fork_right</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-black text-primary">ส่งต่อไปจุดถัดไป</p>
                          <p className="text-[11px] leading-tight text-on-surface-variant/60">ยังไม่ถึงผู้รับ ต้องส่งต่อให้คนหรือแผนก/สาขาอื่น</p>
                        </div>
                      </div>
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isForwarding ? 'border-secondary bg-secondary' : 'border-outline-variant group-hover:border-primary'}`}>
                        {isForwarding && <span className="material-symbols-outlined text-white text-base" aria-hidden="true">check</span>}
                      </div>
                    </div>
                    {isForwarding && (
                      <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg" aria-hidden="true">person</span>
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
                          icon="fork_right"
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
                <span className="material-symbols-outlined text-lg sm:text-xl" aria-hidden="true">arrow_back</span>
                ย้อนกลับ
              </button>
              <button
                onClick={executeConfirm}
                disabled={isLoading
                  || (isForwarding && (
                    !forwardSender.trim()
                    || !resolveSelectValue(forwardToBranch)
                  ))
                  || (isProxy && !proxyName.trim())
                  || (!isForwarding && deliveryMatchStatus === 'DELIVERED_ELSEWHERE' && !deliveryMismatchReason.trim())}
                className="group flex h-13 min-w-0 items-center justify-center gap-2 rounded-2xl bg-primary px-3 font-display text-sm font-black text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] hover:bg-primary/95 active:scale-[0.98] disabled:scale-100 disabled:bg-on-surface-variant/30 disabled:shadow-none sm:text-base"
              >
                ยืนยันส่ง
                <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1 sm:text-2xl" aria-hidden="true">verified</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
