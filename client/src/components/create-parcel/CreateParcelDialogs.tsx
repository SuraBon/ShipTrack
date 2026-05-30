import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { resolveSelectValue } from '@/components/NativeSelect';
import type { CreateParcelDraft } from '@/lib/createParcelDraft';
import type { GeoPosition } from '@/hooks/useGeolocation';

type CreateParcelDialogsProps = {
  isConfirmOpen: boolean;
  setIsConfirmOpen: (open: boolean) => void;
  isResultOpen: boolean;
  setIsResultOpen: (open: boolean) => void;
  formData: CreateParcelDraft;
  proofPhotoPreview: string | null;
  position: GeoPosition | null;
  isLoading: boolean;
  handleConfirmSubmit: () => void;
  createdTrackingId: string | null;
  handleCopyTrackingId: () => void;
};

export function CreateParcelDialogs({
  isConfirmOpen,
  setIsConfirmOpen,
  isResultOpen,
  setIsResultOpen,
  formData,
  proofPhotoPreview,
  position,
  isLoading,
  handleConfirmSubmit,
  createdTrackingId,
  handleCopyTrackingId,
}: CreateParcelDialogsProps) {
  return (
    <>
    {/* Confirmation Modal */}
    <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg md:max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-outline-variant bg-card p-0 shadow-xl">
        <div className="flex max-h-[92vh] flex-col">
          {/* Header */}
          <div className="bg-primary px-5 py-5 text-primary-foreground sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <span className="material-symbols-outlined text-xl text-white" aria-hidden="true">fact_check</span>
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="font-display text-xl font-black leading-tight sm:text-2xl">ตรวจสอบก่อนสร้างรายการ</DialogTitle>
                <p className="mt-0.5 text-xs font-semibold text-slate-300">ตรวจต้นทาง ปลายทาง และหลักฐานให้ครบก่อนยืนยัน</p>
              </div>
            </div>
          </div>

          <div className="modal-scroll flex-1 overflow-y-auto bg-surface-container p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {/* Left Column: Details */}
              <div className="space-y-3">
                {/* Route summary */}
                <div className="rounded-2xl bg-surface border border-outline-variant shadow-sm px-4 py-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">เส้นทางจัดส่ง</p>
                  <div className="relative space-y-5">
                    <div className="absolute bottom-5 left-[9px] top-5 w-px bg-slate-200" />
                    <div className="relative flex min-w-0 gap-3">
                      <span className="mt-1 size-[18px] shrink-0 rounded-full border-[5px] border-blue-100 bg-blue-500 shadow-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-slate-400 mb-0.5">ต้นทาง / ผู้ส่ง</p>
                        <p className="truncate font-display text-base font-black leading-tight text-slate-900">{formData.senderName || '-'}</p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-500">{resolveSelectValue(formData.senderBranch) || '-'}</p>
                      </div>
                    </div>

                    <div className="relative flex min-w-0 gap-3">
                      <span className="mt-1 size-[18px] shrink-0 rounded-full border-[5px] border-red-100 bg-red-400 shadow-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-slate-400 mb-0.5">ปลายทาง / ผู้รับ</p>
                        <p className="truncate font-display text-base font-black leading-tight text-slate-900">{formData.receiverName || '-'}</p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-500">{resolveSelectValue(formData.receiverBranch) || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Parcel Details */}
                <div className="flex items-start gap-3 rounded-2xl bg-surface border border-outline-variant shadow-sm px-4 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                    <span className="material-symbols-outlined text-xl text-slate-600" aria-hidden="true">inventory_2</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 mb-0.5">สิ่งที่ส่ง</p>
                    <p className="min-w-0 break-words text-base font-black text-slate-900">{formData.description || '-'}</p>
                  </div>
                </div>

                {/* Note */}
                <div className={`flex items-start gap-3 rounded-2xl border shadow-sm px-4 py-4 ${formData.note ? 'bg-amber-50 border-amber-200' : 'bg-surface border-outline-variant'}`}>
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${formData.note ? 'bg-amber-100' : 'bg-slate-100'}`}>
                    <span className={`material-symbols-outlined text-xl ${formData.note ? 'text-amber-600' : 'text-slate-400'}`} aria-hidden="true">sticky_note_2</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-bold mb-0.5 ${formData.note ? 'text-amber-600' : 'text-slate-400'}`}>หมายเหตุ</p>
                    <p className="min-w-0 break-words text-base font-semibold leading-relaxed text-slate-800">{formData.note || '-'}</p>
                  </div>
                </div>

                {/* GPS Status */}
                <div className={`flex items-center gap-3 rounded-2xl border shadow-sm px-4 py-3.5 ${position ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-surface border-outline-variant/60 text-slate-500'}`}>
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${position ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    <span className={`material-symbols-outlined text-xl ${position ? 'text-emerald-600' : 'text-slate-400'}`} aria-hidden="true">{position ? 'my_location' : 'location_searching'}</span>
                  </div>
                  <span className="min-w-0 text-sm font-black">{position ? 'บันทึกตำแหน่งจุดรับแล้ว' : 'รอตำแหน่งจุดรับ'}</span>
                </div>
              </div>

              {/* Right Column: Photo Evidence */}
              <div className="h-full">
                <div className={`overflow-hidden rounded-2xl border shadow-sm flex flex-col h-full ${proofPhotoPreview ? 'border-blue-200 bg-surface' : 'border-outline-variant bg-surface'}`}>
                  <div className={`flex items-center gap-3 px-4 py-3.5 shrink-0 ${proofPhotoPreview ? 'bg-blue-50 border-b border-blue-100' : 'bg-surface-container border-b border-outline-variant/60'}`}>
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${proofPhotoPreview ? 'bg-blue-100' : 'bg-surface'}`}>
                      <span className={`material-symbols-outlined text-xl ${proofPhotoPreview ? 'text-blue-600' : 'text-slate-400'}`} aria-hidden="true">{proofPhotoPreview ? 'image' : 'add_photo_alternate'}</span>
                    </div>
                    <div>
                      <p className={`text-[10px] font-bold mb-0.5 ${proofPhotoPreview ? 'text-blue-500' : 'text-slate-400'}`}>รูปถ่ายหลักฐาน</p>
                      <span className={`text-sm font-black ${proofPhotoPreview ? 'text-blue-800' : 'text-slate-500'}`}>{proofPhotoPreview ? 'แนบรูปเรียบร้อยแล้ว' : 'ยังไม่ได้แนบรูปถ่าย'}</span>
                    </div>
                  </div>
                  {proofPhotoPreview ? (
                    <div className="bg-surface p-2 flex-1 flex items-center justify-center min-h-[250px] md:min-h-0">
                      <img
                        src={proofPhotoPreview}
                        alt="รูปสิ่งที่ส่ง"
                        className="max-h-[38vh] md:max-h-[50vh] w-full rounded-xl bg-surface-container object-contain"
                      />
                    </div>
                  ) : (
                    <div className="bg-surface p-8 flex-1 flex flex-col items-center justify-center text-slate-300 min-h-[250px]">
                      <span className="material-symbols-outlined text-6xl mb-3">add_photo_alternate</span>
                      <span className="text-sm font-semibold text-slate-400">ไม่มีรูปถ่ายหลักฐาน</span>
                      <span className="text-xs text-slate-300 mt-1">กลับไปแนบรูปก่อนยืนยัน</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-outline-variant bg-surface p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="app-secondary-button h-12 w-full rounded-xl text-base font-bold"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_back</span>
                แก้ไข
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={isLoading}
                className="app-primary-button h-12 w-full rounded-xl text-base font-bold"
              >
                {isLoading ? (
                  <Spinner className="h-5 w-5" />
                ) : (
                  <>
                    ยืนยันสร้างรายการ
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">verified</span>
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
          className="w-[calc(100vw-1rem)] max-w-md max-h-[92vh] overflow-hidden rounded-[1.75rem] border border-outline-variant bg-card p-0 shadow-xl"
        >
        <div className="max-h-[92vh] overflow-y-auto">
        <div className="relative w-full bg-slate-950 px-5 py-6 text-center text-white sm:p-7">
          <button
            type="button"
            onClick={() => setIsResultOpen(false)}
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="ปิดผลการสร้างรายการ"
          >
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">close</span>
          </button>
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/10 text-white sm:size-16">
            <span className="material-symbols-outlined text-3xl sm:text-4xl" aria-hidden="true">check_circle</span>
          </div>
          <DialogTitle className="text-xl font-black text-white sm:text-2xl">สร้างรายการสำเร็จ</DialogTitle>
          <p className="mt-1 text-sm font-semibold text-slate-300">สร้างหมายเลขติดตามเรียบร้อยแล้ว</p>
        </div>

        <div className="w-full p-4 sm:p-6 space-y-5">
          <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container p-6 shadow-sm text-center">
            <span className="text-xs font-black text-slate-400">หมายเลขติดตาม</span>
            <code className="block max-w-full break-all font-mono text-[clamp(1.5rem,7vw,2.25rem)] font-black leading-none text-slate-950 select-all">{createdTrackingId}</code>
            <p className="text-xs font-semibold text-slate-500 mt-3">
              คัดลอกรหัสติดตามนี้ส่งให้พนักงานเพื่อจัดส่งต่อได้ทันที
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopyTrackingId}
              className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface text-sm font-bold text-foreground transition-colors hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">content_copy</span>
              คัดลอกหมายเลข
            </button>
            <button
              onClick={() => setIsResultOpen(false)}
              className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-colors hover:bg-slate-900"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">done</span>
              เสร็จสิ้น
            </button>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>

    </>
  );
}
