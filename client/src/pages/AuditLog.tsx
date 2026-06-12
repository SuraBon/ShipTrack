import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, FilterX, Fingerprint, HelpCircle, Loader2, RefreshCw, Search, ShieldCheck, UserRoundCog } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/EmptyState';
import { getAuditLogs, type AuditLogRow } from '@/lib/parcelService';
import { useDebounce } from '@/hooks/useDebounce';
import { AUDIT_ACTION_LABELS, translateAuditDetails } from '@/lib/translationUtils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { parseDateInput } from '@/lib/dateUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAGE_SIZE = 25;

const ACTION_OPTIONS = [
  '',
  'CREATE_PARCEL',
  'CONFIRM_RECEIPT',
  'START_DELIVERY',
  'RELEASE_DELIVERY',
  'CREATE_USER',
  'UPDATE_USER',
  'DISABLE_USER',
  'DELETE_USER',
  'CREATE_BRANCH',
  'DELETE_BRANCH',
  'DELETE_PARCEL',
  'EDIT_PARCEL',
  'UPDATE_PROFILE',
  'LOGIN_BLOCKED',
];

function AuditLogCard({ log }: { log: AuditLogRow }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-foreground">{AUDIT_ACTION_LABELS[log.action] || log.action || '-'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{log.timestamp || '-'}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
            ผู้ทำ: {' '}
            {log.actorId || '-'}
          </span>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-[0.8fr_1.2fr]">
          <div className="min-w-0 rounded-xl bg-muted/50 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground">รายการที่เกี่ยวข้อง</p>
            <p className="mt-1 break-all font-mono text-xs font-semibold text-foreground">{log.targetId || '-'}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-muted/50 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground">รายละเอียดการเปลี่ยนแปลง</p>
              <p className="mt-1 break-words text-xs font-medium text-foreground">{translateAuditDetails(log.details) || '-'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const debouncedActorId = useDebounce(actorId, 300);
  const debouncedTargetId = useDebounce(targetId, 300);

  const offset = useMemo(() => (page - 1) * PAGE_SIZE, [page]);
  const isDateFiltered = Boolean(startDate || endDate);

  const totalPages = useMemo(() => {
    if (isDateFiltered) {
      return Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
    }
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }, [isDateFiltered, logs.length, totalCount]);

  const clientHasMore = useMemo(() => {
    if (isDateFiltered) {
      return (page * PAGE_SIZE) < logs.length;
    }
    return hasMore;
  }, [isDateFiltered, page, logs.length, hasMore]);

  const displayedLogs = useMemo(() => {
    if (isDateFiltered) {
      const clientOffset = (page - 1) * PAGE_SIZE;
      return logs.slice(clientOffset, clientOffset + PAGE_SIZE);
    }
    return logs;
  }, [isDateFiltered, logs, page]);

  const hasFilters = Boolean(debouncedQuery || action || debouncedActorId || debouncedTargetId || startDate || endDate);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const limit = isDateFiltered ? 200 : PAGE_SIZE;
    const res = await getAuditLogs({
      limit,
      offset: isDateFiltered ? 0 : offset,
      query: debouncedQuery,
      action,
      actorId: debouncedActorId,
      targetId: debouncedTargetId,
    });
    if (res.success) {
      const rawLogs = res.logs ?? [];
      if (isDateFiltered) {
        const parsedStart = startDate ? new Date(startDate) : null;
        const parsedEnd = endDate ? new Date(endDate) : null;
        if (parsedStart) parsedStart.setHours(0, 0, 0, 0);
        if (parsedEnd) parsedEnd.setHours(23, 59, 59, 999);

        const filtered = rawLogs.filter(log => {
          const dateObj = parseDateInput(log.timestamp);
          if (!dateObj) return false;
          if (parsedStart && dateObj < parsedStart) return false;
          if (parsedEnd && dateObj > parsedEnd) return false;
          return true;
        });

        setLogs(filtered);
        setTotalCount(filtered.length);
        setHasMore(false);
      } else {
        setLogs(rawLogs);
        setTotalCount(res.totalCount ?? 0);
        setHasMore(Boolean(res.hasMore));
      }
    } else {
      toast.error(res.error || 'ไม่สามารถโหลด Log ระบบได้');
      setLogs([]);
      setTotalCount(0);
      setHasMore(false);
    }
    setLoading(false);
  }, [action, debouncedActorId, debouncedQuery, debouncedTargetId, offset, startDate, endDate, isDateFiltered]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, action, debouncedActorId, debouncedTargetId, startDate, endDate]);

  const clearFilters = () => {
    setQuery('');
    setAction('');
    setActorId('');
    setTargetId('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="app-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="app-page-header">
        <div className="flex items-center gap-4">
          <div className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white md:flex">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="app-page-title">บันทึกระบบ</h1>
            <p className="app-page-subtitle">ใช้ตรวจสอบการดำเนินการของผู้ใช้ในระบบ เช่น ลบรายการ แก้ไขผู้ใช้ สร้างสาขา หรือถูกบล็อกการเข้าสู่ระบบ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsHelpOpen(true)}
            className="rounded-full text-muted-foreground"
            aria-label="อธิบายหน้าบันทึกระบบ"
            title="อธิบายหน้าบันทึกระบบ"
          >
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            รีเฟรช
          </Button>
        </div>
      </div>

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent showCloseButton={false} className="w-[calc(100vw-1rem)] max-w-lg overflow-hidden rounded-2xl border border-slate-100 bg-white p-0 shadow-xl">
          <div className="relative bg-slate-950 px-5 py-4 text-white">
            <button
              type="button"
              onClick={() => setIsHelpOpen(false)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="ปิดคำอธิบาย"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
            </button>
            <DialogTitle className="pr-10 font-display text-lg font-black text-white">บันทึกระบบใช้ดูอะไร</DialogTitle>
            <p className="mt-1 pr-10 text-xs font-semibold text-slate-300">คำอธิบายของข้อมูลในหน้านี้</p>
          </div>
          <div className="grid gap-3 bg-slate-50 p-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-700">
                <UserRoundCog className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-sm font-black text-emerald-950">ใช้ดูว่าใครทำอะไร</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-900/70">แสดงผู้ดำเนินการ เวลา ประเภทการดำเนินการ และรหัสรายการหรือผู้ใช้ที่เกี่ยวข้อง</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-700">
                <Fingerprint className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-sm font-black text-blue-950">เหมาะสำหรับตรวจสอบย้อนหลัง</p>
              <p className="mt-1 text-xs leading-relaxed text-blue-900/70">ใช้ไล่เหตุการณ์สำคัญ เช่น มีใครลบรายการ แก้ไขข้อมูล หรือจัดการบัญชีพนักงาน</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-sm font-black text-slate-950">ไม่ใช่เส้นทางพัสดุ</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">ถ้าต้องดูว่าพัสดุผ่านจุดไหนหรือส่งถึงไหนแล้ว ให้ไปที่หน้า “ประวัติพัสดุ”</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาการดำเนินการ รหัสรายการ..." className="pl-9" />
            </div>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue placeholder="ทุกการดำเนินการในระบบ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกการดำเนินการในระบบ</SelectItem>
                {ACTION_OPTIONS.filter(Boolean).map(option => (
                  <SelectItem key={option} value={option}>{AUDIT_ACTION_LABELS[option] || option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={actorId} onChange={event => setActorId(event.target.value)} placeholder="ผู้ทำ เช่น ADMIN" />
            <Input value={targetId} onChange={event => setTargetId(event.target.value)} placeholder="รหัสอ้างอิง เช่น TRK..." />
            {hasFilters && (
              <Button variant="destructive" onClick={clearFilters} className="md:hidden">
                <FilterX className="mr-2 h-4 w-4" aria-hidden="true" />
                ล้าง
              </Button>
            )}
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-[1fr_1fr_auto] items-end">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">จากวันที่</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">ถึงวันที่</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            {hasFilters && (
              <Button variant="destructive" onClick={clearFilters} className="hidden md:inline-flex">
                <FilterX className="mr-2 h-4 w-4" aria-hidden="true" />
                ล้างตัวกรอง
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            พบ {totalCount} บันทึกระบบ
          </div>
          <span className="text-xs text-muted-foreground">หน้า {page}/{totalPages}</span>
        </div>

        {loading ? (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2 flex-1">
                      <Skeleton className="h-5 w-32 rounded-md" />
                      <Skeleton className="h-4 w-24 rounded-md" />
                    </div>
                    <Skeleton className="h-7 w-20 rounded-lg shrink-0" />
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-[0.8fr_1.2fr]">
                    <div className="min-w-0 rounded-xl bg-muted/50 p-3 space-y-1">
                      <Skeleton className="h-3 w-16 rounded-md" />
                      <Skeleton className="h-4 w-20 rounded-md" />
                    </div>
                    <div className="min-w-0 rounded-xl bg-muted/50 p-3 space-y-1">
                      <Skeleton className="h-3 w-28 rounded-md" />
                      <Skeleton className="h-4 w-3/4 rounded-md" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<ClipboardList className="h-10 w-10 text-muted-foreground" />}
              title="ไม่พบบันทึกระบบ"
              description="ไม่พบบันทึกระบบที่ตรงกับเงื่อนไขการค้นหาในขณะนี้"
            />
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {displayedLogs.map((log, index) => <AuditLogCard key={`${log.timestamp}-${log.actorId}-${log.action}-${log.targetId}-${index}`} log={log} />)}
            </div>
            <div className="flex items-center justify-between gap-2 border-t bg-muted/50 px-4 py-3">
              <Button variant="outline" size="sm" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1 || loading}>ก่อนหน้า</Button>
              <span className="text-xs font-semibold text-muted-foreground">
                แสดง {offset + 1}-{Math.min(offset + displayedLogs.length, totalCount)} จาก {totalCount}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage(value => value + 1)} disabled={!clientHasMore || loading}>ถัดไป</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
