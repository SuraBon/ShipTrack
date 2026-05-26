/**
 * Dashboard Page
 */

import { lazy, Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { useAuth } from '@/contexts/AuthContext';
import { deleteParcel, releaseDelivery, startDelivery, syncRouteSamples } from '@/lib/parcelService';
import { startRouteTracking, stopRouteTracking } from '@/lib/routeTracking';
import { useDebounce } from '@/hooks/useDebounce';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { Parcel } from '@/types/parcel';
import { toast } from 'sonner';
import {
  canConfirmMessengerJob,
  canReleaseMessengerJob,
  getActiveDeliveryAssignment,
  isAssignedToCurrentUser,
  isAvailableForMessenger,
  buildAssignmentNote,
} from '@/lib/deliveryAssignment';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { translateSystemNote } from '@/lib/translationUtils';
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  PackageCheck,
  RotateCcw,
  Search,
  Undo2,
  FilterX,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';

// Subcomponents and helpers
import {
  STATS,
  MESSENGER_BATCH_SIZE,
  sortAdminParcels,
  resolveDashboardRole,
  sortMessengerWork,
  wasAssignedToMe,
  StatsCard,
  TableSkeleton,
  LazyPanelFallback,
  MessengerViewBanner,
  isParcelStale,
  getTimelineEvents,
  DashboardIcon,
  DashboardActionButton,
  type MessengerView,
  type AdminSortMode,
} from '@/components/dashboard/DashboardComponents';
import { DeliveryJobDetailsModal } from '@/components/dashboard/DeliveryJobDetailsModal';
import { MessengerDeliveryCard } from '@/components/dashboard/MessengerDeliveryCard';
import { AdminParcelManagementCard } from '@/components/dashboard/AdminParcelManagementCard';
import { AdminParcelManagementTable } from '@/components/dashboard/AdminParcelManagementTable';

interface DashboardProps { isConfigured: boolean; }

const ParcelTimelineModal = lazy(() => import('@/components/ParcelTimelineModal'));
const ConfirmReceipt = lazy(() => import('@/pages/ConfirmReceipt'));

export default function Dashboard({ isConfigured }: DashboardProps) {
  const { user } = useAuth();
  const { parcels, summary, loading, error, loadParcels, hasMore, loadMoreParcels, totalCount, removeParcelLocally, updateParcelLocally } = useParcelStore();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const role = resolveDashboardRole(user?.role);
  const isMessengerDashboard = role === 'MESSENGER';
  const {
    position: messengerPosition,
    status: messengerGeoStatus,
    requestLocation: requestMessengerLocation,
  } = useGeolocation();
  const defaultStatusFilter = 'ทั้งหมด';
  const [statusFilter, setStatusFilter] = useState(() => defaultStatusFilter);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isDeliveryDetailsOpen, setIsDeliveryDetailsOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [confirmTrackingId, setConfirmTrackingId] = useState<string | null>(null);
  const [isConfirmFlowOpen, setIsConfirmFlowOpen] = useState(false);
  const [messengerView, setMessengerView] = useState<MessengerView>('waiting');
  const [startingDeliveryId, setStartingDeliveryId] = useState<string | null>(null);
  const [releasingDeliveryId, setReleasingDeliveryId] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [adminSort, setAdminSort] = useState<AdminSortMode>('newest');
  const [messengerVisibleCounts, setMessengerVisibleCounts] = useState<Record<MessengerView, number>>({
    waiting: MESSENGER_BATCH_SIZE,
    mine: MESSENGER_BATCH_SIZE,
    done: MESSENGER_BATCH_SIZE,
  });
  const isFetchingRef = useRef(false);
  const currentEmployeeId = String(user?.employeeId || '').trim().toUpperCase();
  const stats = useMemo(() => {
    return STATS.map((stat) => ({
      ...stat,
      label: stat.label,
      count: summary?.[stat.key] ?? 0,
    }));
  }, [summary]);

  // Single fetch function — loadParcels already recomputes summary internally
  // ✅ FIX: Use ref to avoid stale closure without adding loadParcels to deps
  const loadParcelsRef = useRef(loadParcels);
  useEffect(() => { loadParcelsRef.current = loadParcels; }, [loadParcels]);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      await loadParcelsRef.current();
      setLastUpdatedAt(Date.now());
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      isFetchingRef.current = false;
    }
  }, []); // ✅ Empty deps — no infinite loop risk

  // Initial load
  useEffect(() => {
    if (!isConfigured) return;
    fetchData();
  }, [isConfigured, fetchData]);

  useEffect(() => {
    if (isMessengerDashboard && messengerGeoStatus === 'idle') requestMessengerLocation();
  }, [isMessengerDashboard, messengerGeoStatus, requestMessengerLocation]);

  // Refresh once when returning to an old visible dashboard. Avoid polling Apps Script.
  useEffect(() => {
    if (!isConfigured) return;
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      if (!lastUpdatedAt || Date.now() - lastUpdatedAt > 2 * 60 * 1000) {
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isConfigured, fetchData, lastUpdatedAt]);

  // Auto-refresh every 60 seconds when the dashboard is active and document is visible
  useEffect(() => {
    if (!isConfigured) return;
    const intervalId = setInterval(() => {
      if (document.hidden) return;
      void fetchData();
    }, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [isConfigured, fetchData]);

  const filteredParcels = useMemo(() => {
    let f = parcels;
    if (!isMessengerDashboard && statusFilter !== 'ทั้งหมด') {
      f = f.filter(p => p['สถานะ'] === statusFilter);
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      f = f.filter(p =>
        p.TrackingID.toLowerCase().includes(q) ||
        p['ผู้ส่ง'].toLowerCase().includes(q) ||
        p['ผู้รับ'].toLowerCase().includes(q) ||
        p['สาขาผู้รับ'].toLowerCase().includes(q)
      );
    }
    return f;
  }, [parcels, statusFilter, debouncedSearch, isMessengerDashboard]);

  const messengerWaitingParcels = useMemo(
    () => filteredParcels
      .filter(isAvailableForMessenger)
      .sort(sortMessengerWork),
    [filteredParcels],
  );
  const messengerMineParcels = useMemo(
    () => filteredParcels
      .filter(parcel => isAssignedToCurrentUser(parcel, currentEmployeeId) && parcel['สถานะ'] !== 'ส่งสำเร็จ')
      .sort(sortMessengerWork),
    [filteredParcels, currentEmployeeId],
  );
  const messengerDoneParcels = useMemo(
    () => filteredParcels.filter(parcel => parcel['สถานะ'] === 'ส่งสำเร็จ' && wasAssignedToMe(parcel, currentEmployeeId)),
    [filteredParcels, currentEmployeeId],
  );
  const adminSortedParcels = useMemo(
    () => sortAdminParcels(filteredParcels, adminSort),
    [filteredParcels, adminSort],
  );
  const adminNeedsAttentionParcels = useMemo(
    () => adminSortedParcels
      .filter(parcel => parcel['สถานะ'] !== 'ส่งสำเร็จ' || isParcelStale(parcel))
      .sort((a, b) => {
        const staleDiff = Number(isParcelStale(b)) - Number(isParcelStale(a));
        if (staleDiff !== 0) return staleDiff;
        return sortMessengerWork(a, b);
      })
      .slice(0, 6),
    [adminSortedParcels],
  );

  // Pagination calculations — use totalCount from backend for accurate total pages
  const hasAdminFilters = Boolean(debouncedSearch || statusFilter !== defaultStatusFilter);
  const adminTotalCount = hasAdminFilters ? adminSortedParcels.length : (totalCount || adminSortedParcels.length);
  const backendTotalPages = Math.max(1, Math.ceil(adminTotalCount / pageSize));
  const { totalPages, paginatedParcels, startIndex, endIndex } = useMemo(() => {
    const total = backendTotalPages;
    const paginated = adminSortedParcels.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const start = adminSortedParcels.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, adminSortedParcels.length);
    return { totalPages: total, paginatedParcels: paginated, startIndex: start, endIndex: end };
  }, [adminSortedParcels, currentPage, pageSize, backendTotalPages]);
  const adminNeedsAttentionIds = useMemo(
    () => new Set(adminNeedsAttentionParcels.map(parcel => parcel.TrackingID)),
    [adminNeedsAttentionParcels],
  );
  const adminRegularParcels = useMemo(
    () => paginatedParcels.filter(parcel => !adminNeedsAttentionIds.has(parcel.TrackingID)),
    [paginatedParcels, adminNeedsAttentionIds],
  );

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [statusFilter, debouncedSearch, adminSort, pageSize]);
  useEffect(() => {
    setMessengerVisibleCounts({
      waiting: MESSENGER_BATCH_SIZE,
      mine: MESSENGER_BATCH_SIZE,
      done: MESSENGER_BATCH_SIZE,
    });
  }, [debouncedSearch]);

  // Clamp currentPage ไม่ให้เกิน totalPages เมื่อข้อมูลเปลี่ยน
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // Scroll to top of the dashboard list when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Load more from backend when navigating to a page that needs more data
  const loadMoreRef = useRef({ adminSortedParcelsLength: adminSortedParcels.length, hasMore, loading, loadMoreParcels });
  useEffect(() => {
    loadMoreRef.current = { adminSortedParcelsLength: adminSortedParcels.length, hasMore, loading, loadMoreParcels };
  });

  useEffect(() => {
    const neededCount = currentPage * pageSize;
    const { adminSortedParcelsLength, hasMore: more, loading: isLoadingData, loadMoreParcels: fetchMore } = loadMoreRef.current;
    if (neededCount > adminSortedParcelsLength && more && !isLoadingData) {
      fetchMore();
    }
  }, [currentPage, pageSize]);

  const handleRefresh = async () => {
    if (loading) return; // ป้องกันกดซ้ำระหว่าง loading
    await fetchData();
    toast.success('อัปเดตข้อมูลเรียบร้อย');
  };

  const selectedTimelineEvents = useMemo(() =>
    selectedParcel ? getTimelineEvents(selectedParcel) : [], [selectedParcel]);

  /** True when the selected parcel has at least one known-coordinate branch. */
  const selectedParcelHasKnownBranches = useMemo(() => {
    if (!selectedParcel) return false;
    return selectedTimelineEvents.some(
      event => typeof event.latitude === 'number' && typeof event.longitude === 'number'
    ) || Boolean(selectedParcel.routeSamples?.some(sample => typeof sample.latitude === 'number' && typeof sample.longitude === 'number'));
  }, [selectedParcel, selectedTimelineEvents]);

  const clearFilters = () => { setSearchTerm(''); setStatusFilter(defaultStatusFilter); setCurrentPage(1); };
  const hasFilters = !!(searchTerm || statusFilter !== defaultStatusFilter);
  const showMoreMessenger = (view: MessengerView) => {
    setMessengerVisibleCounts(current => ({
      ...current,
      [view]: current[view] + MESSENGER_BATCH_SIZE,
    }));
  };
  const visibleMessengerWaitingParcels = messengerWaitingParcels.slice(0, messengerVisibleCounts.waiting);
  const visibleMessengerMineParcels = messengerMineParcels.slice(0, messengerVisibleCounts.mine);
  const visibleMessengerDoneParcels = messengerDoneParcels.slice(0, messengerVisibleCounts.done);

  const handleDelete = async () => {
    if (!selectedParcel) return;
    setIsDeleteConfirmOpen(true);
  };

  const openConfirmFlow = (trackingId: string) => {
    setIsTimelineOpen(false);
    setIsDeliveryDetailsOpen(false);
    setConfirmTrackingId(trackingId);
    setIsConfirmFlowOpen(true);
  };

  const handleStartDelivery = async (parcel: Parcel) => {
    if (startingDeliveryId) return;
    if (!messengerPosition && messengerGeoStatus !== 'loading') requestMessengerLocation();
    setStartingDeliveryId(parcel.TrackingID);
    const res = await startDelivery(
      parcel.TrackingID,
      messengerPosition?.latitude,
      messengerPosition?.longitude,
    );
    setStartingDeliveryId(null);

    if (!res.success) {
      const message = res.error?.includes('มีผู้รับงานแล้ว')
        ? 'งานนี้มีผู้รับแล้ว กรุณารีเฟรช'
        : res.error || 'รับงานไม่ได้ กรุณาลองใหม่';
      toast.error(message);
      return;
    }

    const startEvent = {
      id: `LOCAL-${Date.now()}`,
      trackingId: parcel.TrackingID,
      timestamp: new Date().toISOString(),
      eventType: 'START_DELIVERY' as const,
      location: parcel['สาขาผู้ส่ง'] || '',
      destLocation: parcel['สาขาผู้รับ'] || '',
      person: res.assignedToName || user?.name || user?.employeeId || '',
      note: buildAssignmentNote(res.assignedToId || currentEmployeeId),
      latitude: messengerPosition?.latitude,
      longitude: messengerPosition?.longitude,
    };
    const pickupEvent = res.autoPickedUp ? {
      id: `LOCAL-PICKUP-${Date.now()}`,
      trackingId: parcel.TrackingID,
      timestamp: new Date().toISOString(),
      eventType: 'PICKUP' as const,
      location: parcel['สาขาผู้ส่ง'] || '',
      destLocation: parcel['สาขาผู้รับ'] || '',
      person: res.assignedToName || user?.name || user?.employeeId || '',
      note: 'autoPickup=originGpsMatched',
      latitude: messengerPosition?.latitude,
      longitude: messengerPosition?.longitude,
    } : null;

    const hasLocalAssignment = Boolean(getActiveDeliveryAssignment(parcel));
    const nextEvents = res.alreadyStarted && hasLocalAssignment
      ? parcel.events
      : [...(parcel.events || []), startEvent, ...(pickupEvent ? [pickupEvent] : [])];
    updateParcelLocally(parcel.TrackingID, {
      'สถานะ': 'กำลังจัดส่ง',
      events: nextEvents,
    });
    startRouteTracking(parcel.TrackingID);
    setMessengerView('mine');
    toast.success(res.autoPickedUp ? 'รับงานและบันทึกรับของแล้ว' : (res.alreadyStarted ? 'งานนี้อยู่ในรายการที่ต้องส่งแล้ว' : 'รับงานสำเร็จ'));
    loadParcels(undefined, true).catch(() => {});
  };

  const handleReleaseDelivery = async (parcel: Parcel) => {
    if (releasingDeliveryId) return;
    setReleasingDeliveryId(parcel.TrackingID);
    const res = await releaseDelivery(parcel.TrackingID);
    setReleasingDeliveryId(null);

    if (!res.success) {
      toast.error(res.error || 'คืนงานไม่ได้ กรุณาลองใหม่');
      return;
    }

    const releaseEvent = {
      id: `LOCAL-RELEASE-${Date.now()}`,
      trackingId: parcel.TrackingID,
      timestamp: new Date().toISOString(),
      eventType: 'RELEASE_DELIVERY' as const,
      location: parcel['สาขาผู้ส่ง'] || '',
      destLocation: parcel['สาขาผู้รับ'] || '',
      person: user?.name || user?.employeeId || '',
      note: buildAssignmentNote(currentEmployeeId),
    };

    updateParcelLocally(parcel.TrackingID, {
      'สถานะ': 'รอจัดส่ง',
      events: [...(parcel.events || []), releaseEvent],
    });
    stopRouteTracking(parcel.TrackingID);
    void syncRouteSamples(parcel.TrackingID);
    setMessengerView('waiting');
    toast.success(res.alreadyReleased ? 'งานนี้พร้อมให้ผู้อื่นกดรับแล้ว' : 'คืนงานสำเร็จ');
    loadParcels(undefined, true).catch(() => {});
  };

  const executeDelete = async () => {
    if (!selectedParcel) return;
    const trackingID = selectedParcel.TrackingID;
    setIsTimelineOpen(false);
    setIsDeleteConfirmOpen(false);
    removeParcelLocally(trackingID);
    toast.success('กำลังลบรายการ...');
    const res = await deleteParcel(trackingID);
    if (res.success) {
      toast.success('ลบรายการสำเร็จ');
    } else {
      toast.error('ไม่สามารถลบรายการได้ จะทำการรีโหลดข้อมูล');
      loadParcels(undefined, true);
    }
  };

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-sm p-8 bg-white rounded-3xl shadow-xl text-center border border-error/10">
          <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-error" aria-hidden="true">warning</span>
          </div>
          <h2 className="text-xl font-bold text-primary mb-2">ยังไม่ได้ตั้งค่าระบบ</h2>
          <p className="text-sm text-on-surface-variant">กรุณาตั้งค่า GAS URL และ API KEY ในไฟล์ .env</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[390px] space-y-4 md:max-w-none md:space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">{isMessengerDashboard ? 'โหลดงานไม่ได้' : 'โหลดข้อมูลไม่สำเร็จ'}</div>
            <div className="mt-0.5 text-xs leading-relaxed opacity-90">{isMessengerDashboard ? 'กดรีเฟรชอีกครั้ง หากยังไม่สำเร็จให้ตรวจสอบสัญญาณอินเทอร์เน็ต' : error}</div>
          </div>
          {isMessengerDashboard && (
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-destructive/25 bg-white px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              <RotateCcw className="h-4 w-4" />
              รีเฟรช
            </button>
          )}
        </div>
      )}

      {/* ── Stats ── */}
      {!isMessengerDashboard && (() => {
        const isFirstLoad = loading && !lastUpdatedAt;
        return (
          <>
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              {stats.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatusFilter(s.filter)}
                  aria-pressed={statusFilter === s.filter}
                  className={`rounded-xl border bg-white/90 p-2.5 text-left shadow-sm transition-all active:scale-[0.99] ${
                    statusFilter === s.filter
                      ? 'border-primary/45 ring-2 ring-primary/10'
                      : 'border-outline-variant/25'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${s.iconBg}`}>
                      <DashboardIcon icon={s.icon} className={`h-5 w-5 ${s.iconText}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {isFirstLoad ? (
                        <Skeleton className="h-5 w-10 rounded-lg" />
                      ) : (
                        <p className="text-xl font-black leading-none text-primary">{s.count}</p>
                      )}
                      <p className="mt-0.5 truncate text-xs font-medium text-primary">{s.label}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              {stats.map(s => (
                <StatsCard key={s.key} label={s.label} icon={s.icon} iconBg={s.iconBg} iconText={s.iconText}
                  count={s.count}
                  active={statusFilter === s.filter}
                  onClick={() => setStatusFilter(s.filter)}
                  loading={isFirstLoad}
                />
              ))}
            </div>
          </>
        );
      })()}

      {/* ── Filters ── */}
      <div className="bg-transparent md:rounded-2xl md:border md:border-gray-100 md:bg-white md:p-4 md:shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl ${isMessengerDashboard ? 'text-gray-400' : 'text-on-surface-variant/50'}`} aria-hidden="true">search</span>
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ค้นหาหมายเลขติดตาม ผู้ส่ง ผู้รับ หรือปลายทาง..."
              className={isMessengerDashboard
                ? 'h-11 w-full rounded-xl border border-gray-100 bg-gray-50 pl-10 pr-10 text-sm text-gray-700 outline-none transition-all placeholder:text-gray-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 md:h-12'
                : 'h-11 w-full rounded-xl border border-gray-100 bg-gray-50 pl-10 pr-10 text-sm text-gray-700 outline-none transition-all placeholder:text-gray-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10'}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-on-surface-variant/50 transition-colors hover:bg-surface-container hover:text-primary"
                title="ล้างคำค้นหา"
                aria-label="ล้างคำค้นหา"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
              </button>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden h-8 items-center gap-1 rounded-lg border border-outline-variant/35 bg-white px-2 text-[11px] font-medium text-on-surface-variant sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span>
                {loading ? 'กำลังอัปเดต...' : (lastUpdatedAt ? `อัปเดต ${new Date(lastUpdatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : 'รอข้อมูล')}
              </span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className={isMessengerDashboard
                ? 'grid h-11 w-11 place-items-center rounded-xl border border-gray-100 bg-white text-gray-600 shadow-sm transition-all hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 md:h-12 md:w-12'
                : 'grid h-8 w-8 place-items-center rounded-lg border border-outline-variant/35 bg-white text-on-surface-variant shadow-sm transition-all hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'}
              title="รีเฟรช"
              aria-label="รีเฟรชรายการ"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <span className="material-symbols-outlined text-lg" aria-hidden="true">refresh</span>
              )}
            </button>
          </div>
        </div>
        {!isMessengerDashboard && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-slate-600">
              <span className="material-symbols-outlined text-base text-slate-400" aria-hidden="true">sort</span>
              <select
                value={adminSort}
                onChange={(event) => setAdminSort(event.target.value as AdminSortMode)}
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-700 outline-none"
                aria-label="เรียงรายการ"
              >
                <option value="newest">ล่าสุด</option>
                <option value="oldest">เก่าสุด</option>
                <option value="stale">ค้างนาน</option>
                <option value="status">สถานะ</option>
              </select>
            </label>
            <label className="hidden min-w-0 items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:flex">
              <span className="material-symbols-outlined text-base text-slate-400" aria-hidden="true">view_list</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-700 outline-none"
                aria-label="จำนวนรายการต่อหน้า"
              >
                <option value={10}>10 / หน้า</option>
                <option value={20}>20 / หน้า</option>
                <option value={50}>50 / หน้า</option>
              </select>
            </label>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-white px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 sm:col-span-1"
              >
                <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
                ล้างตัวกรอง
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Role Cards ── */}
      <section className="overflow-visible bg-transparent">
        {loading && !filteredParcels.length ? (
          <TableSkeleton />
        ) : !filteredParcels.length ? (
          <div className="p-3 sm:p-4">
            <EmptyState
              icon="search_off"
              title="ไม่พบรายการส่ง"
              description="ลองปรับคำค้นหาหรือล้างตัวกรอง"
              action={hasFilters && !isMessengerDashboard ? (
                <DashboardActionButton icon="filter_alt_off" onClick={clearFilters} variant="secondary" compact>
                  ล้างตัวกรอง
                </DashboardActionButton>
              ) : undefined}
            />
          </div>
        ) : isMessengerDashboard ? (
          <div className="space-y-4 p-0 pb-20">
            {messengerView === 'waiting' && (
              <div>
                <MessengerViewBanner
                  icon="package_open"
                  title="งานรอกดรับ"
                  subtitle="รายการที่ยังไม่มีพนักงานรับงาน กดรับงานเพื่อเริ่มนำส่ง"
                  count={messengerWaitingParcels.length}
                  tone="amber"
                />
                {messengerWaitingParcels.length ? (
                  <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleMessengerWaitingParcels.map(parcel => (
                      <MessengerDeliveryCard
                        key={parcel.TrackingID}
                        parcel={parcel}
                        assignment={null}
                        canStartDelivery={isAvailableForMessenger(parcel)}
                        canReleaseDelivery={false}
                        canConfirmDelivery={false}
                        onOpen={() => { setSelectedParcel(parcel); setIsDeliveryDetailsOpen(true); }}
                        onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                        onStartDelivery={() => handleStartDelivery(parcel)}
                        onReleaseDelivery={() => handleReleaseDelivery(parcel)}
                        isStartingDelivery={startingDeliveryId === parcel.TrackingID}
                        isReleasingDelivery={releasingDeliveryId === parcel.TrackingID}
                      />
                    ))}
                  </div>
                  {messengerWaitingParcels.length > messengerVisibleCounts.waiting && (
                    <div className="mt-3 flex justify-center">
                      <button type="button" onClick={() => showMoreMessenger('waiting')} className="app-secondary-button h-10 px-4 text-xs">
                        แสดงเพิ่ม {Math.min(MESSENGER_BATCH_SIZE, messengerWaitingParcels.length - messengerVisibleCounts.waiting)} รายการ
                      </button>
                    </div>
                  )}
                  </>
                ) : (
                  <EmptyState icon="task_alt" title="ไม่มีงานให้รับในตอนนี้" description="เมื่อมีรายการส่งใหม่ งานจะแสดงที่นี่" tone="emerald" />
                )}
              </div>
            )}

            {messengerView === 'mine' && (
              <div>
                <MessengerViewBanner
                  icon="local_shipping"
                  title="งานที่ต้องส่ง"
                  subtitle="งานที่คุณกำลังนำส่งในขณะนี้ กรุณายืนยันส่งเมื่อจัดส่งเสร็จ"
                  count={messengerMineParcels.length}
                  tone="blue"
                />
                {messengerMineParcels.length ? (
                  <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleMessengerMineParcels.map(parcel => {
                      const assignment = getActiveDeliveryAssignment(parcel);
                      return (
                        <MessengerDeliveryCard
                          key={parcel.TrackingID}
                          parcel={parcel}
                          assignment={assignment}
                          canStartDelivery={false}
                          canReleaseDelivery={canReleaseMessengerJob(parcel, currentEmployeeId, role)}
                          canConfirmDelivery={canConfirmMessengerJob(parcel, currentEmployeeId)}
                          onOpen={() => { setSelectedParcel(parcel); setIsDeliveryDetailsOpen(true); }}
                          onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                          onStartDelivery={() => handleStartDelivery(parcel)}
                          onReleaseDelivery={() => handleReleaseDelivery(parcel)}
                          isStartingDelivery={startingDeliveryId === parcel.TrackingID}
                          isReleasingDelivery={releasingDeliveryId === parcel.TrackingID}
                        />
                      );
                    })}
                  </div>
                  {messengerMineParcels.length > messengerVisibleCounts.mine && (
                    <div className="mt-3 flex justify-center">
                      <button type="button" onClick={() => showMoreMessenger('mine')} className="app-secondary-button h-10 px-4 text-xs">
                        แสดงเพิ่ม {Math.min(MESSENGER_BATCH_SIZE, messengerMineParcels.length - messengerVisibleCounts.mine)} รายการ
                      </button>
                    </div>
                  )}
                  </>
                ) : (
                  <EmptyState 
                    icon="local_shipping" 
                    title="ไม่มีงานค้างส่งในขณะนี้" 
                    description="สามารถไปรับงานใหม่ได้ที่แท็บ 'งานรอรับ'" 
                  />
                )}
              </div>
            )}

            {messengerView === 'done' && (
              <div>
                <MessengerViewBanner
                  icon="check_circle"
                  title="ส่งสำเร็จแล้ว"
                  subtitle="ประวัติงานทั้งหมดที่คุณยืนยันส่งสำเร็จแล้ว"
                  count={messengerDoneParcels.length}
                  tone="emerald"
                />
                {messengerDoneParcels.length ? (
                  <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleMessengerDoneParcels.map(parcel => (
                      <MessengerDeliveryCard
                        key={parcel.TrackingID}
                        parcel={parcel}
                        assignment={null}
                        canStartDelivery={false}
                        canReleaseDelivery={false}
                        canConfirmDelivery={false}
                        onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                        onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                        onStartDelivery={() => handleStartDelivery(parcel)}
                        onReleaseDelivery={() => handleReleaseDelivery(parcel)}
                        isStartingDelivery={startingDeliveryId === parcel.TrackingID}
                        isReleasingDelivery={releasingDeliveryId === parcel.TrackingID}
                      />
                    ))}
                  </div>
                  {messengerDoneParcels.length > messengerVisibleCounts.done && (
                    <div className="mt-3 flex justify-center">
                      <button type="button" onClick={() => showMoreMessenger('done')} className="app-secondary-button h-10 px-4 text-xs">
                        แสดงเพิ่ม {Math.min(MESSENGER_BATCH_SIZE, messengerDoneParcels.length - messengerVisibleCounts.done)} รายการ
                      </button>
                    </div>
                  )}
                  </>
                ) : (
                  <EmptyState icon="history" title="ยังไม่มีประวัติการส่งสำเร็จ" description="ประวัติงานที่คุณยืนยันส่งแล้วจะแสดงที่นี่" />
                )}
              </div>
            )}
            <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
              <div className="mx-auto grid max-w-[390px] grid-cols-3 gap-1">
                {[
                  { id: 'waiting' as const, label: 'งานรอรับ', icon: 'package_open', count: messengerWaitingParcels.length },
                  { id: 'mine' as const, label: 'งานที่ต้องส่ง', icon: 'local_shipping', count: messengerMineParcels.length },
                  { id: 'done' as const, label: 'ส่งสำเร็จ', icon: 'check_circle', count: messengerDoneParcels.length },
                ].map(item => {
                  const active = messengerView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMessengerView(item.id)}
                      aria-pressed={active}
                      className={`flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors ${
                        active ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <DashboardIcon icon={item.icon} className="h-4 w-4 shrink-0" />
                        {item.count > 0 && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] leading-none ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.count}</span>
                        )}
                      </div>
                      <span className="w-full truncate px-1 text-center">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sticky bottom-3 z-20 hidden gap-2 rounded-2xl border border-gray-100 bg-white/95 p-1 shadow-lg backdrop-blur md:grid md:grid-cols-3 xl:mx-auto xl:max-w-3xl">
              {[
                { id: 'waiting' as const, label: 'งานรอรับ', icon: 'package_open', count: messengerWaitingParcels.length },
                { id: 'mine' as const, label: 'งานที่ต้องส่ง', icon: 'local_shipping', count: messengerMineParcels.length },
                { id: 'done' as const, label: 'ส่งสำเร็จ', icon: 'check_circle', count: messengerDoneParcels.length },
              ].map(item => {
                const active = messengerView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMessengerView(item.id)}
                    aria-pressed={active}
                    className={`flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all ${
                      active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <DashboardIcon icon={item.icon} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] leading-none ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : hasFilters ? (
          <div className="space-y-4 pb-4 animate-in fade-in duration-300">
            <MessengerViewBanner
              icon="search"
              title="รายการที่ค้นพบ"
              subtitle="ผลการค้นหาตามตัวกรองที่เลือกไว้"
              count={adminTotalCount}
              tone="blue"
            />
            {paginatedParcels.length ? (
              <>
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {paginatedParcels.map(parcel => (
                  <AdminParcelManagementCard
                    key={parcel.TrackingID}
                    parcel={parcel}
                    assignment={getActiveDeliveryAssignment(parcel)}
                    onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                    onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                    onDelete={() => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                    onReleaseDelivery={() => handleReleaseDelivery(parcel)}
                    isReleasingDelivery={releasingDeliveryId === parcel.TrackingID}
                  />
                ))}
              </div>
              <AdminParcelManagementTable
                parcels={paginatedParcels}
                onOpen={(parcel) => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                onConfirm={(parcel) => openConfirmFlow(parcel.TrackingID)}
                onDelete={(parcel) => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                onReleaseDelivery={handleReleaseDelivery}
                releasingDeliveryId={releasingDeliveryId}
              />
              </>
            ) : (
              <EmptyState
                icon="search_off"
                title="ไม่พบรายการตรงตามที่ค้นหา"
                description="ลองตรวจสอบการสะกดคำ หรือเปลี่ยนตัวกรอง"
                tone="default"
              />
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {adminNeedsAttentionParcels.length > 0 && (
              <div>
                <MessengerViewBanner
                  icon="package_check"
                  title="รอยืนยันส่ง"
                  subtitle="รายการที่ยังไม่ส่งสำเร็จหรือค้างนาน กดยืนยันส่งเมื่อปิดงานแล้ว"
                  count={adminNeedsAttentionParcels.length}
                  tone="amber"
                />
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {adminNeedsAttentionParcels.map(parcel => (
                    <AdminParcelManagementCard
                      key={`attention-${parcel.TrackingID}`}
                      parcel={parcel}
                      assignment={getActiveDeliveryAssignment(parcel)}
                      onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                      onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                      onDelete={() => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                      onReleaseDelivery={() => handleReleaseDelivery(parcel)}
                      isReleasingDelivery={releasingDeliveryId === parcel.TrackingID}
                    />
                  ))}
                </div>
                <AdminParcelManagementTable
                  parcels={adminNeedsAttentionParcels}
                  onOpen={(parcel) => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                  onConfirm={(parcel) => openConfirmFlow(parcel.TrackingID)}
                  onDelete={(parcel) => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                  onReleaseDelivery={handleReleaseDelivery}
                  releasingDeliveryId={releasingDeliveryId}
                />
              </div>
            )}
            <MessengerViewBanner
              icon="check_circle"
              title="ส่งสำเร็จแล้ว"
              subtitle="รายการที่ปิดงานแล้ว ดูรายละเอียดหรือประวัติการส่งได้จากปุ่มรายละเอียด"
              count={adminRegularParcels.length}
            />
            {adminRegularParcels.length ? (
              <>
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {adminRegularParcels.map(parcel => (
                  <AdminParcelManagementCard
                    key={parcel.TrackingID}
                    parcel={parcel}
                    assignment={getActiveDeliveryAssignment(parcel)}
                    onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                    onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                    onDelete={() => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                    onReleaseDelivery={() => handleReleaseDelivery(parcel)}
                    isReleasingDelivery={releasingDeliveryId === parcel.TrackingID}
                  />
                ))}
              </div>
              <AdminParcelManagementTable
                parcels={adminRegularParcels}
                onOpen={(parcel) => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                onConfirm={(parcel) => openConfirmFlow(parcel.TrackingID)}
                onDelete={(parcel) => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                onReleaseDelivery={handleReleaseDelivery}
                releasingDeliveryId={releasingDeliveryId}
              />
              </>
            ) : (
              <EmptyState
                icon="check_circle"
                title="ยังไม่มีรายการส่งสำเร็จในหน้านี้"
                description="รายการที่ยังต้องยืนยันส่งแสดงอยู่ด้านบนแล้ว"
                tone="emerald"
              />
            )}
          </div>
        )}

        {!isMessengerDashboard && filteredParcels.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white/95 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span className="text-xs text-on-surface-variant/60">
              แสดง <span className="font-bold text-primary">{startIndex}–{endIndex}</span> จาก <span className="font-bold text-primary">{adminTotalCount}</span> รายการ
              {filteredParcels.length !== parcels.length && <span className="text-on-surface-variant/40"> (กรองจาก {parcels.length})</span>}
            </span>

            <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            {totalPages > 1 && (
              <>
              <div className="flex w-full flex-col gap-2 sm:hidden">
                <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white p-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30">
                    ก่อนหน้า
                  </button>
                  <span className="px-2 text-xs font-black text-primary">{currentPage}/{totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30">
                    ถัดไป
                  </button>
                </div>
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_upward</span>
                  กลับขึ้นด้านบน
                </button>
              </div>
              <div className="hidden items-center gap-1 rounded-xl border border-gray-100 bg-white p-1 sm:flex">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30" aria-label="ไปหน้าแรก">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">first_page</span>
                </button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30" aria-label="ไปหน้าก่อนหน้า">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_left</span>
                </button>
                <span className="px-2 text-xs font-black text-primary">{currentPage}/{totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30" aria-label="ไปหน้าถัดไป">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_right</span>
                </button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30" aria-label="ไปหน้าสุดท้าย">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">last_page</span>
                </button>
              </div>
              </>
            )}

            {hasMore && (
              <button
                onClick={loadMoreParcels}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">download</span>
                )}
                โหลดข้อมูลเพิ่ม
              </button>
            )}
            </div>
          </div>
        )}
      </section>

      <DeliveryJobDetailsModal
        parcel={selectedParcel}
        open={isDeliveryDetailsOpen}
        onOpenChange={setIsDeliveryDetailsOpen}
      />

      {/* ── Timeline Dialog ── */}
      {isTimelineOpen && (
        <Suspense fallback={null}>
          <ParcelTimelineModal
            isOpen={isTimelineOpen}
            setIsOpen={setIsTimelineOpen}
            selectedParcel={selectedParcel}
            selectedTimelineEvents={selectedTimelineEvents}
            hasKnownBranches={selectedParcelHasKnownBranches}
            onConfirmParcel={openConfirmFlow}
            onDeleteParcel={handleDelete}
          />
        </Suspense>
      )}

      {/* ── Confirm / Photo Capture Dialog ── */}
      {isConfirmFlowOpen && (
      <Dialog
        open={isConfirmFlowOpen}
        onOpenChange={(open) => {
          setIsConfirmFlowOpen(open);
          if (!open) {
            setConfirmTrackingId(null);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white p-0 shadow-2xl"
        >
          <DialogTitle className="sr-only">ยืนยันการส่ง</DialogTitle>
          <div className="modal-scroll relative max-h-[92vh] overflow-y-auto p-0">
            <Suspense fallback={<LazyPanelFallback label="กำลังโหลดหน้ายืนยันส่ง..." />}>
              <ConfirmReceipt
                key={confirmTrackingId ?? 'confirm-flow'}
                initialTrackingId={confirmTrackingId}
                onInitialTrackingIdConsumed={() => undefined}
                autoCheckInitial
                autoOpenCamera
                embedded
                onClose={() => setIsConfirmFlowOpen(false)}
                onComplete={() => {
                  setIsConfirmFlowOpen(false);
                  setConfirmTrackingId(null);
                }}
              />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* ── Delete Confirm Dialog ── */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-primary">ยืนยันการลบรายการ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบรายการ{' '}
              <code className="font-mono font-bold text-primary bg-primary/8 px-1.5 py-0.5 rounded">
                {selectedParcel?.TrackingID}
              </code>
              {' '}การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="rounded-xl bg-error text-white hover:bg-error/90"
            >
              ลบรายการ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
