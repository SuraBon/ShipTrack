import { useState, useEffect, useRef } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { getParcel, syncRouteSamples } from '@/lib/parcelService';
import { useBranches } from '@/hooks/useBranches';
import { toast } from 'sonner';
import type { DeliveryMatchStatus, Parcel } from '@/types/parcel';
import { useGeolocation } from '@/hooks/useGeolocation';
import { isValidTrackingId, sanitizeTextInput } from '@/lib/validation';
import { buildGpsEvidenceNote, needsGpsOverrideReason as shouldRequireGpsOverrideReason } from '@/lib/gpsQuality';
import { buildDeliveryActionPayload, getCurrentBranchFromParcel, isParcelTrulyDelivered } from '@/lib/deliveryActionBuilder';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { stopRouteTracking } from '@/lib/routeTracking';
import { useProofImage } from '@/hooks/useProofImage';
import { isNetworkErrorMessage } from '@/lib/apiErrorHelper';
import { resolveSelectValue } from '@/components/NativeSelect';

export interface UseConfirmReceiptFormProps {
  initialTrackingId?: string | null;
  onInitialTrackingIdConsumed?: () => void;
  autoCheckInitial?: boolean;
  autoOpenCamera?: boolean;
  embedded?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function useConfirmReceiptForm({
  initialTrackingId,
  onInitialTrackingIdConsumed,
  autoCheckInitial = false,
  autoOpenCamera = false,
  embedded = false,
  onClose,
  onComplete,
  fileInputRef,
}: UseConfirmReceiptFormProps) {
  const { confirmReceipt, updateParcelLocally, loadParcels } = useParcelStore();
  const offlineQueue = useOfflineQueue();
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

  // Offline Fallback States
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [tempReceiverName, setTempReceiverName] = useState('');
  const [tempReceiverBranch, setTempReceiverBranch] = useState('');
  const [showOfflinePrompt, setShowOfflinePrompt] = useState(false);

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
    setIsOfflineFallback(false);
    setTempReceiverName('');
    setTempReceiverBranch('');
    setShowOfflinePrompt(false);
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

  const handleAcceptOfflineFallback = () => {
    setIsOfflineFallback(true);
    setShowOfflinePrompt(false);
    
    const safeTrackingId = sanitizeTextInput(trackingId, 100).toUpperCase();
    const dummyParcel: Parcel = {
      TrackingID: safeTrackingId,
      'วันที่สร้าง': new Date().toISOString(),
      'ผู้ส่ง': 'จัดส่งแบบออฟไลน์',
      'สาขาผู้ส่ง': 'จัดส่งแบบออฟไลน์',
      'ผู้รับ': '',
      'สาขาผู้รับ': '',
      'สถานะ': 'กำลังจัดส่ง',
    };
    setCheckedParcel(dummyParcel);
    setForwardFromBranch('จัดส่งแบบออฟไลน์');
    setCurrentStep(2);
    requestLocation();
  };

  const checkParcelByTrackingId = async (rawTrackingId: string, shouldOpenCamera = false) => {
    const safeTrackingId = sanitizeTextInput(rawTrackingId, 100).toUpperCase();
    if (!safeTrackingId) {
      toast.error('กรุณาระบุหมายเลขติดตามก่อน');
      return;
    }
    if (!isValidTrackingId(safeTrackingId)) {
      toast.error('รูปแบบหมายเลขติดตามไม่ถูกต้อง');
      return;
    }

    setIsChecking(true);
    setShowOfflinePrompt(false);
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
          toast.warning('รายการนี้ส่งถึงปลายทางแล้ว');
        } else {
          toast.success(`พบรายการส่ง ปลายทาง: ${p['สาขาผู้รับ']}`);
          setCurrentStep(2); // Auto move to photo step
          requestLocation(); // Request GPS automatically on step 2
          if (shouldOpenCamera && fileInputRef) {
            setTimeout(() => fileInputRef.current?.click(), 250);
          }
        }
      } else {
        const errorMsg = String(res?.error || '');
        const isOffline = !navigator.onLine;
        if (isOffline || isNetworkErrorMessage(errorMsg)) {
          setShowOfflinePrompt(true);
          toast.error('เครือข่ายขัดข้อง ไม่สามารถตรวจสอบได้');
        } else {
          toast.error(res?.error || 'ไม่พบรายการ หรือหมายเลขไม่ถูกต้อง');
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '';
      const isOffline = !navigator.onLine;
      if (isOffline || isNetworkErrorMessage(errorMsg)) {
        setShowOfflinePrompt(true);
        toast.error('เครือข่ายขัดข้อง ไม่สามารถตรวจสอบได้');
      } else {
        toast.error('เกิดข้อผิดพลาดในการตรวจสอบ');
      }
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
    resetFormState();
    setTrackingId(safeTrackingId);
    if (fileInputRef?.current) fileInputRef.current.value = '';

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
      toast.error('เบราว์เซอร์ไม่รองรับการวางอัตโนมัติ (กรุณากดวางเอง)');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const safeText = sanitizeTextInput(text, 100).toUpperCase();
      if (safeText) {
        setTrackingId(safeText);
        toast.success('วางหมายเลขติดตามแล้ว');
      }
    } catch {
      toast.error('ไม่สามารถวางได้ กรุณากดวางเองหรือเปิดสิทธิ์เข้าถึง');
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
      if (isOfflineFallback && checkedParcel) {
        const resolvedBranch = resolveSelectValue(tempReceiverBranch);
        if (!tempReceiverName.trim()) {
          toast.error('กรุณาระบุชื่อผู้รับ');
          setIsLoading(false);
          return;
        }
        if (!resolvedBranch) {
          toast.error('กรุณาระบุสาขาผู้รับ');
          setIsLoading(false);
          return;
        }
        checkedParcel['ผู้รับ'] = tempReceiverName.trim();
        checkedParcel['สาขาผู้รับ'] = resolvedBranch;
      }

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
        needsGpsOverrideReason && !safeGpsOverrideReason ? 'กรุณาระบุเหตุผลที่ไม่ระบุตำแหน่ง GPS' :
        !actionPayload ? 'กรุณาตรวจสอบรายการก่อนยืนยัน' :
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

      toast.info('กำลังยืนยันการจัดส่ง...');
      
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
        toast.success(response.queued ? 'บันทึกออฟไลน์แล้ว ระบบจะซิงค์เมื่อเชื่อมต่อได้' : 'ยืนยันจัดส่งสำเร็จ');
        resetFormState();
        onComplete?.();
      } else {
        toast.error(response?.error ? `ยืนยันจัดส่งไม่สำเร็จ: ${response.error}` : 'ยืนยันจัดส่งไม่สำเร็จ กรุณาลองใหม่');
        // Revert local update
        if (typeof loadParcels === 'function') loadParcels(undefined, true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    branches,
    currentStep,
    setCurrentStep,
    trackingId,
    setTrackingId,
    photoUrl,
    photoPreview,
    isProcessingImage,
    clearProofImage,
    note,
    setNote,
    position,
    geoStatus,
    geoError,
    requestLocation,
    resetGeo,
    isGpsBypassed,
    setIsGpsBypassed,
    isForwarding,
    setIsForwarding,
    forwardSender,
    setForwardSender,
    forwardFromBranch,
    setForwardFromBranch,
    forwardToBranch,
    setForwardToBranch,
    isProxy,
    setIsProxy,
    proxyName,
    setProxyName,
    deliveryMatchStatus,
    setDeliveryMatchStatus,
    deliveryMismatchReason,
    setDeliveryMismatchReason,
    gpsOverrideReason,
    setGpsOverrideReason,
    showAdvancedOptions,
    setShowAdvancedOptions,
    isLoading,
    isChecking,
    isAutoPreparingCamera,
    checkedParcel,
    isDelivered,
    pendingOfflineCount,
    effectiveGeoStatus,
    needsGpsOverrideReason,
    canProceedFromPhoto,
    resetFormState,
    handleCloseStep,
    handleCheckParcel,
    handlePasteTrackingID,
    handleFileSelect,
    executeConfirm,
    isOfflineFallback,
    setIsOfflineFallback,
    tempReceiverName,
    setTempReceiverName,
    tempReceiverBranch,
    setTempReceiverBranch,
    showOfflinePrompt,
    setShowOfflinePrompt,
    handleAcceptOfflineFallback,
  };
}
