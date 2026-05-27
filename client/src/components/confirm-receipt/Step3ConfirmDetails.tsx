import NativeSelect, { resolveSelectValue } from '@/components/NativeSelect';
import { sanitizeTextInput } from '@/lib/validation';
import type { DeliveryMatchStatus, Parcel } from '@/types/parcel';
import { confirmNavButtonClass, embeddedStepBodyClass, ParcelJobSummary } from './ConfirmReceiptShared';

interface Step3ConfirmDetailsProps {
  embedded: boolean;
  checkedParcel: Parcel | null;
  trackingId: string;
  needsGpsOverrideReason: boolean;
  gpsOverrideReason: string;
  setGpsOverrideReason: (val: string) => void;
  showAdvancedOptions: boolean;
  setShowAdvancedOptions: (val: boolean | ((prev: boolean) => boolean)) => void;
  isProxy: boolean;
  setIsProxy: (val: boolean) => void;
  setIsForwarding: (val: boolean) => void;
  setDeliveryMatchStatus: (val: DeliveryMatchStatus) => void;
  setDeliveryMismatchReason: (val: string) => void;
  proxyName: string;
  setProxyName: (val: string) => void;
  deliveryMatchStatus: DeliveryMatchStatus;
  deliveryMismatchReason: string;
  isForwarding: boolean;
  forwardSender: string;
  setForwardSender: (val: string) => void;
  forwardToBranch: string;
  setForwardToBranch: (val: string) => void;
  branches: string[];
  note: string;
  setNote: (val: string) => void;
  isLoading: boolean;
  executeConfirm: () => void;
  setCurrentStep: (step: number) => void;
  isOfflineFallback?: boolean;
  tempReceiverName?: string;
  setTempReceiverName?: (val: string) => void;
  tempReceiverBranch?: string;
  setTempReceiverBranch?: (val: string) => void;
}

export function Step3ConfirmDetails({
  embedded,
  checkedParcel,
  trackingId,
  needsGpsOverrideReason,
  gpsOverrideReason,
  setGpsOverrideReason,
  showAdvancedOptions,
  setShowAdvancedOptions,
  isProxy,
  setIsProxy,
  setIsForwarding,
  setDeliveryMatchStatus,
  setDeliveryMismatchReason,
  proxyName,
  setProxyName,
  deliveryMatchStatus,
  deliveryMismatchReason,
  isForwarding,
  forwardSender,
  setForwardSender,
  forwardToBranch,
  setForwardToBranch,
  branches,
  note,
  setNote,
  isLoading,
  executeConfirm,
  setCurrentStep,
  isOfflineFallback = false,
  tempReceiverName = '',
  setTempReceiverName = () => {},
  tempReceiverBranch = '',
  setTempReceiverBranch = () => {},
}: Step3ConfirmDetailsProps) {
  return (
    <div className="animate-in slide-in-from-right-4 duration-500">
      <div className={embedded ? '' : 'app-panel overflow-hidden'}>
        {!embedded && (
          <div className="app-panel-header p-5 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <span className="material-symbols-outlined text-xl" aria-hidden="true">fact_check</span>
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-primary">เช็กปลายทางก่อนบันทึก</h2>
              <p className="text-xs text-on-surface-variant/60 mt-0.5">
                ตรวจต้นทาง ปลายทาง และผู้รับก่อนยืนยัน (พัสดุ: {checkedParcel?.TrackingID})
              </p>
            </div>
          </div>
        )}
        <div className={embedded ? embeddedStepBodyClass : 'p-6 sm:p-8 space-y-6'}>
          {checkedParcel && <ParcelJobSummary parcel={checkedParcel} compact={embedded} />}

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2.5 text-slate-600">
              <span className="material-symbols-outlined text-lg text-slate-800" aria-hidden="true">barcode_scanner</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold leading-none text-slate-400">หมายเลขติดตาม</span>
                <span className="font-mono text-sm font-black leading-tight text-slate-950">{trackingId}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-slate-600 w-full">
              <span className="material-symbols-outlined text-lg text-slate-800" aria-hidden="true">person</span>
              <div className="flex flex-col w-full">
                <span className="text-[10px] font-bold leading-none text-slate-400 mb-1">
                  ผู้รับ {isOfflineFallback && <span className="text-error font-bold">*</span>}
                </span>
                {isOfflineFallback ? (
                  <input
                    type="text"
                    placeholder="กรอกชื่อผู้รับ"
                    value={tempReceiverName}
                    onChange={(e) => setTempReceiverName(sanitizeTextInput(e.target.value, 200))}
                    className="w-full rounded-xl border border-outline-variant bg-white py-1.5 px-3 font-display text-sm font-bold outline-none focus:ring-1 focus:ring-primary text-slate-955"
                  />
                ) : (
                  <span className="text-sm font-black leading-tight text-slate-950">{checkedParcel?.['ผู้รับ'] || '-'}</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-slate-50 p-3">
            <div className="flex items-start gap-2.5 w-full">
              <span className="material-symbols-outlined mt-0.5 text-lg text-slate-700" aria-hidden="true">flag</span>
              <div className="min-w-0 w-full">
                <p className="text-[10px] font-bold text-slate-400 mb-1">
                  ปลายทางที่ระบุไว้ {isOfflineFallback && <span className="text-error font-bold">*</span>}
                </p>
                {isOfflineFallback ? (
                  <NativeSelect
                    value={tempReceiverBranch}
                    onChange={setTempReceiverBranch}
                    options={branches}
                    placeholder="เลือกสาขาผู้รับ"
                    icon="flag"
                    otherLabel="อื่นๆ"
                    otherPlaceholder="ระบุสาขาปลายทาง"
                  />
                ) : (
                  <>
                    <p className="break-words font-display text-base font-black leading-snug text-slate-950">
                      {checkedParcel?.['สาขาผู้รับ'] || '-'}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-slate-500">
                      ตำแหน่งด้านล่างเป็นหลักฐานตอนกดส่ง ไม่ได้ใช้ตัดสินอัตโนมัติว่าตรงปลายทาง
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

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
              <span
                className={`material-symbols-outlined text-lg transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                expand_more
              </span>
            </button>

            {showAdvancedOptions && (
              <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                <div
                  className={`rounded-2xl border-2 p-3 transition-all duration-300 ${
                    isProxy ? 'bg-blue-50 border-blue-500' : 'bg-white border-outline-variant/30 hover:border-outline-variant'
                  }`}
                >
                  <div
                    className="flex cursor-pointer items-center justify-between group"
                    onClick={() => {
                      setIsProxy(!isProxy);
                      if (!isProxy) {
                        setIsForwarding(false);
                        setDeliveryMatchStatus('MATCHED_DECLARED_DESTINATION');
                        setDeliveryMismatchReason('');
                      }
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isProxy ? 'bg-blue-600 text-white' : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xl" aria-hidden="true">account_circle</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-black text-primary">มีผู้รับแทน</p>
                        <p className="text-[11px] leading-tight text-on-surface-variant/60">ส่งถึงปลายทางแล้ว แต่คนอื่นรับแทนผู้รับตามรายการ</p>
                      </div>
                    </div>
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        isProxy ? 'border-blue-600 bg-blue-600' : 'border-outline-variant group-hover:border-primary'
                      }`}
                    >
                      {isProxy && <span className="material-symbols-outlined text-white text-base" aria-hidden="true">check</span>}
                    </div>
                  </div>
                  {isProxy && (
                    <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg" aria-hidden="true">
                          person
                        </span>
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
                  <div
                    className={`rounded-2xl border-2 p-3 transition-all duration-300 ${
                      deliveryMatchStatus === 'DELIVERED_ELSEWHERE'
                        ? 'bg-amber-50 border-amber-500'
                        : 'bg-white border-outline-variant/30 hover:border-outline-variant'
                    }`}
                  >
                    <div
                      className="flex cursor-pointer items-center justify-between group"
                      onClick={() => {
                        setDeliveryMatchStatus(
                          deliveryMatchStatus === 'DELIVERED_ELSEWHERE'
                            ? 'MATCHED_DECLARED_DESTINATION'
                            : 'DELIVERED_ELSEWHERE',
                        );
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                            deliveryMatchStatus === 'DELIVERED_ELSEWHERE'
                              ? 'bg-amber-500 text-white'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xl" aria-hidden="true">move_location</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-black text-primary">ส่งคนละจุด / ฝากไว้ที่อื่น</p>
                          <p className="text-[11px] leading-tight text-on-surface-variant/60">ใช้เมื่อปลายทางจริงไม่ตรงกับที่ระบุไว้ในงาน</p>
                        </div>
                      </div>
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                          deliveryMatchStatus === 'DELIVERED_ELSEWHERE'
                            ? 'border-amber-500 bg-amber-500'
                            : 'border-outline-variant group-hover:border-primary'
                        }`}
                      >
                        {deliveryMatchStatus === 'DELIVERED_ELSEWHERE' && (
                          <span className="material-symbols-outlined text-white text-base" aria-hidden="true">check</span>
                        )}
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

                <div
                  className={`rounded-2xl border-2 p-3 transition-all duration-300 ${
                    isForwarding ? 'bg-secondary-fixed/10 border-secondary-container' : 'bg-white border-outline-variant/30 hover:border-outline-variant'
                  }`}
                >
                  <div
                    className="flex cursor-pointer items-center justify-between group"
                    onClick={() => {
                      setIsForwarding(!isForwarding);
                      if (!isForwarding) {
                        setIsProxy(false);
                        setProxyName('');
                        setDeliveryMatchStatus('MATCHED_DECLARED_DESTINATION');
                        setDeliveryMismatchReason('');
                      }
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isForwarding ? 'bg-secondary text-white' : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xl" aria-hidden="true">fork_right</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-black text-primary">ส่งต่อไปจุดถัดไป</p>
                        <p className="text-[11px] leading-tight text-on-surface-variant/60">ยังไม่ถึงผู้รับ ต้องส่งต่อให้คนหรือแผนก/สาขาอื่น</p>
                      </div>
                    </div>
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        isForwarding ? 'border-secondary bg-secondary' : 'border-outline-variant group-hover:border-primary'
                      }`}
                    >
                      {isForwarding && <span className="material-symbols-outlined text-white text-base" aria-hidden="true">check</span>}
                    </div>
                  </div>
                  {isForwarding && (
                    <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg" aria-hidden="true">
                          person
                        </span>
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
              <label className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-1">
                หมายเหตุเพิ่มเติม (ไม่บังคับ)
              </label>
              <textarea
                placeholder="เช่น กล่องบุบนิดหน่อย, วางไว้ที่ป้อมยาม, ฝากไว้ที่เคาน์เตอร์..."
                value={note}
                onChange={(e) => setNote(sanitizeTextInput(e.target.value, 2000))}
                className="min-h-[68px] w-full resize-none rounded-2xl border border-outline-variant bg-white px-4 py-2.5 font-display text-sm outline-none transition-all focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-[0.9fr_1.4fr] sm:gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className={`${confirmNavButtonClass} border border-outline-variant/70 bg-white text-on-surface-variant shadow-sm hover:border-primary/30 hover:bg-surface-container-lowest hover:text-primary`}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl" aria-hidden="true">arrow_back</span>
              ย้อนกลับ
            </button>
            <button
              type="button"
              onClick={executeConfirm}
              disabled={
                isLoading ||
                (isOfflineFallback && (!tempReceiverName.trim() || !resolveSelectValue(tempReceiverBranch))) ||
                (isForwarding && (!forwardSender.trim() || !resolveSelectValue(forwardToBranch))) ||
                (isProxy && !proxyName.trim()) ||
                (!isForwarding && deliveryMatchStatus === 'DELIVERED_ELSEWHERE' && !deliveryMismatchReason.trim())
              }
              className={`${confirmNavButtonClass} group gap-2 bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.01] hover:bg-primary/95 disabled:scale-100 disabled:bg-on-surface-variant/30 disabled:shadow-none`}
            >
              ยืนยันส่ง
              <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1 sm:text-2xl" aria-hidden="true">verified</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
