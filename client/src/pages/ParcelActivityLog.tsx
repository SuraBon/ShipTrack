import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileClock, FilterX, HelpCircle, Loader2, MapPin, PackageCheck, RefreshCw, Route, Search } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/EmptyState';
import { getParcelActivityLogs, type ParcelActivityLogRow } from '@/lib/parcelService';
import { useDebounce } from '@/hooks/useDebounce';
import { translateSystemNote } from '@/lib/translationUtils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { parseDateInput } from '@/lib/dateUtils';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 25;
const EVENT_TYPES = ['', 'CREATED', 'START_DELIVERY', 'PICKUP', 'FORWARD', 'PROXY', 'DELIVERED', 'RELEASE_DELIVERY'];

const EVENT_LABELS: Record<string, string> = {
  CREATED: 'สร้างรายการ',
  START_DELIVERY: 'รับงาน',
  PICKUP: 'รับของจากต้นทาง',
  FORWARD: 'ส่งต่อ',
  PROXY: 'ฝากรับ/ส่งแทน',
  DELIVERED: 'ส่งสำเร็จ',
  RELEASE_DELIVERY: 'คืนงาน',
};

function ActivityCard({ activity }: { activity: ParcelActivityLogRow }) {
  return (
    <div className="app-compact-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-foreground">{activity.trackingId || '-'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{activity.timestamp || '-'}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {EVENT_LABELS[activity.eventType] || activity.eventType || '-'}
        </span>
      </div>
      <div className="grid gap-2 text-sm">
        <div className="rounded-xl bg-gray-50 p-3">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="break-words text-xs font-semibold text-foreground">{activity.location || '-'}</p>
              {activity.destLocation && <p className="mt-1 break-words text-xs text-muted-foreground">ปลายทาง: {activity.destLocation}</p>}
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl bg-gray-50 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">ผู้ทำเหตุการณ์ / ผู้เกี่ยวข้อง</p>
            <p className="mt-1 break-words text-xs font-medium text-foreground">{activity.person || '-'}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-gray-50 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">พิกัด</p>
            <p className="mt-1 break-all text-xs font-medium text-foreground">
              {typeof activity.latitude === 'number' && typeof activity.longitude === 'number' ? `${activity.latitude}, ${activity.longitude}` : '-'}
            </p>
          </div>
        </div>
        {(activity.note || activity.deliveryMismatchReason) && (
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-[11px] font-semibold text-amber-700">หมายเหตุ</p>
            <p className="mt-1 break-words text-xs font-medium text-amber-950 dark:text-amber-100">
              {translateSystemNote(activity.deliveryMismatchReason || activity.note)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ParcelActivityLog() {
  const [activities, setActivities] = useState<ParcelActivityLogRow[]>([]);
  const [query, setQuery] = useState('');
  const [eventType, setEventType] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const debouncedTrackingId = useDebounce(trackingId, 300);

  const offset = useMemo(() => (page - 1) * PAGE_SIZE, [page]);
  const isDateFiltered = Boolean(startDate || endDate);

  const totalPages = useMemo(() => {
    if (isDateFiltered) {
      return Math.max(1, Math.ceil(activities.length / PAGE_SIZE));
    }
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }, [isDateFiltered, activities.length, totalCount]);

  const clientHasMore = useMemo(() => {
    if (isDateFiltered) {
      return (page * PAGE_SIZE) < activities.length;
    }
    return hasMore;
  }, [isDateFiltered, page, activities.length, hasMore]);

  const displayedActivities = useMemo(() => {
    if (isDateFiltered) {
      const clientOffset = (page - 1) * PAGE_SIZE;
      return activities.slice(clientOffset, clientOffset + PAGE_SIZE);
    }
    return activities;
  }, [isDateFiltered, activities, page]);

  const hasFilters = Boolean(debouncedQuery || eventType || debouncedTrackingId || startDate || endDate);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    const limit = isDateFiltered ? 200 : PAGE_SIZE;
    const res = await getParcelActivityLogs({
      limit,
      offset: isDateFiltered ? 0 : offset,
      query: debouncedQuery,
      eventType,
      trackingId: debouncedTrackingId,
    });
    if (res.success) {
      const rawActivities = res.activities ?? [];
      if (isDateFiltered) {
        const parsedStart = startDate ? new Date(startDate) : null;
        const parsedEnd = endDate ? new Date(endDate) : null;
        if (parsedStart) parsedStart.setHours(0, 0, 0, 0);
        if (parsedEnd) parsedEnd.setHours(23, 59, 59, 999);

        const filtered = rawActivities.filter(act => {
          const dateObj = parseDateInput(act.timestamp);
          if (!dateObj) return false;
          if (parsedStart && dateObj < parsedStart) return false;
          if (parsedEnd && dateObj > parsedEnd) return false;
          return true;
        });

        setActivities(filtered);
        setTotalCount(filtered.length);
        setHasMore(false);
      } else {
        setActivities(rawActivities);
        setTotalCount(res.totalCount ?? 0);
        setHasMore(Boolean(res.hasMore));
      }
    } else {
      toast.error(res.error || 'ไม่สามารถโหลดประวัติรายการส่งได้');
      setActivities([]);
      setTotalCount(0);
      setHasMore(false);
    }
    setLoading(false);
  }, [debouncedQuery, debouncedTrackingId, eventType, offset, startDate, endDate, isDateFiltered]);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, eventType, debouncedTrackingId, startDate, endDate]);

  const clearFilters = () => {
    setQuery('');
    setEventType('');
    setTrackingId('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="app-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="app-page-header">
        <div className="flex items-center gap-4">
          <div className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white md:flex">
            <FileClock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="app-page-title">ประวัติพัสดุ</h1>
            <p className="app-page-subtitle">ดูเส้นทางและเหตุการณ์ของพัสดุแต่ละเลข Tracking เช่น สร้างรายการ รับงาน ส่งต่อ และส่งสำเร็จ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="อธิบายหน้าประวัติพัสดุ"
            title="อธิบายหน้าประวัติพัสดุ"
          >
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={fetchActivities} disabled={loading} className="app-secondary-button h-10 px-3">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            รีเฟรช
          </button>
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
            <DialogTitle className="pr-10 font-display text-lg font-black text-white">ประวัติพัสดุใช้ดูอะไร</DialogTitle>
            <p className="mt-1 pr-10 text-xs font-semibold text-slate-300">คำอธิบายของข้อมูลในหน้านี้</p>
          </div>
          <div className="grid gap-3 bg-slate-50 p-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-700">
                <Route className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-sm font-black text-blue-950">ใช้ดูเส้นทางพัสดุ</p>
              <p className="mt-1 text-xs leading-relaxed text-blue-900/70">ตอบคำถามว่าพัสดุผ่านจุดไหน ใครรับช่วงต่อ และสถานะล่าสุดเกิดจากเหตุการณ์ใด</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-700">
                <PackageCheck className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-sm font-black text-emerald-950">ผูกกับเลข Tracking</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-900/70">เหมาะสำหรับค้นประวัติของพัสดุหนึ่งรายการ หรือกรองเฉพาะเหตุการณ์การจัดส่ง</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <FileClock className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-sm font-black text-slate-950">ไม่ใช่บันทึกผู้ดูแลระบบ</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">ถ้าต้องดูการลบ แก้ไขผู้ใช้ หรือการตั้งค่าระบบ ให้ไปที่หน้า “บันทึกระบบ”</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="app-toolbar flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาสถานที่ ผู้ทำเหตุการณ์ หรือหมายเหตุ..." className="app-input w-full pl-10" />
          </div>
          <select value={eventType} onChange={event => setEventType(event.target.value)} className="app-input w-full">
            {EVENT_TYPES.map(type => <option key={type || 'ALL'} value={type}>{type ? EVENT_LABELS[type] || type : 'ทุกเหตุการณ์พัสดุ'}</option>)}
          </select>
          <input value={trackingId} onChange={event => setTrackingId(event.target.value.toUpperCase())} placeholder="Tracking ID" className="app-input w-full font-mono uppercase" />
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="app-secondary-button h-11 px-3 text-xs text-red-600 md:hidden">
              <FilterX className="h-4 w-4" aria-hidden="true" />
              ล้าง
            </button>
          )}
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-[1fr_1fr_auto] items-end">
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground mb-1">จากวันที่</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="app-input w-full h-11" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground mb-1">ถึงวันที่</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="app-input w-full h-11" />
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="app-secondary-button h-11 px-3 text-xs text-red-600 hidden md:inline-flex">
              <FilterX className="h-4 w-4" aria-hidden="true" />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      <div className="app-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 bg-surface-container-lowest/50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <FileClock className="h-4 w-4" aria-hidden="true" />
            พบ {totalCount} เหตุการณ์พัสดุ
          </div>
          <span className="text-xs text-muted-foreground">หน้า {page}/{totalPages}</span>
        </div>

        {loading ? (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="app-compact-card space-y-3 animate-pulse">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2 flex-1">
                    <Skeleton className="h-5 w-32 rounded-md" />
                    <Skeleton className="h-4 w-24 rounded-md" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-lg shrink-0" />
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="rounded-xl bg-gray-50/50 p-3 flex items-start gap-2">
                    <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="min-w-0 rounded-xl bg-gray-50/50 p-3 space-y-1">
                      <Skeleton className="h-3 w-20 rounded-md" />
                      <Skeleton className="h-4 w-3/4 rounded-md" />
                    </div>
                    <div className="min-w-0 rounded-xl bg-gray-50/50 p-3 space-y-1">
                      <Skeleton className="h-3 w-16 rounded-md" />
                      <Skeleton className="h-4 w-20 rounded-md" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<FileClock className="h-7 w-7 text-slate-400" />}
              title="ไม่พบประวัติพัสดุ"
              description="ไม่พบเหตุการณ์หรือประวัติการจัดส่งพัสดุที่ตรงกับเงื่อนไขการค้นหา"
            />
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
              {displayedActivities.map(activity => <ActivityCard key={activity.id} activity={activity} />)}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-outline-variant/10 bg-surface-container-lowest/50 px-4 py-3">
              <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1 || loading} className="app-secondary-button h-9 px-3 text-xs">ก่อนหน้า</button>
              <span className="text-xs font-semibold text-muted-foreground">
                แสดง {offset + 1}-{Math.min(offset + displayedActivities.length, totalCount)} จาก {totalCount}
              </span>
              <button type="button" onClick={() => setPage(value => value + 1)} disabled={!clientHasMore || loading} className="app-secondary-button h-9 px-3 text-xs">ถัดไป</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
