/**
 * Create Parcel Page
 * สร้างรายการส่งใหม่
 * Design: Premium Logistics
 */

import { useState, useEffect, useRef } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { useBranches } from '@/hooks/useBranches';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import NativeSelect, { resolveSelectValue } from '@/components/NativeSelect';
import { sanitizeTextInput, validateRequiredText } from '@/lib/validation';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useProofImage } from '@/hooks/useProofImage';
import {
  EMPTY_CREATE_PARCEL_DRAFT,
  clearCreateParcelDraft,
  loadCreateParcelDraft,
  loadCreateParcelDraftFromDb,
  saveCreateParcelDraft,
} from '@/lib/createParcelDraft';
import { UI_COPY } from '@/lib/uiCopy';
import { CreateParcelDialogs } from '@/components/create-parcel/CreateParcelDialogs';



export default function CreateParcel({ embedded = false }: { embedded?: boolean }) {
  const { createParcel } = useParcelStore();
  const offlineQueue = useOfflineQueue();
  const { branches } = useBranches();
  const { position, status: geoStatus, errorMessage: geoError, requestLocation } = useGeolocation();
  const proofInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState(loadCreateParcelDraft);

  const [createdTrackingId, setCreatedTrackingId] = useState<string | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {
    imageUrl: proofPhotoUrl,
    previewUrl: proofPhotoPreview,
    isProcessingImage,
    processImageFile: processProofImage,
    clearImage: clearProofImage,
  } = useProofImage();
  const pendingOfflineCount = offlineQueue.filter(item => item.status === 'pending' || item.status === 'failed').length;

  useEffect(() => {
    if (geoStatus === 'idle') requestLocation();
  }, [geoStatus, requestLocation]);

  useEffect(() => {
    let active = true;
    loadCreateParcelDraftFromDb().then(draft => {
      if (active) setFormData(draft);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    saveCreateParcelDraft(formData);
    const isDirty = Boolean(
      formData.senderName ||
      formData.senderBranch ||
      formData.receiverName ||
      formData.receiverBranch ||
      formData.description ||
      formData.note ||
      proofPhotoUrl
    );
    if (isDirty) {
      sessionStorage.setItem('shiptrack:create_parcel_dirty', 'true');
    } else {
      sessionStorage.removeItem('shiptrack:create_parcel_dirty');
    }
  }, [formData, proofPhotoUrl]);

  useEffect(() => {
    if (!isLoading) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProofFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processProofImage(file);
  };

  const clearProofPhoto = () => {
    clearProofImage();
    if (proofInputRef.current) proofInputRef.current.value = '';
  };

  /** Resolves the final submitted values, replacing OTHER_VALUE with custom inputs. */
  const getFinalValues = () => ({
    senderName:     sanitizeTextInput(formData.senderName, 200),
    senderBranch:   sanitizeTextInput(resolveSelectValue(formData.senderBranch), 100),
    receiverName:   sanitizeTextInput(formData.receiverName, 200),
    receiverBranch: sanitizeTextInput(resolveSelectValue(formData.receiverBranch), 100),
    description:    sanitizeTextInput(formData.description, 200),
    note:           sanitizeTextInput(formData.note, 2000),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = getFinalValues();

    // ✅ FIX: Proper validation with specific messages
    const validationError =
      validateRequiredText(v.senderName, 'ชื่อผู้ส่ง', 2, 200) ||
      validateRequiredText(v.senderBranch, 'แผนก/สาขาผู้ส่ง', 1, 100) ||
      validateRequiredText(v.receiverName, 'ชื่อผู้รับหรือชื่อสถานที่ปลายทาง', 2, 200) ||
      validateRequiredText(v.receiverBranch, 'จุดหมายปลายทาง', 1, 100) ||
      validateRequiredText(v.description, 'รายละเอียดสิ่งที่ส่ง', 1, 200) ||
      (v.note && validateRequiredText(v.note, 'หมายเหตุปลายทาง', 0, 2000));
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!position) {
      toast.error('กรุณาอนุญาตสิทธิ์การเข้าถึงตำแหน่ง GPS เพื่อบันทึกจุดรับพัสดุก่อนทำรายการ');
      if (geoStatus !== 'loading') requestLocation();
      return;
    }
    if (!proofPhotoUrl) {
      toast.error('กรุณาแนบรูปภาพสิ่งของที่นำจัดส่ง');
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (isLoading) return;
    if (!position) {
      toast.error('กรุณาอนุญาตสิทธิ์การเข้าถึงตำแหน่ง GPS เพื่อบันทึกจุดรับพัสดุก่อนทำรายการ');
      if (geoStatus !== 'loading') requestLocation();
      return;
    }
    if (!proofPhotoUrl) {
      toast.error('กรุณาแนบรูปภาพสิ่งของที่นำจัดส่ง');
      return;
    }
    setIsConfirmOpen(false);
    setIsLoading(true);
    const v = getFinalValues();
    try {
      const result = await createParcel(
        v.senderName, v.senderBranch,
        v.receiverName, v.receiverBranch,
        v.description, v.note,
        position.latitude,
        position.longitude,
        proofPhotoUrl,
      );
      if (result.queued) {
        toast.info('บันทึกรายการไว้ในเครื่องเรียบร้อยแล้ว ระบบจะซิงค์ข้อมูลเมื่อเชื่อมต่ออินเทอร์เน็ตได้');
        clearCreateParcelDraft();
        setFormData(EMPTY_CREATE_PARCEL_DRAFT);
        clearProofPhoto();
      } else if (result.trackingId) {
        setCreatedTrackingId(result.trackingId);
        setIsResultOpen(true);
        clearCreateParcelDraft();
        setFormData(EMPTY_CREATE_PARCEL_DRAFT);
        clearProofPhoto();
      } else {
        toast.error(result.error || 'ไม่สามารถสร้างรายการจัดส่งได้');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyTrackingId = () => {
    if (createdTrackingId) {
      navigator.clipboard.writeText(createdTrackingId);
      toast.success('คัดลอกหมายเลขติดตามพัสดุเรียบร้อยแล้ว');
    }
  };

  return (
    <div className={`${embedded ? 'max-w-none gap-4 pb-4' : 'app-page'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      {/* Header Section */}
      <div className={`${embedded ? 'hidden' : 'app-page-header'}`}>
        <div>
          <h1 className="app-page-title">{UI_COPY.nav.create}</h1>
          <p className="app-page-subtitle">กรอกข้อมูลที่จำเป็น แนบรูป และบันทึกตำแหน่งจุดรับ</p>
        </div>
        {pendingOfflineCount > 0 && (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            <span className="material-symbols-outlined text-base" aria-hidden="true">sync_problem</span>
            รอซิงค์ {pendingOfflineCount} รายการ
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Sender Section */}
          <div className="app-card overflow-hidden">
            <div className="app-panel-header">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">person</span>
                </div>
                <div>
                  <h2 className="app-section-title">ต้นทาง</h2>
                  <p className="text-xs text-muted-foreground">ผู้ส่งและจุดรับของ</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex flex-col gap-1.5">
                <label className="px-1 text-sm font-medium text-foreground">ชื่อผู้ส่ง *</label>
                <div className="relative">
                  <input
                    name="senderName"
                    value={formData.senderName}
                    onChange={handleInputChange}
                    placeholder="ระบุชื่อบริษัท หรือ ผู้ส่ง"
                    className="app-input w-full"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="px-1 text-sm font-medium text-foreground">แผนก/สาขาผู้ส่ง *</label>
                <NativeSelect
                  value={formData.senderBranch}
                  onChange={v => setFormData(p => ({ ...p, senderBranch: v }))}
                  options={branches}
                  placeholder="เลือกแผนก/สาขา"
                  icon="apartment"
                  otherPlaceholder="ระบุแผนก/สาขาผู้ส่ง"
                />
              </div>
              <div className={`inline-flex w-fit max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs ${
                geoStatus === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' :
                geoStatus === 'denied' || geoStatus === 'error' ? 'border-destructive/30 bg-destructive/5 text-destructive' :
                'border-border bg-muted text-muted-foreground'
              }`}>
                {geoStatus === 'loading' ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {geoStatus === 'success' ? 'my_location' :
                     geoStatus === 'denied' || geoStatus === 'error' ? 'location_disabled' : 'location_searching'}
                  </span>
                )}
                <span className="font-semibold">
                  {geoStatus === 'success' ? 'บันทึกตำแหน่งแล้ว' :
                   geoStatus === 'loading' ? 'กำลังอ่านตำแหน่ง' :
                   geoStatus === 'denied' ? 'ยังไม่ได้อนุญาตตำแหน่ง' :
                   geoStatus === 'error' ? 'ยังไม่ได้ตำแหน่ง' : 'รอตำแหน่ง'}
                </span>
                {(geoStatus === 'error' || geoStatus === 'denied') && (
                  <button
                    type="button"
                    onClick={requestLocation}
                    className="font-semibold underline underline-offset-2"
                    title={geoError || 'ลองดึงตำแหน่งอีกครั้ง'}
                  >
                    ลองใหม่
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Receiver Section */}
          <div className="app-card overflow-hidden">
            <div className="app-panel-header">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">flag</span>
                </div>
                <div>
                  <h2 className="app-section-title">ปลายทาง</h2>
                  <p className="text-xs text-muted-foreground">ผู้รับ จุดส่งของ และหมายเหตุ</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex flex-col gap-1.5">
                <label className="px-1 text-sm font-medium text-foreground">ผู้รับหรือสถานที่ปลายทาง *</label>
                <div className="relative">
                  <input
                    name="receiverName"
                    value={formData.receiverName}
                    onChange={handleInputChange}
                    placeholder="เช่น คุณสมชาย, แผนกบัญชี, ห้องธุรการ"
                    className="app-input w-full"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="px-1 text-sm font-medium text-foreground">แผนก/สาขา หรือสถานที่ปลายทาง *</label>
                <NativeSelect
                  value={formData.receiverBranch}
                  onChange={v => setFormData(p => ({ ...p, receiverBranch: v }))}
                  options={branches}
                  placeholder="เลือกแผนก/สาขา หรือระบุสถานที่ปลายทาง"
                  otherPlaceholder="ระบุสถานที่ปลายทาง"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="px-1 text-sm font-medium text-foreground">หมายเหตุปลายทาง (ถ้ามี)</label>
                <textarea
                  name="note"
                  value={formData.note}
                  onChange={handleInputChange}
                  placeholder="เช่น อาคาร A ชั้น 3 แผนกบัญชี, ฝากไว้ที่เคาน์เตอร์, โทรหาผู้รับก่อนถึง"
                  className="app-input min-h-24 w-full resize-none py-3"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Parcel Details */}
        <div className="app-card overflow-hidden">
          <div className="app-panel-header">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-surface-container text-slate-700 dark:text-muted-foreground">
                <span className="material-symbols-outlined text-base" aria-hidden="true">inventory_2</span>
              </div>
              <div>
                <h2 className="app-section-title">สิ่งที่ส่ง</h2>
                <p className="text-xs text-muted-foreground">รายละเอียดและรูปสิ่งที่ส่ง</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_1.15fr]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="px-1 text-sm font-medium text-foreground">รายละเอียดสิ่งที่ส่ง *</label>
                <div className="relative">
                  <input
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="เช่น เอกสาร 1 ชุด, พัสดุ 1 กล่อง"
                    className="app-input w-full"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="px-1 text-sm font-medium text-foreground">รูปสิ่งที่ส่ง *</label>
              <input
                ref={proofInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleProofFileSelect}
                className="hidden"
              />
              {!proofPhotoPreview ? (
                <button
                  type="button"
                  disabled={isProcessingImage}
                  onClick={() => proofInputRef.current?.click()}
                  className="flex min-h-[138px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 dark:border-outline-variant bg-gray-50 dark:bg-surface-container px-4 py-5 text-center transition-colors hover:bg-gray-100 dark:hover:bg-surface-container-high active:scale-[0.99] disabled:opacity-75 disabled:pointer-events-none"
                >
                  {isProcessingImage ? (
                    <>
                      <span className="grid size-11 place-items-center rounded-lg bg-background text-foreground shadow-xs">
                        <Spinner className="h-6 w-6" />
                      </span>
                      <span className="text-sm font-semibold text-foreground">กำลังบีบอัดและประมวลผลรูปภาพ...</span>
                    </>
                  ) : (
                    <>
                      <span className="grid size-11 place-items-center rounded-lg bg-background text-foreground shadow-xs">
                        <span className="material-symbols-outlined text-2xl" aria-hidden="true">add_a_photo</span>
                      </span>
                      <span className="text-sm font-semibold text-foreground">ถ่ายหรือแนบรูปสิ่งที่ส่ง</span>
                      <span className="text-xs text-muted-foreground">ใช้ยืนยันพัสดุตอนรับงาน</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-card shadow-sm relative">
                  <div className="relative aspect-[4/3] bg-surface-container-low">
                    <img src={proofPhotoPreview} alt="รูปสิ่งที่ส่ง" loading="lazy" className="h-full w-full object-cover" />
                    {isProcessingImage && (
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white gap-2">
                        <Spinner className="h-7 w-7" />
                        <span className="text-xs font-semibold">กำลังประมวลผล...</span>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={isProcessingImage}
                      onClick={clearProofPhoto}
                      className="absolute right-2 top-2 grid size-9 place-items-center rounded-lg bg-background text-foreground shadow-md transition-colors hover:bg-destructive hover:text-destructive-foreground active:scale-95 disabled:opacity-50"
                      aria-label="ลบรูปสิ่งที่ส่ง"
                    >
                      <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isProcessingImage}
                    onClick={() => proofInputRef.current?.click()}
                    className="flex h-11 w-full items-center justify-center gap-2 bg-muted text-sm font-semibold text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">photo_camera</span>
                    เปลี่ยนรูป
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        </div>

        {/* สรุปย่อต้นทาง-ปลายทางสำหรับช่วยกลุ่มผู้ใช้ทั่วไป/Low-tech ตรวจสอบความถูกต้อง */}
        {Boolean(formData.senderBranch || formData.receiverBranch || formData.receiverName || formData.description) && (
          <div className="app-card border border-amber-200/50 bg-amber-50/30 p-4 text-xs md:hidden animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1.5">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">fact_check</span>
              <span>ตรวจสอบข้อมูลรายการส่งสั้น ๆ:</span>
            </div>
            <div className="space-y-1.5 text-slate-700 font-semibold leading-relaxed">
              <p>
                🏢 <span className="text-slate-400">ส่งจาก:</span> <span className="font-black text-slate-900">{resolveSelectValue(formData.senderBranch) || '---'}</span> {formData.senderName && `(${formData.senderName})`}
              </p>
              <p>
                📍 <span className="text-slate-400">ปลายทาง:</span> <span className="font-black text-slate-900">{resolveSelectValue(formData.receiverBranch) || '---'}</span> {formData.receiverName && `(${formData.receiverName})`}
              </p>
              <p>
                📦 <span className="text-slate-400">สิ่งที่ส่ง:</span> <span className="font-black text-slate-900">{formData.description || '---'}</span>
              </p>
            </div>
          </div>
        )}

        <div className="app-bottom-action">
          <div className="mx-auto flex max-w-[390px] md:max-w-none md:justify-end">
          <button
            type="submit"
            disabled={isLoading || isProcessingImage}
            className="app-primary-button h-12 w-full md:w-auto md:px-6 disabled:opacity-55 disabled:cursor-not-allowed"
          >
            {isLoading || isProcessingImage ? <Spinner className="h-5 w-5" /> : <span className="material-symbols-outlined" aria-hidden="true">add_circle</span>}
            {isProcessingImage ? 'กำลังประมวลผลรูปภาพ...' : isLoading ? 'กำลังสร้างรายการ...' : UI_COPY.action.create}
          </button>
          </div>
        </div>
      </form>

      <CreateParcelDialogs
        isConfirmOpen={isConfirmOpen}
        setIsConfirmOpen={setIsConfirmOpen}
        isResultOpen={isResultOpen}
        setIsResultOpen={setIsResultOpen}
        formData={formData}
        proofPhotoPreview={proofPhotoPreview}
        position={position}
        isLoading={isLoading}
        handleConfirmSubmit={handleConfirmSubmit}
        createdTrackingId={createdTrackingId}
        handleCopyTrackingId={handleCopyTrackingId}
      />
    </div>
  );
}
