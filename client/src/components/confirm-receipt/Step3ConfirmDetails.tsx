import NativeSelect, { resolveSelectValue } from '@/components/NativeSelect';
import { sanitizeTextInput } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { DeliveryMatchStatus, Parcel } from '@/types/parcel';
import { confirmNavButtonClass, embeddedStepBodyClass, ParcelJobSummary } from './ConfirmReceiptShared';
import { useConfirmReceiptContext } from '@/contexts/ConfirmReceiptContext';
import { isInvalidCoordinates } from '@/lib/gpsQuality';

interface Step3ConfirmDetailsProps {
  embedded: boolean;
}

export function Step3ConfirmDetails({
  embedded,
}: Step3ConfirmDetailsProps) {
  const {
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
    forwardFromBranch,
    setForwardFromBranch,
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
    position,
    effectiveGeoStatus,
    locationName,
    isGeocoding,
  } = useConfirmReceiptContext();

  const destBranch = isOfflineFallback 
    ? resolveSelectValue(tempReceiverBranch) 
    : checkedParcel?.['สาขาผู้รับ'];
  const isGpsInvalid = isInvalidCoordinates(position?.latitude, position?.longitude);
  return (
    <div className="animate-in slide-in-from-right-4 duration-500">
      <Card className={`border-0 shadow-none sm:border sm:shadow-sm ${embedded ? 'bg-transparent' : 'overflow-hidden'}`}>
        {!embedded && (
          <div className="p-5 border-b bg-muted/50 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <span className="material-symbols-outlined text-xl" aria-hidden="true">fact_check</span>
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-primary">ตรวจสอบปลายทางก่อนบันทึกข้อมูล</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                กรุณาตรวจสอบต้นทาง ปลายทาง และผู้รับพัสดุก่อนยืนยัน (หมายเลขติดตาม: {checkedParcel?.TrackingID})
              </p>
            </div>
          </div>
        )}
        <CardContent className={embedded ? embeddedStepBodyClass : 'p-6 sm:p-8 space-y-6'}>
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
                  <Input
                    placeholder="กรอกชื่อผู้รับ"
                    value={tempReceiverName}
                    onChange={(e) => setTempReceiverName(sanitizeTextInput(e.target.value, 200))}
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
                      พิกัดตำแหน่งด้านล่างใช้เป็นหลักฐานขณะนำส่งเท่านั้น ระบบไม่ได้ใช้พิกัดนี้ในการระบุความถูกต้องของปลายทางโดยอัตโนมัติ
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {effectiveGeoStatus === 'success' && position && !isGpsInvalid && (
            <div className="rounded-2xl border border-gray-200 bg-slate-50 p-3 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-2.5 w-full">
                <span className="material-symbols-outlined mt-0.5 text-lg text-slate-700" aria-hidden="true">my_location</span>
                <div className="min-w-0 w-full text-slate-650">
                  <p className="text-[10px] font-bold text-slate-400 mb-0.5">พิกัดตำแหน่งนำส่งจริง</p>
                  <p className="font-mono text-xs font-black leading-tight text-slate-950">
                    {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-snug text-slate-700">
                    <span className="font-bold">สถานที่:</span>{' '}
                    {isGeocoding ? (
                      <span className="text-slate-400">กำลังดึงชื่อสถานที่...</span>
                    ) : (
                      locationName || <span className="text-slate-400">ไม่พบข้อมูลชื่อสถานที่</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isGpsInvalid && (
            <div className="rounded-sm border-2 border-outline-variant bg-amber-100 p-3 text-amber-950 shadow-[2px_2px_0px_0px_var(--outline-variant)] animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-2.5 w-full">
                <span className="material-symbols-outlined mt-0.5 text-lg text-amber-800" aria-hidden="true">warning</span>
                <div className="min-w-0 w-full">
                  <p className="text-[10px] font-black text-amber-950/60 mb-0.5">ตำแหน่ง GPS ไม่พร้อมใช้งานหรือพิกัดผิดปกติ</p>
                  <p className="text-xs font-black leading-snug text-amber-950">
                    ระบบจะบันทึกข้อมูลการจัดส่งโดยไม่มีพิกัดตำแหน่งภูมิศาสตร์ และระบุปลายทางตามจริง: {destBranch || '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {needsGpsOverrideReason && (
            <div className="space-y-2 border-t border-border pt-4 animate-in slide-in-from-top-2 duration-300">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-destructive px-1">
                กรุณาระบุเหตุผลที่ข้ามขั้นตอนการระบุตำแหน่ง GPS <span className="text-destructive font-bold">*</span>
              </label>
              <Textarea
                placeholder="เช่น อยู่ในพื้นที่อับสัญญาณ, อยู่ภายในอาคาร/ชั้นใต้ดิน, ปฏิบัติงานนอกสถานที่พิกัด..."
                value={gpsOverrideReason}
                onChange={(e) => setGpsOverrideReason(sanitizeTextInput(e.target.value, 300))}
                className="min-h-[72px] w-full resize-none border-destructive/20 focus-visible:ring-destructive/20 focus-visible:border-destructive text-sm"
              />
            </div>
          )}

          <div className="space-y-4">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-green-900">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined mt-0.5 text-xl" aria-hidden="true">task_alt</span>
                <div>
                  <p className="font-display text-sm font-black">ส่งพัสดุตรงตามปลายทางที่กำหนด</p>
                  <p className="text-xs font-semibold leading-snug opacity-75">หากต้องการบันทึกว่าจัดส่งถูกต้องตามปลายทางปกติ ไม่จำเป็นต้องระบุข้อมูลอื่นเพิ่มเติม สามารถกดยืนยันการจัดส่งด้านล่างได้ทันที</p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowAdvancedOptions(value => !value)}
              className="w-full text-primary"
            >
              <span className="material-symbols-outlined text-lg mr-2" aria-hidden="true">tune</span>
              ตัวเลือกเพิ่มเติม
              <span
                className={`material-symbols-outlined text-lg transition-transform ml-2 ${showAdvancedOptions ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                expand_more
              </span>
            </Button>

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
                        <p className="font-display text-sm font-black text-primary">มีผู้รับแทน (ผู้รับมอบอำนาจ/เพื่อนร่วมงาน)</p>
                        <p className="text-[11px] leading-tight text-on-surface-variant/60">จัดส่งถึงปลายทางสำเร็จ แต่มีผู้อื่นเป็นผู้ลงชื่อรับแทนผู้รับจริง</p>
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
                        <Input
                          placeholder="กรอกชื่อผู้รับแทน"
                          value={proxyName}
                          onChange={(e) => setProxyName(sanitizeTextInput(e.target.value, 200))}
                          className="pl-10"
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
                          <p className="font-display text-sm font-black text-primary">จัดส่งนอกสถานที่ / ฝากไว้ที่อื่น</p>
                          <p className="text-[11px] leading-tight text-on-surface-variant/60">ใช้เมื่อพิกัดจัดส่งจริงไม่ตรงกับแผนก/สาขาปลายทางที่ระบุในรายการ</p>
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
                          เหตุผลที่จัดส่งนอกสถานที่ / ฝากไว้ที่อื่น
                        </label>
                        <Textarea
                          placeholder="เช่น ผู้รับแจ้งให้ฝากไว้ที่แผนกอื่น, ฝากไว้ที่ป้อมยาม, ที่อยู่ปลายทางในระบบไม่ชัดเจน..."
                          value={deliveryMismatchReason}
                          onChange={(e) => setDeliveryMismatchReason(sanitizeTextInput(e.target.value, 500))}
                          className="min-h-[72px] w-full resize-none focus-visible:ring-amber-500"
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
                        <p className="font-display text-sm font-black text-primary">ส่งต่อไปยังปลายทางถัดไป</p>
                        <p className="text-[11px] leading-tight text-on-surface-variant/60">พัสดุยังไม่ถึงผู้รับปลายทางสุดท้าย ต้องส่งต่อให้บุคคลหรือแผนก/สาขาอื่นดูแลต่อ</p>
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
                        <Input
                          placeholder="กรอกชื่อผู้รับช่วงต่อ"
                          value={forwardSender}
                          onChange={(e) => setForwardSender(sanitizeTextInput(e.target.value, 200))}
                          className="pl-10"
                        />
                      </div>
                      <NativeSelect
                        value={forwardFromBranch}
                        onChange={setForwardFromBranch}
                        options={branches}
                        placeholder="ส่งต่อจากแผนก/สาขาต้นทาง"
                        icon="flag"
                        otherLabel="อื่นๆ"
                        otherPlaceholder="ระบุแผนก/สาขาต้นทาง"
                      />
                      <NativeSelect
                        value={forwardToBranch}
                        onChange={setForwardToBranch}
                        options={branches}
                        placeholder="ส่งต่อไปยังแผนก/สาขาปลายทาง"
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
              <Textarea
                placeholder="เช่น กล่องบุบนิดหน่อย, วางไว้ที่ป้อมยาม, ฝากไว้ที่เคาน์เตอร์..."
                value={note}
                onChange={(e) => setNote(sanitizeTextInput(e.target.value, 2000))}
                className="min-h-[68px] w-full resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-[0.9fr_1.4fr] sm:gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentStep(2)}
              className="w-full bg-white shadow-sm"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl mr-2" aria-hidden="true">arrow_back</span>
              ย้อนกลับ
            </Button>
            <Button
              size="lg"
              onClick={executeConfirm}
              disabled={
                isLoading ||
                (isOfflineFallback && (!tempReceiverName.trim() || !resolveSelectValue(tempReceiverBranch))) ||
                (isForwarding && (!forwardSender.trim() || !resolveSelectValue(forwardFromBranch) || !resolveSelectValue(forwardToBranch))) ||
                (isProxy && !proxyName.trim()) ||
                (!isForwarding && deliveryMatchStatus === 'DELIVERED_ELSEWHERE' && !deliveryMismatchReason.trim())
              }
              className="w-full group shadow-lg shadow-primary/20 hover:scale-[1.01]"
            >
              ยืนยันการจัดส่ง
              <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1 sm:text-2xl ml-2" aria-hidden="true">verified</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
