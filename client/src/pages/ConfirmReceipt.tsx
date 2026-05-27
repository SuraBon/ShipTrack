/**
 * Confirm Receipt Page
 * ยืนยันส่งด้วยรูปภาพ
 * Design: Premium Stepper UI
 */

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '@/components/ui/spinner';
import { useConfirmReceiptForm } from '@/hooks/useConfirmReceiptForm';
import { Step1CheckTracking } from '@/components/confirm-receipt/Step1CheckTracking';
import { Step2PhotoEvidence } from '@/components/confirm-receipt/Step2PhotoEvidence';
import { Step3ConfirmDetails } from '@/components/confirm-receipt/Step3ConfirmDetails';
import { StepIndicator } from '@/components/confirm-receipt/ConfirmReceiptShared';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
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
    handleCloseStep,
    handleCheckParcel,
    handlePasteTrackingID,
    handleFileSelect,
    executeConfirm,
    isOfflineFallback,
    tempReceiverName,
    setTempReceiverName,
    tempReceiverBranch,
    setTempReceiverBranch,
    showOfflinePrompt,
    handleAcceptOfflineFallback,
  } = useConfirmReceiptForm({
    initialTrackingId,
    onInitialTrackingIdConsumed,
    autoCheckInitial,
    autoOpenCamera,
    embedded,
    onClose,
    onComplete,
    fileInputRef,
  });

  return (
    <div className={`${embedded ? 'flex max-h-full min-h-0 w-full flex-col overflow-hidden' : 'app-page-narrow'} animate-in fade-in slide-in-from-bottom-4 duration-700`}>
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
        <div className="relative shrink-0 border-b border-slate-800 bg-slate-950 px-4 py-3 text-white sm:px-5 sm:py-3.5">
          {onClose && (
            <button
              type="button"
              onClick={handleCloseStep}
              className="absolute right-3 top-2.5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95 sm:right-4"
              aria-label="ปิดหน้านี้"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
            </button>
          )}
          <h2 className="font-display pr-12 text-sm font-semibold leading-snug text-white sm:text-base">
            {currentStep === 1 && 'ระบุหมายเลขติดตาม'}
            {currentStep === 2 && 'ถ่ายรูปหลักฐาน'}
            {currentStep === 3 && 'ยืนยันข้อมูล'}
          </h2>
          <p className="mt-0.5 min-w-0 pr-12 text-[11px] text-slate-400">
            {checkedParcel ? (
              <span className="font-mono font-semibold text-slate-300">{checkedParcel.TrackingID}</span>
            ) : (
              'ตรวจสอบหมายเลขก่อนทำรายการ'
            )}
          </p>
          <StepIndicator currentStep={currentStep} compact onDark />
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

      <div className={embedded ? 'modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain' : undefined}>
      {isAutoPreparingCamera && currentStep === 1 && (
        <div className={`text-center animate-in fade-in zoom-in-95 duration-300 ${embedded ? 'p-6' : 'app-panel p-8'}`}>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Spinner className="h-9 w-9" />
          </div>
          <h2 className="font-display text-lg font-black text-primary sm:text-xl">กำลังเปิดกล้อง...</h2>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant/60">กำลังตรวจสอบรายการและเตรียมถ่ายรูป</p>
        </div>
      )}
      {/* Step 1: Check Tracking ID */}
      {currentStep === 1 && !isAutoPreparingCamera && (
        <Step1CheckTracking
          trackingId={trackingId}
          setTrackingId={setTrackingId}
          handlePasteTrackingID={handlePasteTrackingID}
          checkedParcel={checkedParcel}
          isDelivered={isDelivered}
          handleCheckParcel={handleCheckParcel}
          isChecking={isChecking}
          embedded={embedded}
          showOfflinePrompt={showOfflinePrompt}
          handleAcceptOfflineFallback={handleAcceptOfflineFallback}
        />
      )}

      {/* Step 2: Photo Evidence */}
      {currentStep === 2 && (
        <Step2PhotoEvidence
          embedded={embedded}
          checkedParcel={checkedParcel}
          fileInputRef={fileInputRef}
          handleFileSelect={handleFileSelect}
          photoPreview={photoPreview}
          isProcessingImage={isProcessingImage}
          effectiveGeoStatus={effectiveGeoStatus}
          position={position}
          geoError={geoError}
          isGpsBypassed={isGpsBypassed}
          setIsGpsBypassed={setIsGpsBypassed}
          requestLocation={requestLocation}
          needsGpsOverrideReason={needsGpsOverrideReason}
          gpsOverrideReason={gpsOverrideReason}
          setGpsOverrideReason={setGpsOverrideReason}
          setCurrentStep={setCurrentStep}
          canProceedFromPhoto={canProceedFromPhoto}
        />
      )}

      {/* Step 3: Final Details & Confirm */}
      {currentStep === 3 && (
        <Step3ConfirmDetails
          embedded={embedded}
          checkedParcel={checkedParcel}
          trackingId={trackingId}
          needsGpsOverrideReason={needsGpsOverrideReason}
          gpsOverrideReason={gpsOverrideReason}
          setGpsOverrideReason={setGpsOverrideReason}
          showAdvancedOptions={showAdvancedOptions}
          setShowAdvancedOptions={setShowAdvancedOptions}
          isProxy={isProxy}
          setIsProxy={setIsProxy}
          setIsForwarding={setIsForwarding}
          setDeliveryMatchStatus={setDeliveryMatchStatus}
          setDeliveryMismatchReason={setDeliveryMismatchReason}
          proxyName={proxyName}
          setProxyName={setProxyName}
          deliveryMatchStatus={deliveryMatchStatus}
          deliveryMismatchReason={deliveryMismatchReason}
          isForwarding={isForwarding}
          forwardSender={forwardSender}
          setForwardSender={setForwardSender}
          forwardToBranch={forwardToBranch}
          setForwardToBranch={setForwardToBranch}
          branches={branches}
          note={note}
          setNote={setNote}
          isLoading={isLoading}
          executeConfirm={executeConfirm} // onClick={executeConfirm}
          setCurrentStep={setCurrentStep}
          isOfflineFallback={isOfflineFallback}
          tempReceiverName={tempReceiverName}
          setTempReceiverName={setTempReceiverName}
          tempReceiverBranch={tempReceiverBranch}
          setTempReceiverBranch={setTempReceiverBranch}
        />
      )}
      </div>
    </div>
  );
}
