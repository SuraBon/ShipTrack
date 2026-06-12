import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  PackagePlus,
  UserRound,
  XCircle,
  Eye,
  EyeOff,
  IdCard,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  if (err.includes('รหัสผ่านไม่ถูกต้อง') || err.includes('เหลือ')) {
    return err || DEFAULT_LOGIN_ERROR;
  }
  if (
    err.includes('ไม่พบรหัสพนักงาน') ||
    err.includes('ไม่พบ') ||
    err.includes('not found') ||
    err.includes('UNAVAILABLE')
  ) {
    return 'ไม่พบรหัสพนักงานนี้ กรุณาตรวจสอบอีกครั้ง หรือให้ผู้ดูแลระบบเพิ่มบัญชีก่อน';
  }

  return err || 'ระบบไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง';
}

export default function Login() {
  const { loginUser, setupUserPin, loading } = useAuth();
  
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  
  // For setup
  const [name, setName] = useState('');

  // Cooldown rate limiting state
  const [cooldown, setCooldown] = useState(0);
  const [failCount, setFailCount] = useState(0);

  const [authDialog, setAuthDialog] = useState<AuthDialogState>({
    open: false,
    status: 'loading',
    title: '',
    message: '',
  });

  const isAuthSubmitting = authDialog.open && authDialog.status === 'loading';
  const isLoginDisabled = loading || isAuthSubmitting || cooldown > 0;

  // Countdown timer effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const showAuthError = (title: string, message: string) => {
    setAuthDialog({ open: true, status: 'error', title, message });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) return;

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
      if (passwordError || nameError) {
        const message = passwordError || nameError || 'กรุณากรอกข้อมูลให้ครบถ้วน';
        showAuthError('ตั้งค่าการเข้าใช้งานไม่สำเร็จ', message);
        return;
      }
      setAuthDialog({
        open: true,
        status: 'loading',
        title: 'กำลังบันทึกข้อมูล',
        message: 'กรุณารอสักครู่ ระบบกำลังตรวจสอบและบันทึกข้อมูลของท่าน',
      });
      const res = await setupUserPin(employeeId, pin, name, { remember: rememberSession });
      if (res.success) {
        setFailCount(0);
        setAuthDialog({
          open: true,
          status: 'success',
          title: 'เข้าสู่ระบบสำเร็จ',
          message: 'ตั้งค่ารหัสผ่านและข้อมูลผู้ใช้เรียบร้อยแล้ว',
        });
        toast.success('ตั้งรหัสผ่านสำเร็จ');
      } else {
        const nextFailCount = failCount + 1;
        setFailCount(nextFailCount);
        setCooldown(Math.min(30, 3 * Math.pow(2, nextFailCount - 1)));
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
      const res = await loginUser(employeeId, pin, { remember: rememberSession });
      
      if (res.success) {
        setFailCount(0);
        if (res.needsSetup) {
          setIsSetup(true);
          setName(res.name !== 'Unknown' ? res.name! : '');
          setAuthDialog({
            open: true,
            status: 'success',
            title: 'ตรวจสอบสำเร็จ',
            message: 'เข้าใช้งานครั้งแรก กรุณาตั้งค่ารหัสผ่านและข้อมูลของท่าน',
          });
          toast.info('เข้าใช้งานครั้งแรก กรุณาตั้งรหัสผ่านและข้อมูลของท่าน');
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
        const nextFailCount = failCount + 1;
        setFailCount(nextFailCount);
        setCooldown(Math.min(30, 3 * Math.pow(2, nextFailCount - 1)));
        const message = getLoginErrorMessage(res.error);
        showAuthError('เข้าสู่ระบบไม่สำเร็จ', message);
      }
    }
  };

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center overflow-x-hidden bg-slate-50 px-3 py-6 sm:px-4">
      <Card className="w-full max-w-[420px] shadow-xl shadow-slate-200/70 border-slate-200 rounded-2xl overflow-hidden bg-white">
        <CardHeader className="px-5 pt-8 pb-4 sm:px-8 md:px-10">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#091426] p-1.5 shadow-sm">
              <svg className="h-full w-full" viewBox="0 0 64 64" role="img" aria-label="ShipTrack">
                <path d="M 35.0 9.2 A 23 23 0 0 1 53.2 40.8" fill="none" stroke="#5f738c" strokeWidth="4.5" strokeLinecap="butt" />
                <path d="M 50.3 46.0 A 23 23 0 0 1 13.7 46.0" fill="none" stroke="#5f738c" strokeWidth="4.5" strokeLinecap="butt" />
                <path d="M 10.8 40.8 A 23 23 0 0 1 29.0 9.2" fill="none" stroke="#5f738c" strokeWidth="4.5" strokeLinecap="butt" />
                <path d="M 18.5 41.5 L 32 20 L 45.5 41.5" fill="none" stroke="#06b6d4" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="butt" />
              </svg>
            </div>
            <div>
              <p className="font-display text-lg font-black leading-none text-primary dark:text-white">ShipTrack</p>
              <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Internal Parcel Tracking</p>
            </div>
          </div>
          <p className="mb-2 text-xs font-bold uppercase text-primary">Staff access</p>
          <CardTitle className="text-2xl font-semibold leading-tight sm:text-3xl text-foreground">
            {isSetup ? 'ตั้งค่าเข้าใช้งาน' : 'เข้าสู่ระบบพนักงาน'}
          </CardTitle>
          <CardDescription className="mt-2 text-sm leading-6 text-muted-foreground">
            {isSetup ? 'ยืนยันข้อมูลผู้ใช้งานครั้งแรกและตั้งรหัสผ่านสำหรับเข้าใช้งานครั้งต่อไป' : 'เข้าสู่ระบบสำหรับผู้ดูแลระบบและพนักงานส่ง หรือสร้างรายการแบบไม่เข้าสู่ระบบ'}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-5 sm:px-8 md:px-10 pb-8">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId" className="text-foreground">รหัสพนักงาน</Label>
              <div className="relative">
                <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="employeeId"
                  type="text"
                  value={employeeId}
                  onChange={e => setEmployeeId(normalizeEmployeeId(e.target.value))}
                  disabled={isSetup || isLoginDisabled}
                  className="pl-9 font-medium uppercase"
                  placeholder="กรอกรหัสพนักงาน"
                  autoComplete="username"
                />
              </div>
            </div>

            {isSetup && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">ชื่อ-นามสกุล</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={isLoginDisabled}
                    className="pl-9"
                    placeholder="ชื่อของท่าน"
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pin" className="text-foreground">
                {isSetup ? 'ตั้งรหัสผ่าน' : 'รหัสผ่าน'}
              </Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="pin"
                  type={showPassword ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  disabled={isLoginDisabled}
                  className="pl-9 pr-10 font-medium"
                  placeholder="กรอกรหัสผ่าน"
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoginDisabled}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none disabled:opacity-50"
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mt-1">
              <Checkbox 
                id="remember" 
                checked={rememberSession} 
                onCheckedChange={(checked) => setRememberSession(checked as boolean)}
                disabled={isLoginDisabled} 
              />
              <Label htmlFor="remember" className="text-sm font-semibold text-slate-700 cursor-pointer">
                จำการเข้าสู่ระบบไว้บนอุปกรณ์นี้
              </Label>
            </div>

            <div className="mt-3 space-y-3">
              <Button
                type="submit"
                disabled={isLoginDisabled}
                className="w-full"
                size="lg"
              >
                {cooldown > 0 ? (
                  <span>ลองใหม่ใน {cooldown} วินาที</span>
                ) : isLoginDisabled ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>{isSetup ? 'กำลังบันทึกข้อมูล' : 'กำลังเข้าสู่ระบบ'}</span>
                  </>
                ) : (
                  <>
                    <span>{isSetup ? 'บันทึกข้อมูลและเข้าสู่ระบบ' : 'เข้าสู่ระบบ'}</span>
                    <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                  </>
                )}
              </Button>

              {!isSetup && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { window.history.pushState({}, '', '/create'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                  className="w-full"
                  size="lg"
                >
                  <PackagePlus className="mr-2 h-5 w-5" aria-hidden="true" />
                  <span>สร้างรายการแบบไม่เข้าสู่ระบบ</span>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

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
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
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
