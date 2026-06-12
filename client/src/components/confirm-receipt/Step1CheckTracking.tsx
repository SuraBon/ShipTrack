import { Spinner } from '@/components/ui/spinner';
import { sanitizeTextInput } from '@/lib/validation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { embeddedStepBodyClass } from './ConfirmReceiptShared';
import { useConfirmReceiptContext } from '@/contexts/ConfirmReceiptContext';

interface Step1CheckTrackingProps {
  embedded: boolean;
}

export function Step1CheckTracking({
  embedded,
}: Step1CheckTrackingProps) {
  const {
    trackingId,
    setTrackingId,
    handlePasteTrackingID,
    checkedParcel,
    isDelivered,
    handleCheckParcel,
    isChecking,
    showOfflinePrompt,
    handleAcceptOfflineFallback,
  } = useConfirmReceiptContext();
  return (
    <div className="animate-in slide-in-from-right-4 duration-500">
      <Card className={`border-0 shadow-none sm:border sm:shadow-sm ${embedded ? 'bg-transparent' : 'overflow-hidden'}`}>
        {!embedded && (
          <div className="p-5 border-b bg-muted/50 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <span className="material-symbols-outlined text-xl" aria-hidden="true">search</span>
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-primary">ระบุหมายเลขติดตาม</h2>
              <p className="text-xs text-muted-foreground mt-0.5">กรอกหมายเลขติดตามเพื่อดูต้นทาง ปลายทาง และผู้รับ</p>
            </div>
          </div>
        )}
        <CardContent className={embedded ? embeddedStepBodyClass : 'p-6 sm:p-8 space-y-6'}>
          <div className="space-y-4">
            <div className="relative group">
              <Input
                placeholder="เช่น TRK20260420001"
                value={trackingId}
                onChange={(e) => setTrackingId(sanitizeTextInput(e.target.value, 100).toUpperCase())}
                className="h-14 w-full pr-12 font-mono text-base font-semibold tracking-[0.05em] sm:h-14 sm:text-xl sm:tracking-[0.12em]"
                autoFocus
              />
              <button
                type="button"
                onClick={handlePasteTrackingID}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-accent transition-all"
                title="วางจากคลิปบอร์ด"
              >
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">content_paste</span>
              </button>
            </div>

            {checkedParcel && isDelivered && (
              <div className="p-4 bg-error-container/30 border border-error/10 rounded-2xl text-error text-sm flex items-start gap-3 animate-in shake duration-300">
                <span className="material-symbols-outlined text-xl" aria-hidden="true">block</span>
                <div>
                  <p className="font-bold">รายการพัสดุนี้ถูกจัดส่งถึงปลายทางเรียบร้อยแล้ว</p>
                  <p className="opacity-80">ไม่สามารถทำการยืนยันการจัดส่งซ้ำได้ กรุณาตรวจสอบหมายเลขติดตามพัสดุอีกครั้ง</p>
                </div>
              </div>
            )}

            {showOfflinePrompt && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-sm space-y-3 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 mt-0.5" aria-hidden="true">wifi_off</span>
                  <div>
                    <p className="font-bold">ระบบอยู่ในโหมดออฟไลน์ หรือเครือข่ายขัดข้อง</p>
                    <p className="opacity-90 leading-normal">ไม่พบข้อมูลพัสดุบนอุปกรณ์ คุณสามารถบันทึกข้อมูลการจัดส่งแบบออฟไลน์สำหรับหมายเลขนี้ได้ โดยข้อมูลจะถูกซิงค์เข้าระบบอัตโนมัติเมื่อเชื่อมต่ออินเท็อร์เน็ต</p>
                  </div>
                </div>
                <Button
                  onClick={handleAcceptOfflineFallback}
                  className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-display font-bold text-sm shadow-sm transition-colors"
                >
                  <span className="material-symbols-outlined text-lg mr-1.5" aria-hidden="true">offline_pin</span>
                  ยืนยันบันทึกข้อมูลแบบออฟไลน์
                </Button>
              </div>
            )}
          </div>

          <Button
            size="lg"
            onClick={handleCheckParcel}
            disabled={isChecking || !trackingId || isDelivered}
            className="w-full h-12 text-base"
          >
            {isChecking ? (
              <>
                <Spinner className="h-5 w-5 mr-2" />
                กำลังตรวจสอบ...
              </>
            ) : (
              <>
                ดูรายละเอียดการจัดส่ง
                <span className="material-symbols-outlined ml-2 group-hover:translate-x-1 transition-transform" aria-hidden="true">arrow_forward</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
