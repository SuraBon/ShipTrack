import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileClock, FilterX, Loader2, MapPin, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { getParcelActivityLogs, type ParcelActivityLogRow } from '@/lib/parcelService';
import { useDebounce } from '@/hooks/useDebounce';
import { translateSystemNote } from '@/lib/translationUtils';

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
            <p className="text-[11px] font-semibold text-muted-foreground">ผู้เกี่ยวข้อง</p>
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
            <p className="mt-1 break-words text-xs font-medium text-amber-950">
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
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const debouncedTrackingId = useDebounce(trackingId, 300);

  const offset = useMemo(() => (page - 1) * PAGE_SIZE, [page]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = Boolean(debouncedQuery || eventType || debouncedTrackingId);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    const res = await getParcelActivityLogs({
      limit: PAGE_SIZE,
      offset,
      query: debouncedQuery,
      eventType,
      trackingId: debouncedTrackingId,
    });
    if (res.success) {
      setActivities(res.activities ?? []);
      setTotalCount(res.totalCount ?? 0);
      setHasMore(Boolean(res.hasMore));
    } else {
      toast.error(res.error || 'ไม่สามารถโหลดประวัติรายการส่งได้');
      setActivities([]);
      setTotalCount(0);
      setHasMore(false);
    }
    setLoading(false);
  }, [debouncedQuery, debouncedTrackingId, eventType, offset]);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, eventType, debouncedTrackingId]);

  const clearFilters = () => {
    setQuery('');
    setEventType('');
    setTrackingId('');
  };

  return (
    <div className="app-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="app-page-header">
        <div className="flex items-center gap-4">
          <div className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white md:flex">
            <FileClock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="app-page-title">ประวัติรายการส่ง</h1>
            <p className="app-page-subtitle">ประวัติ movement ของรายการส่งทั้งหมด แยกจาก Log ระบบ</p>
          </div>
        </div>
        <button type="button" onClick={fetchActivities} disabled={loading} className="app-secondary-button h-10 px-3">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          รีเฟรช
        </button>
      </div>

      <div className="app-toolbar grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาสถานที่ ผู้เกี่ยวข้อง หรือหมายเหตุ..." className="app-input w-full pl-10" />
        </div>
        <select value={eventType} onChange={event => setEventType(event.target.value)} className="app-input w-full">
          {EVENT_TYPES.map(type => <option key={type || 'ALL'} value={type}>{type ? EVENT_LABELS[type] || type : 'ทุก event'}</option>)}
        </select>
        <input value={trackingId} onChange={event => setTrackingId(event.target.value.toUpperCase())} placeholder="Tracking ID" className="app-input w-full font-mono uppercase" />
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="app-secondary-button h-11 px-3 text-xs text-red-600">
            <FilterX className="h-4 w-4" aria-hidden="true" />
            ล้าง
          </button>
        )}
      </div>

      <div className="app-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 bg-surface-container-lowest/50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <FileClock className="h-4 w-4" aria-hidden="true" />
            {totalCount} รายการ
          </div>
          <span className="text-xs text-muted-foreground">หน้า {page}/{totalPages}</span>
        </div>

        {loading ? (
          <div className="grid place-items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            กำลังโหลด...
          </div>
        ) : activities.length === 0 ? (
          <div className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <FileClock className="h-10 w-10 opacity-30" aria-hidden="true" />
            ไม่พบประวัติรายการส่ง
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
              {activities.map(activity => <ActivityCard key={activity.id} activity={activity} />)}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-outline-variant/10 bg-surface-container-lowest/50 px-4 py-3">
              <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1 || loading} className="app-secondary-button h-9 px-3 text-xs">ก่อนหน้า</button>
              <span className="text-xs font-semibold text-muted-foreground">
                แสดง {offset + 1}-{Math.min(offset + activities.length, totalCount)} จาก {totalCount}
              </span>
              <button type="button" onClick={() => setPage(value => value + 1)} disabled={!hasMore || loading} className="app-secondary-button h-9 px-3 text-xs">ถัดไป</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
