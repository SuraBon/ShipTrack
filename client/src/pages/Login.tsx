import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle2, PackageSearch, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isValidEmployeeId, normalizeEmployeeId, validatePassword, validateRequiredText } from '@/lib/validation';

type AuthDialogState = {
  open: boolean;
  status: 'loading' | 'success' | 'error';
  title: string;
  message: string;
};

const DEFAULT_LOGIN_ERROR = 'เข้าสู่ระบบไม่สำเร็จ';

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
    return 'ไม่พบรหัสพนักงานนี้ กรุณาตรวจสอบอีกครั้ง หรือให้ Admin เพิ่มบัญชีก่อน';
  }

  return err || 'ระบบไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง';
}

export default function Login() {
  const { loginUser, setupUserPin, loading } = useAuth();
  
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  
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
  const showAuthError = (title: string, message: string) => {
    setAuthDialog({ open: true, status: 'error', title, message });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      const message = 'กรุณากรอกรหัสพนักงานก่อนเข้าสู่ระบบ';
      showAuthError(DEFAULT_LOGIN_ERROR, message);
      return;
    }
    if (!isValidEmployeeId(employeeId)) {
      const message = 'รหัสพนักงานต้องใช้ A-Z, 0-9 หรือ _ เท่านั้น';
      showAuthError(DEFAULT_LOGIN_ERROR, message);
      return;
    }

    if (isSetup) {
      const passwordError = validatePassword(pin, 20);
      const nameError = validateRequiredText(name, 'ชื่อ-นามสกุล', 1, 100);
      const branchError = validateRequiredText(branch, 'แผนก/สาขา', 1, 100);
      if (passwordError || nameError || branchError) {
        const message = passwordError || nameError || branchError || 'กรุณากรอกข้อมูลให้ครบถ้วน';
        showAuthError('ตั้งค่าการเข้าใช้งานไม่สำเร็จ', message);
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
        showAuthError('ตั้งค่าการเข้าใช้งานไม่สำเร็จ', message);
      }
    } else {
      if (!pin) {
        const message = 'กรุณากรอกรหัสผ่านก่อนเข้าสู่ระบบ';
        showAuthError(DEFAULT_LOGIN_ERROR, message);
        return;
      }
      const passwordError = validatePassword(pin, 20);
      if (passwordError) {
        showAuthError(DEFAULT_LOGIN_ERROR, passwordError);
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
        showAuthError('เข้าสู่ระบบไม่สำเร็จ', message);
      }
    }
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center overflow-x-hidden bg-[#f8fafc] p-3 sm:p-4">
      <div className="grid w-full max-w-[390px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:max-w-4xl md:grid-cols-[0.95fr_1.05fr]">
        <div className="hidden bg-slate-900 p-8 text-white md:flex md:flex-col md:justify-between">
          <div>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <PackageSearch className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-bold leading-tight">DocTrack</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">ระบบจัดการพัสดุภายในสำหรับ Admin และพนักงานส่ง</p>
          </div>
          <div className="space-y-3 text-xs text-white/55">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="font-semibold text-white">งานจัดส่ง</p>
              <p className="mt-1">ติดตาม สร้างรายการ และบันทึกหลักฐานพร้อม GPS</p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
        <div className="mb-6 text-center md:text-left">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-slate-900 text-white md:mx-0">
            <PackageSearch className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isSetup ? 'ตั้งค่าการเข้าใช้งาน' : 'เข้าสู่ระบบพนักงานส่ง'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {isSetup ? 'กรุณาตั้งรหัสผ่านและข้อมูลของท่าน' : 'สำหรับ Admin และพนักงานส่ง'}
          </p>
        </div>

        <form onSubmit={handleLogin} className="mx-auto flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Username</label>
            <input
              type="text"
              value={employeeId}
              onChange={e => setEmployeeId(normalizeEmployeeId(e.target.value))}
              disabled={isSetup || isLoginDisabled}
              className="app-input w-full font-medium uppercase"
              placeholder="โปรดกรอกรหัสพนักงานของท่าน"
            />
          </div>

          {isSetup && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isLoginDisabled}
                  className="app-input w-full"
                  placeholder="ชื่อของท่าน"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">แผนก/สาขาประจำ</label>
                <input
                  type="text"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  disabled={isLoginDisabled}
                  className="app-input w-full"
                  placeholder="เช่น พิบูลสงคราม"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {isSetup ? 'ตั้งรหัสผ่าน' : 'Password'}
            </label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              disabled={isLoginDisabled}
              className="app-input w-full font-medium"
              placeholder="••••••••"
            />
          </div>


          <button
            type="submit"
            disabled={isLoginDisabled}
            className="app-primary-button mt-2 w-full"
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
                สร้างรายการแบบไม่เข้าสู่ระบบ
              </button>
            </div>
          )}
        </form>
        </div>
      </div>

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
              <DialogTitle className="text-xl font-semibold text-primary">{authDialog.title}</DialogTitle>
              <DialogDescription className="max-w-full whitespace-normal break-words text-sm leading-relaxed text-muted-foreground">
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
