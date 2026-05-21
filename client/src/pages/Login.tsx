import { useState } from 'react';import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, PackageSearch, Search, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getParcel, searchParcels } from '@/lib/parcelService';
import StatusBadge from '@/components/StatusBadge';
import { formatThaiDate } from '@/lib/dateUtils';
import type { Parcel } from '@/types/parcel';
import { isValidEmployeeId, normalizeEmployeeId, validatePassword, validateRequiredText } from '@/lib/validation';
import { UI_COPY } from '@/lib/uiCopy';

type AuthDialogState = {
  open: boolean;
  status: 'loading' | 'success' | 'error';
  title: string;
  message: string;
};

const DEFAULT_LOGIN_ERROR = 'ไม่พบรหัสหรือรหัสผ่านของท่านไม่ถูกต้อง';

function getLoginErrorMessage(error?: string) {
  const err = error || '';

  if (err.includes('บัญชีถูกล็อค')) return err;
  if (err.includes('PIN ไม่ถูกต้อง') || err.includes('รหัสผ่านไม่ถูกต้อง') || err.includes('เหลือ')) {
    return err || DEFAULT_LOGIN_ERROR;
  }
  if (
    err.includes('ไม่พบรหัสพนักงาน') ||
    err.includes('ไม่พบ') ||
    err.includes('not found') ||
    err.includes('UNAVAILABLE')
  ) {
    return `${DEFAULT_LOGIN_ERROR} กรุณาตรวจสอบรหัสพนักงาน หรือให้ Admin เพิ่มบัญชีพนักงานก่อนเข้าใช้งาน`;
  }

  return err || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง';
}

export default function Login() {
  const { loginUser, setupUserPin, loading } = useAuth();
  
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [isTrackOpen, setIsTrackOpen] = useState(false);
  const [guestQuery, setGuestQuery] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [guestParcel, setGuestParcel] = useState<Parcel | null>(null);
  const [guestResults, setGuestResults] = useState<Parcel[]>([]);
  
  // For setup
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');

  const [authDialog, setAuthDialog] = useState<AuthDialogState>({
    open: false,
    status: 'loading',
    title: '',
    message: '',
  });

  const isAuthSubmitting = authDialog.open && authDialog.status === 'loading';
  const isLoginDisabled = loading || isAuthSubmitting;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      const message = 'กรุณากรอกรหัสพนักงานก่อนเข้าสู่ระบบ';
      setAuthDialog({ open: true, status: 'error', title: DEFAULT_LOGIN_ERROR, message });
      toast.error(DEFAULT_LOGIN_ERROR, { description: message });
      return;
    }
    if (!isValidEmployeeId(employeeId)) {
      const message = 'รหัสพนักงานต้องใช้ A-Z, 0-9 หรือ _ เท่านั้น';
      setAuthDialog({ open: true, status: 'error', title: DEFAULT_LOGIN_ERROR, message });
      toast.error(DEFAULT_LOGIN_ERROR, { description: message });
      return;
    }

    if (isSetup) {
      const passwordError = validatePassword(pin, 20);
      const nameError = validateRequiredText(name, 'ชื่อ-นามสกุล', 1, 100);
      const branchError = validateRequiredText(branch, 'สาขา', 1, 100);
      if (passwordError || nameError || branchError) {
        const message = passwordError || nameError || branchError || 'กรุณากรอกข้อมูลให้ครบถ้วน';
        setAuthDialog({ open: true, status: 'error', title: 'ตั้งค่าการเข้าใช้งานไม่สำเร็จ', message });
        toast.error('ตั้งค่าการเข้าใช้งานไม่สำเร็จ', { description: message });
        return;
      }
      setAuthDialog({
        open: true,
        status: 'loading',
        title: 'กำลังบันทึกข้อมูล',
        message: 'กรุณารอสักครู่ ระบบกำลังตรวจสอบและบันทึกข้อมูลของท่าน',
      });
      const res = await setupUserPin(employeeId, pin, name, branch);
      if (res.success) {
        setAuthDialog({
          open: true,
          status: 'success',
          title: 'เข้าสู่ระบบสำเร็จ',
          message: 'ตั้งค่ารหัสผ่านและข้อมูลผู้ใช้เรียบร้อยแล้ว',
        });
        toast.success('ตั้งค่า PIN สำเร็จ');
      } else {
        const message = res.error || 'เกิดข้อผิดพลาดในการตั้งค่า กรุณาลองใหม่อีกครั้ง';
        setAuthDialog({ open: true, status: 'error', title: 'ตั้งค่าการเข้าใช้งานไม่สำเร็จ', message });
        toast.error('ตั้งค่าการเข้าใช้งานไม่สำเร็จ', { description: message });
      }
    } else {
      if (!pin) {
        const message = 'กรุณากรอกรหัสผ่านก่อนเข้าสู่ระบบ';
        setAuthDialog({ open: true, status: 'error', title: DEFAULT_LOGIN_ERROR, message });
        toast.error(DEFAULT_LOGIN_ERROR, { description: message });
        return;
      }
      const passwordError = validatePassword(pin, 20);
      if (passwordError) {
        setAuthDialog({ open: true, status: 'error', title: DEFAULT_LOGIN_ERROR, message: passwordError });
        toast.error(DEFAULT_LOGIN_ERROR, { description: passwordError });
        return;
      }

      setAuthDialog({
        open: true,
        status: 'loading',
        title: 'กำลังเข้าสู่ระบบ',
        message: 'กรุณารอสักครู่ ระบบกำลังตรวจสอบรหัสพนักงานและรหัสผ่าน',
      });
      const res = await loginUser(employeeId, pin);
      
      if (res.success) {
        if (res.needsSetup) {
          setIsSetup(true);
          setName(res.name !== 'Unknown' ? res.name! : '');
          setBranch(res.branch !== 'Unknown' ? res.branch! : '');
          setAuthDialog({
            open: true,
            status: 'success',
            title: 'ตรวจสอบสำเร็จ',
            message: 'เข้าใช้งานครั้งแรก กรุณาตั้งค่ารหัสผ่านและข้อมูลของท่าน',
          });
          toast.info('เข้าใช้งานครั้งแรก กรุณาตั้งค่า PIN และข้อมูลของท่าน');
        } else {
          setAuthDialog({
            open: true,
            status: 'success',
            title: 'เข้าสู่ระบบสำเร็จ',
            message: 'ยืนยันตัวตนเรียบร้อย กำลังเปิดหน้าระบบ',
          });
          toast.success('เข้าสู่ระบบสำเร็จ');
        }
      } else {
        const message = getLoginErrorMessage(res.error);
        setAuthDialog({ open: true, status: 'error', title: 'เข้าสู่ระบบไม่สำเร็จ', message });
        toast.error('เข้าสู่ระบบไม่สำเร็จ', { description: message, duration: 6000 });
      }
    }
  };

  const resetGuestTracking = () => {
    setGuestQuery('');
    setGuestParcel(null);
    setGuestResults([]);
    setIsTracking(false);
  };

  const handleTrackOpenChange = (open: boolean) => {
    setIsTrackOpen(open);
    if (!open) resetGuestTracking();
  };

  const handleGuestTracking = async (e?: React.FormEvent, queryOverride?: string) => {
    e?.preventDefault();
    const query = (queryOverride ?? guestQuery).trim();
    if (!query) {
      toast.error('กรุณากรอกหมายเลขติดตามหรือผู้รับ');
      return;
    }

    if (queryOverride) setGuestQuery(queryOverride);
    setIsTracking(true);
    try {
      const exact = await getParcel(query);
      if (exact.success && exact.parcel) {
        setGuestParcel(exact.parcel);
        setGuestResults([]);
        return;
      }

      const results = await searchParcels(query);
      if (results.length === 1) {
        setGuestParcel(results[0]);
        setGuestResults([]);
      } else if (results.length > 1) {
        setGuestParcel(null);
        setGuestResults(results);
      } else {
        setGuestParcel(null);
        setGuestResults([]);
        toast.error('ไม่พบข้อมูลพัสดุ');
      }
    } catch {
      toast.error('ไม่สามารถติดตามสถานะได้ กรุณาลองใหม่');
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <div className="min-h-screen w-screen overflow-x-hidden flex items-center justify-center bg-surface p-4">
      <div
        className="bg-white rounded-2xl shadow-xl sm:shadow-2xl p-6 sm:p-8 border border-outline-variant/20"
        style={{ width: 'min(28rem, calc(100vw - 2rem))' }}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <PackageSearch className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black font-display text-primary">
            {isSetup ? 'ตั้งค่าการเข้าใช้งาน' : 'เข้าสู่ระบบพนักงาน'}
          </h1>
          <p className="text-sm text-on-surface-variant mt-2">
            {isSetup ? 'กรุณาตั้งรหัส PIN และข้อมูลของท่าน' : 'สำหรับ Admin และ Messenger'}
          </p>
        </div>

        <form onSubmit={handleLogin} className="mx-auto space-y-4" style={{ width: 'min(100%, calc(100vw - 5rem))' }}>
          <div>
            <label className="block text-sm font-bold text-on-surface-variant mb-1.5">Username</label>
            <input
              type="text"
              value={employeeId}
              onChange={e => setEmployeeId(normalizeEmployeeId(e.target.value))}
              disabled={isSetup || isLoginDisabled}
              className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl px-4 text-primary font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
              placeholder="โปรดกรอกรหัสพนักงานของท่าน"
            />
          </div>

          {isSetup && (
            <>
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1.5">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isLoginDisabled}
                  className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="ชื่อของท่าน"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1.5">สาขาประจำ</label>
                <input
                  type="text"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  disabled={isLoginDisabled}
                  className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="เช่น พิบูลสงคราม"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-bold text-on-surface-variant mb-1.5">
              {isSetup ? 'ตั้งรหัสผ่าน' : 'Password'}
            </label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              disabled={isLoginDisabled}
              className="w-full h-12 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl px-4 text-base font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="••••••••"
            />
          </div>


          <button
            type="submit"
            disabled={isLoginDisabled}
            className="w-full h-12 mt-6 bg-primary text-white rounded-2xl font-display font-bold shadow-md shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoginDisabled ? (
              <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
            ) : (
              <span>{isSetup ? 'บันทึกข้อมูลและเข้าสู่ระบบ' : 'เข้าสู่ระบบ'}</span>
            )}
          </button>
          
          {!isSetup && (
            <div className="mt-4 flex flex-col items-center gap-2 text-center">
              <button
                type="button"
                onClick={() => { window.history.pushState({}, '', '/create'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                className="text-primary font-bold text-sm hover:underline transition-colors"
              >
                ส่งพัสดุโดยไม่ต้องเข้าระบบ
              </button>
              <button
                type="button"
                onClick={() => setIsTrackOpen(true)}
                className="text-on-surface-variant/60 font-bold text-sm hover:text-primary hover:underline transition-colors"
              >
                ติดตามสถานะโดยไม่ต้องเข้าสู่ระบบ
              </button>
            </div>
          )}
        </form>
      </div>

      <Dialog open={isTrackOpen} onOpenChange={handleTrackOpenChange}>
        <DialogContent className="max-h-[88vh] w-[calc(100vw-2rem)] max-w-3xl overflow-hidden rounded-3xl border-none bg-white p-0 shadow-2xl">
          <DialogHeader className="border-b border-outline-variant/20 bg-surface-container-lowest px-5 py-5 sm:px-7 rounded-t-3xl">
            <div className="flex items-center gap-3 pr-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <PackageSearch className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="font-display text-xl font-black text-primary">{UI_COPY.nav.track}</DialogTitle>
                <DialogDescription className="mt-1 text-xs text-on-surface-variant">
                  ค้นหาด้วยหมายเลขติดตามหรือผู้รับ ระบบจะแสดงเฉพาะข้อมูลสรุป
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(88vh-96px)] overflow-y-auto p-5 sm:p-7">
            <form onSubmit={handleGuestTracking} className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant/45" aria-hidden="true" />
                <input
                  value={guestQuery}
                  onChange={(e) => setGuestQuery(e.target.value.toUpperCase())}
                  placeholder="กรอกหมายเลขติดตาม หรือผู้รับ..."
                  className="h-12 w-full rounded-2xl border-2 border-outline-variant/50 bg-white pl-12 pr-4 font-display text-base font-bold text-primary outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={isTracking}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 font-display text-sm font-bold text-white shadow-lg shadow-primary/15 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {isTracking ? (
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                ) : (
                  <>
                    {UI_COPY.action.track}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5">
              {guestParcel ? (
                <div className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-white shadow-sm">
                  <div className="bg-primary px-5 py-4 text-white">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Tracking ID</p>
                        <code className="mt-1 block font-mono text-xl font-black tracking-wide">{guestParcel.TrackingID}</code>
                      </div>
                      <div className="rounded-xl bg-white/10 px-3 py-2">
                        <StatusBadge status={guestParcel['สถานะ']} />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 p-5 sm:grid-cols-2">
                    <div className="rounded-2xl bg-surface-container-lowest p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50">ผู้ส่ง</p>
                      <p className="mt-1 font-bold text-primary">{guestParcel['ผู้ส่ง']}</p>
                      <p className="text-xs text-on-surface-variant/60">{guestParcel['สาขาผู้ส่ง']}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-lowest p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50">ผู้รับ</p>
                      <p className="mt-1 font-bold text-primary">{guestParcel['ผู้รับ']}</p>
                      <p className="text-xs text-on-surface-variant/60">{guestParcel['สาขาผู้รับ']}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-lowest p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50">ประเภท</p>
                      <p className="mt-1 font-bold text-primary">{guestParcel['ประเภทเอกสาร'] || '-'}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-lowest p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50">วันที่สร้าง</p>
                      <p className="mt-1 font-bold text-primary">{formatThaiDate(guestParcel['วันที่สร้าง'])}</p>
                    </div>
                  </div>
                </div>
              ) : guestResults.length > 0 ? (
                <div className="space-y-3">
                  <p className="px-1 text-xs font-bold text-on-surface-variant/60">พบ {guestResults.length} รายการ</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {guestResults.map(parcel => (
                      <button
                        key={parcel.TrackingID}
                        type="button"
                        onClick={() => {
                          setGuestParcel(parcel);
                          setGuestResults([]);
                        }}
                        className="rounded-2xl border border-outline-variant/30 bg-white p-4 text-left shadow-sm transition-all hover:border-primary/35 hover:bg-primary/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <code className="rounded-lg bg-primary/5 px-2 py-1 font-mono text-xs font-black text-primary">{parcel.TrackingID}</code>
                          <StatusBadge status={parcel['สถานะ']} />
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <span className="truncate font-bold text-primary">{parcel['ผู้ส่ง']}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-on-surface-variant/35" aria-hidden="true" />
                          <span className="truncate font-bold text-primary">{parcel['ผู้รับ']}</span>
                        </div>
                        <p className="mt-1 text-xs text-on-surface-variant/55">{formatThaiDate(parcel['วันที่สร้าง'])}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-outline-variant/40 bg-surface-container-lowest px-6 py-12 text-center">
                  <PackageSearch className="mx-auto h-10 w-10 text-on-surface-variant/30" aria-hidden="true" />
                  <p className="mt-3 font-display text-sm font-bold text-primary">กรอกหมายเลขติดตามหรือผู้รับเพื่อเริ่มค้นหา</p>
                  <p className="mt-1 text-xs text-on-surface-variant/60">ผู้ที่ยังไม่ได้เข้าสู่ระบบจะเห็นเฉพาะข้อมูลสรุปของรายการส่ง</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={authDialog.open}
        onOpenChange={(open) => {
          if (authDialog.status !== 'loading') setAuthDialog((current) => ({ ...current, open }));
        }}
        >
          <DialogContent
            className="w-[calc(100vw-2rem)] max-w-md rounded-3xl border-none bg-white p-6 text-center shadow-2xl"
            showCloseButton={authDialog.status !== 'loading'}
          >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            {authDialog.status === 'loading' ? (
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
            ) : authDialog.status === 'success' ? (
              <CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden="true" />
            ) : (
              <XCircle className="h-9 w-9 text-destructive" aria-hidden="true" />
            )}
            </div>
            <DialogHeader className="items-center text-center">
              <DialogTitle className="font-display text-xl font-black text-primary">{authDialog.title}</DialogTitle>
              <DialogDescription className="whitespace-nowrap text-[11px] leading-relaxed text-on-surface-variant min-[380px]:text-xs sm:text-sm">
                {authDialog.message}
              </DialogDescription>
            </DialogHeader>
          {authDialog.status !== 'loading' && (
            <button
              type="button"
              onClick={() => setAuthDialog((current) => ({ ...current, open: false }))}
              className="mt-2 h-11 rounded-2xl bg-primary px-6 font-display text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:opacity-90 active:scale-95"
            >
              ตกลง
            </button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
