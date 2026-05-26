/**
 * Create Parcel Page
 * สร้างรายการส่งใหม่
 * Design: Premium Logistics
 */

import { useState, useEffect, useRef } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { useBranches } from '@/hooks/useBranches';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { formatThaiDateTime } from '@/lib/dateUtils';
import NativeSelect, { resolveSelectValue } from '@/components/NativeSelect';
import QRCode from 'qrcode';
import { sanitizeTextInput, validateRequiredText } from '@/lib/validation';
import { useGeolocation } from '@/hooks/useGeolocation';
import { getErrorMessage } from '@/lib/apiErrorHelper';
import { processProofImageFile } from '@/lib/imageProofHelper';
import {
  EMPTY_CREATE_PARCEL_DRAFT,
  clearCreateParcelDraft,
  loadCreateParcelDraft,
  saveCreateParcelDraft,
} from '@/lib/createParcelDraft';
import { UI_COPY } from '@/lib/uiCopy';

type CreatedParcelDetails = {
  senderName: string;
  senderBranch: string;
  receiverName: string;
  receiverBranch: string;
  createdAt: string;
};

export default function CreateParcel({ embedded = false }: { embedded?: boolean }) {
  const { createParcel } = useParcelStore();
  const { branches } = useBranches();
  const { position, status: geoStatus, errorMessage: geoError, requestLocation } = useGeolocation();
  const proofInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState(loadCreateParcelDraft);

  const [createdTrackingId, setCreatedTrackingId] = useState<string | null>(null);
  const [createdParcelDetails, setCreatedParcelDetails] = useState<CreatedParcelDetails | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [proofPhotoUrl, setProofPhotoUrl] = useState('');
  const [proofPhotoPreview, setProofPhotoPreview] = useState<string | null>(null);

  // Generate QR code locally whenever a new tracking ID is created
  useEffect(() => {
    if (!createdTrackingId) { setQrDataUrl(null); return; }
    QRCode.toDataURL(createdTrackingId, { width: 256, margin: 1 })
      .then(url => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [createdTrackingId]);

  useEffect(() => {
    if (geoStatus === 'idle') requestLocation();
  }, [geoStatus, requestLocation]);

  useEffect(() => {
    saveCreateParcelDraft(formData);
  }, [formData]);

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

  const processProofImage = async (file: File) => {
    setIsProcessingImage(true);
    try {
      const image = await processProofImageFile(file);
      setProofPhotoPreview(image.dataUrl);
      setProofPhotoUrl(image.dataUrl);
      toast.success('แนบรูปหลักฐานแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ'));
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleProofFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processProofImage(file);
  };

  const clearProofPhoto = () => {
    setProofPhotoPreview(null);
    setProofPhotoUrl('');
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
      toast.error('กรุณาอนุญาตตำแหน่ง GPS เพื่อบันทึกจุดรับของก่อนสร้างรายการ');
      if (geoStatus !== 'loading') requestLocation();
      return;
    }
    if (!proofPhotoUrl) {
      toast.error('กรุณาแนบรูปสิ่งที่ส่ง');
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (isLoading) return;
    if (!position) {
      toast.error('กรุณาอนุญาตตำแหน่ง GPS เพื่อบันทึกจุดรับของก่อนสร้างรายการ');
      if (geoStatus !== 'loading') requestLocation();
      return;
    }
    if (!proofPhotoUrl) {
      toast.error('กรุณาแนบรูปสิ่งที่ส่ง');
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
      if (result.trackingId) {
        setCreatedTrackingId(result.trackingId);
        setCreatedParcelDetails({
          senderName: v.senderName,
          senderBranch: v.senderBranch,
          receiverName: v.receiverName,
          receiverBranch: v.receiverBranch,
          createdAt: new Date().toISOString(),
        });
        setIsResultOpen(true);
        clearCreateParcelDraft();
        setFormData(EMPTY_CREATE_PARCEL_DRAFT);
        clearProofPhoto();
      } else {
        toast.error(result.error || 'ไม่สามารถสร้างรายการได้');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyTrackingId = () => {
    if (createdTrackingId) {
      navigator.clipboard.writeText(createdTrackingId);
      toast.success('คัดลอกหมายเลขติดตามแล้ว');
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
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="app-desktop-split">
        <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Sender Section */}
          <div className="app-card overflow-hidden">
            <div className="app-panel-header">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <span className="material-symbols-outlined text-base">person</span>
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
                  <span className="material-symbols-outlined text-base">
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
                <div className="flex size-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
                  <span className="material-symbols-outlined text-base">flag</span>
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
              <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <span className="material-symbols-outlined text-base">inventory_2</span>
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
                  className="flex min-h-[138px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center transition-colors hover:bg-gray-100 active:scale-[0.99] disabled:opacity-75 disabled:pointer-events-none"
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
                        <span className="material-symbols-outlined text-2xl">add_a_photo</span>
                      </span>
                      <span className="text-sm font-semibold text-foreground">ถ่ายหรือแนบรูปสิ่งที่ส่ง</span>
                      <span className="text-xs text-muted-foreground">ใช้ยืนยันของที่พนักงานส่งต้องรับไปส่ง</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-card shadow-sm relative">
                  <div className="relative aspect-[4/3] bg-surface-container-low">
                    <img src={proofPhotoPreview} alt="รูปสิ่งที่ส่ง" className="h-full w-full object-cover" />
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
                      <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isProcessingImage}
                    onClick={() => proofInputRef.current?.click()}
                    className="flex h-11 w-full items-center justify-center gap-2 bg-muted text-sm font-semibold text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg">photo_camera</span>
                    เปลี่ยนรูป
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        </div>

        <aside className="hidden md:block">
          <div className="sticky top-20 space-y-3">
            <div className="app-panel overflow-hidden">
              <div className="bg-slate-900 px-4 py-3 text-white">
                <p className="text-sm font-semibold">สรุปรายการส่ง</p>
                <p className="text-[11px] text-white/55">ตรวจต้นทาง ปลายทาง และหลักฐานก่อนสร้างรายการ</p>
              </div>
              <div className="space-y-3 p-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.18)]" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-700">{formData.senderName || 'ผู้ส่ง'}</p>
                      <p className="truncate text-[11px] text-slate-500">{resolveSelectValue(formData.senderBranch) || 'แผนก/สาขาต้นทาง'}</p>
                    </div>
                  </div>
                  <div className="my-2 ml-1 h-4 border-l border-slate-200" />
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.18)]" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-700">{formData.receiverName || 'ผู้รับ/ปลายทาง'}</p>
                      <p className="truncate text-[11px] text-slate-500">{resolveSelectValue(formData.receiverBranch) || 'แผนก/สาขาหรือสถานที่ปลายทาง'}</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 text-xs">
                  <div className="flex items-start gap-2 rounded-xl bg-gray-50 p-3">
                    <span className="material-symbols-outlined text-base text-gray-400">inventory_2</span>
                    <p className="min-w-0 break-words text-gray-600"><span className="font-semibold text-gray-800">สิ่งที่ส่ง:</span> {formData.description || '-'}</p>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-orange-50/70 p-3">
                    <span className="material-symbols-outlined text-base text-orange-400">sticky_note_2</span>
                    <p className="min-w-0 break-words text-gray-600"><span className="font-semibold text-orange-600">หมายเหตุ:</span> {formData.note || '-'}</p>
                  </div>
                  <div className={`flex items-center gap-2 rounded-xl p-3 ${position ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-50 text-gray-500'}`}>
                    <span className="material-symbols-outlined text-base">{position ? 'my_location' : 'location_searching'}</span>
                    <span className="font-semibold">{position ? 'บันทึกตำแหน่งจุดรับแล้ว' : 'รอตำแหน่งจุดรับ'}</span>
                  </div>
                  <div className={`flex items-center gap-2 rounded-xl p-3 ${proofPhotoPreview ? 'bg-blue-50 text-blue-800' : 'bg-gray-50 text-gray-500'}`}>
                    <span className="material-symbols-outlined text-base">{proofPhotoPreview ? 'image' : 'add_a_photo'}</span>
                    <span className="font-semibold">{proofPhotoPreview ? 'แนบรูปสิ่งที่ส่งแล้ว' : 'ยังไม่ได้แนบรูป'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
        </div>

        <div className="app-bottom-action">
          <div className="mx-auto flex max-w-[390px] md:max-w-none md:justify-end">
          <button
            type="submit"
            disabled={isLoading || isProcessingImage}
            className="app-primary-button h-12 w-full md:w-auto md:px-6 disabled:opacity-55 disabled:cursor-not-allowed"
          >
            {isLoading || isProcessingImage ? <Spinner className="h-5 w-5" /> : <span className="material-symbols-outlined">add_circle</span>}
            {isProcessingImage ? 'กำลังประมวลผลรูปภาพ...' : isLoading ? 'กำลังสร้างรายการ...' : UI_COPY.action.create}
          </button>
          </div>
        </div>
      </form>

      {/* Confirmation Modal */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-xl">
          <div className="flex max-h-[92vh] flex-col">
            {/* Header */}
            <div className="bg-slate-950 px-5 py-5 text-white sm:px-6">
              <div className="min-w-0 text-left">
                <DialogTitle className="font-display text-xl font-black leading-tight sm:text-2xl">สรุปรายการส่ง</DialogTitle>
                <p className="mt-1 text-xs font-semibold text-slate-300">ตรวจต้นทาง ปลายทาง และหลักฐานก่อนสร้างรายการ</p>
              </div>
            </div>

            <div className="modal-scroll flex-1 overflow-y-auto bg-white p-4 sm:p-5">
              <div className="space-y-3">
                {/* Route summary */}
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="relative space-y-6">
                    <div className="absolute bottom-6 left-[9px] top-6 w-px bg-slate-200" />
                    <div className="relative flex min-w-0 gap-3">
                      <span className="mt-1 size-[18px] shrink-0 rounded-full border-[5px] border-blue-100 bg-blue-500 shadow-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-base font-black leading-tight text-slate-900">{formData.senderName}</p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-blue-900/70">{resolveSelectValue(formData.senderBranch)}</p>
                      </div>
                    </div>

                    <div className="relative flex min-w-0 gap-3">
                      <span className="mt-1 size-[18px] shrink-0 rounded-full border-[5px] border-red-100 bg-red-400 shadow-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-base font-black leading-tight text-slate-900">{formData.receiverName}</p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-blue-900/70">{resolveSelectValue(formData.receiverBranch)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Parcel Details */}
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <span className="material-symbols-outlined mt-0.5 text-3xl text-slate-400">inventory_2</span>
                  <p className="min-w-0 break-words text-base font-semibold text-slate-800">
                    <span className="font-black text-slate-950">สิ่งที่ส่ง:</span> {formData.description || '-'}
                  </p>
                </div>

                {/* Note */}
                <div className="flex items-start gap-3 rounded-2xl bg-orange-50 px-4 py-4">
                  <span className="material-symbols-outlined mt-0.5 text-3xl text-orange-500">sticky_note_2</span>
                  <p className="min-w-0 break-words text-base font-semibold leading-relaxed text-slate-800">
                    <span className="font-black text-orange-600">หมายเหตุ:</span> {formData.note || '-'}
                  </p>
                </div>

                <div className={`flex items-center gap-3 rounded-2xl px-4 py-4 ${position ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-500'}`}>
                  <span className="material-symbols-outlined text-3xl">{position ? 'my_location' : 'location_searching'}</span>
                  <span className="min-w-0 text-base font-black">{position ? 'บันทึกตำแหน่งจุดรับแล้ว' : 'รอตำแหน่งจุดรับ'}</span>
                </div>

                <div className={`overflow-hidden rounded-2xl ${proofPhotoPreview ? 'bg-blue-50 text-blue-800' : 'bg-slate-50 text-slate-500'}`}>
                  <div className="flex items-center gap-3 px-4 py-4">
                    <span className="material-symbols-outlined text-3xl">{proofPhotoPreview ? 'image' : 'add_photo_alternate'}</span>
                    <span className="min-w-0 text-base font-black">{proofPhotoPreview ? 'แนบรูปสิ่งที่ส่งแล้ว' : 'ยังไม่ได้แนบรูปสิ่งที่ส่ง'}</span>
                  </div>
                  {proofPhotoPreview && (
                    <div className="border-t border-blue-100 bg-white p-2">
                      <img
                        src={proofPhotoPreview}
                        alt="รูปสิ่งที่ส่ง"
                        className="max-h-[48vh] w-full rounded-xl bg-slate-50 object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 bg-white p-4 sm:p-5">
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  onClick={() => setIsConfirmOpen(false)}
                  className="app-secondary-button h-11 flex-1 rounded-xl"
                >
                  แก้ไข
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={isLoading}
                  className="app-primary-button h-11 flex-[2] rounded-xl"
                >
                  {isLoading ? (
                    <Spinner className="h-5 w-5" />
                  ) : (
                    <>
                  ยืนยันสร้างรายการ
                      <span className="material-symbols-outlined text-xl">verified</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent 
            showCloseButton={false}
            className="w-[calc(100vw-1rem)] max-w-md max-h-[92vh] overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white p-0 shadow-xl"
          >
          <div className="max-h-[92vh] overflow-y-auto">
          <div className="relative w-full bg-slate-950 px-5 py-6 text-center text-white sm:p-7">
            <button
              type="button"
              onClick={() => setIsResultOpen(false)}
              className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="ปิดผลการสร้างรายการ"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/10 text-white sm:size-16">
              <span className="material-symbols-outlined text-3xl sm:text-4xl">check_circle</span>
            </div>
            <DialogTitle className="text-xl font-black text-white sm:text-2xl">สร้างรายการสำเร็จ</DialogTitle>
            <p className="mt-1 text-sm font-semibold text-slate-300">สร้างหมายเลขติดตามเรียบร้อยแล้ว</p>
          </div>

          <div className="w-full p-4 sm:p-6 space-y-5">
            <div className="flex min-w-0 flex-col items-center gap-5 rounded-2xl border border-gray-100 bg-slate-50 p-4 shadow-sm sm:p-6">
              <div className="flex w-full min-w-0 flex-col items-center gap-1">
                <span className="text-xs font-black text-slate-400">หมายเลขติดตาม</span>
                <code className="block max-w-full break-all text-center font-mono text-[clamp(1.25rem,7vw,1.875rem)] font-black leading-tight text-slate-950">{createdTrackingId}</code>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    className="h-32 w-32 max-w-[46vw] max-h-[46vw] mix-blend-multiply"
                    alt="คิวอาร์โค้ด"
                  />
                ) : (
                  <div className="w-32 h-32 flex flex-col items-center justify-center text-on-surface-variant/40 text-center">
                    <span className="material-symbols-outlined text-3xl mb-1">qr_code</span>
                    <span className="text-[10px]">กำลังสร้าง QR...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleCopyTrackingId}
                className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-xl">content_copy</span>
                คัดลอกหมายเลข
              </button>
              <button
                onClick={async () => {
                  const printWindow = window.open('', '', 'width=400,height=500');
                  if (printWindow) {
                    const labelDetails = createdParcelDetails ?? {
                      ...getFinalValues(),
                      createdAt: new Date().toISOString(),
                    };
                    const trackingId = createdTrackingId ?? '';
                    // Generate QR locally for print
                    let printQrSrc = '';
                    try {
                      printQrSrc = await QRCode.toDataURL(trackingId, { width: 200, margin: 1 });
                    } catch { /* fallback: no QR */ }
                    const doc = printWindow.document;
                    doc.title = 'ShipTrack Label';
                    const meta = doc.createElement('meta');
                    meta.setAttribute('charset', 'utf-8');
                    doc.head.appendChild(meta);
                    doc.body.style.margin = '0';
                    doc.body.style.padding = '16px';

                    const label = doc.createElement('div');
                    label.style.cssText = 'text-align:center;font-family:sans-serif;padding:28px;border:4px solid #091426;border-radius:20px;max-width:400px;margin:auto;box-sizing:border-box;';

                    const header = doc.createElement('div');
                    header.style.cssText = 'background:#091426;color:#fff;padding:15px;border-radius:12px;margin-bottom:20px;';
                    const title = doc.createElement('h2');
                    title.style.cssText = 'margin:0;font-size:24px;';
                    title.textContent = 'ShipTrack';
                    header.appendChild(title);

                    const trackingHeading = doc.createElement('h1');
                    trackingHeading.style.cssText = 'font-size:clamp(24px,8vw,38px);margin:10px 0;font-family:monospace;letter-spacing:1px;overflow-wrap:anywhere;line-height:1.1;';
                    trackingHeading.textContent = trackingId;

                    const qrImg = doc.createElement('img');
                    qrImg.alt = 'QR code';
                    qrImg.style.cssText = 'width:180px;height:180px;margin:20px 0;';
                    if (printQrSrc) {
                      qrImg.src = printQrSrc;
                    }

                    const details = doc.createElement('div');
                    details.style.cssText = 'margin-top:20px;text-align:left;border-top:2px solid #eee;padding-top:20px;';
                    const sender = doc.createElement('div');
                    sender.style.marginBottom = '10px';
                    const senderLabel = doc.createElement('p');
                    senderLabel.style.cssText = 'margin:0;font-size:10px;color:#666;text-transform:uppercase;font-weight:bold;';
                    senderLabel.textContent = 'ผู้ส่ง';
                    const senderInfo = doc.createElement('p');
                    senderInfo.style.cssText = 'margin:0;font-weight:bold;';
                    senderInfo.textContent = `${labelDetails.senderName} (${labelDetails.senderBranch})`;
                    sender.append(senderLabel, senderInfo);

                    const receiver = doc.createElement('div');
                    const receiverLabel = doc.createElement('p');
                    receiverLabel.style.cssText = 'margin:0;font-size:10px;color:#666;text-transform:uppercase;font-weight:bold;';
                    receiverLabel.textContent = 'ผู้รับ';
                    const receiverInfo = doc.createElement('p');
                    receiverInfo.style.cssText = 'margin:0;font-weight:bold;';
                    receiverInfo.textContent = `${labelDetails.receiverName} (${labelDetails.receiverBranch})`;
                    receiver.append(receiverLabel, receiverInfo);
                    details.append(sender, receiver);

                    const createdAt = doc.createElement('p');
                    createdAt.style.cssText = 'margin-top:30px;font-size:10px;color:#999;font-style:italic;';
                    createdAt.textContent = `สร้างเมื่อ: ${formatThaiDateTime(labelDetails.createdAt)}`;

                    label.append(header, trackingHeading, qrImg, details, createdAt);
                    doc.body.replaceChildren(label);
                    printWindow.setTimeout(() => {
                      printWindow.print();
                      printWindow.close();
                    }, 150);
                  }
                }}
                className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-colors hover:bg-slate-900"
              >
                <span className="material-symbols-outlined text-xl">print</span>
                พิมพ์ใบปะหน้า
              </button>
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
