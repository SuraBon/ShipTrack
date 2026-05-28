/**
 * Dashboard Page
 */

import { lazy, Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useDashboardLists } from '@/hooks/useDashboardLists';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRealtimeParcel } from '@/hooks/useRealtimeParcel';
import { useDashboardActions } from '@/hooks/useDashboardActions';
import type { Parcel } from '@/types/parcel';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Loader2,
  RotateCcw,
  Download,
  FilterX,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { convertParcelsToCSV, downloadCSV } from '@/lib/csvHelper';
import { getSystemHealth } from '@/lib/parcelService';
import type { SystemHealth } from '@/lib/parcel-service/types';
import AppLoading from '@/components/AppLoading';
import {
  canConfirmMessengerJob,
  isAvailableForMessenger,
} from '@/lib/deliveryAssignment';

// Subcomponents and helpers
import {
  MESSENGER_BATCH_SIZE,
  resolveDashboardRole,
  StatsCard,
  DashboardIcon,
  type MessengerView,
  type AdminSortMode,
  STATS,
  getTimelineEvents,
} from '@/components/dashboard/DashboardComponents';

import { MessengerDashboardView } from '@/components/dashboard/MessengerDashboardView';
import { AdminDashboardView } from '@/components/dashboard/AdminDashboardView';

interface DashboardProps { isConfigured: boolean; }

const DashboardDialogs = lazy(() => import('@/components/dashboard/DashboardDialogs'));

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
  
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [adminSort, setAdminSort] = useState<AdminSortMode>('newest');
  
  const isFetchingRef = useRef(false);
  const hasSetInitialView = useRef(false);
  const currentEmployeeId = String(user?.employeeId || '').trim().toUpperCase();

  const {
    stats,
    filteredParcels,
    messengerWaitingParcels,
    messengerMineParcels,
    messengerDoneParcels,
    adminTotalCount,
    totalPages,
    paginatedParcels,
    adminNeedsAttentionParcels,
    adminRegularParcels,
    startIndex,
    endIndex,
  } = useDashboardLists({
    parcels,
    summary,
    statusFilter,
    defaultStatusFilter,
    debouncedSearch,
    isMessengerDashboard,
    currentEmployeeId,
    adminSort,
    currentPage,
    pageSize,
    totalCount,
  });

  const loadParcelsRef = useRef(loadParcels);
  useEffect(() => { loadParcelsRef.current = loadParcels; }, [loadParcels]);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      await loadParcelsRef.current();
      setLastUpdatedAt(Date.now());
    } catch {
      setLastUpdatedAt(Date.now());
      toast.error('ไม่สามารถโหลดข้อมูลพัสดุได้');
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!filteredParcels || filteredParcels.length === 0) {
      toast.error('ไม่มีข้อมูลสำหรับการส่งออกรายงาน');
      return;
    }
    try {
      const csv = convertParcelsToCSV(filteredParcels);
      downloadCSV(csv, `shiptrack-parcels-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('ดาวน์โหลดรายงานรูปแบบ CSV สำเร็จเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      toast.error('เกิดข้อผิดพลาด ไม่สามารถส่งออกรายงานได้');
    }
  }, [filteredParcels]);

  // Actions custom hook to keep components clean
  const {
    selectedParcel,
    setSelectedParcel,
    isTimelineOpen,
    setIsTimelineOpen,
    isDeliveryDetailsOpen,
    setIsDeliveryDetailsOpen,
    isDeleteConfirmOpen,
    setIsDeleteConfirmOpen,
    isEditParcelOpen,
    setIsEditParcelOpen,
    isSavingParcelEdit,
    confirmTrackingId,
    setConfirmTrackingId,
    isConfirmFlowOpen,
    setIsConfirmFlowOpen,
    messengerView,
    setMessengerView,
    startingDeliveryId,
    releasingDeliveryId,
    handleRefresh,
    handleDelete,
    openEditParcel,
    submitParcelEdit,
    executeBatchDelete,
    executeBatchStartDelivery,
    executeBatchConfirmDelivery,
    executeDelete,
    openConfirmFlow,
    handleStartDelivery,
    handleReleaseDelivery,
  } = useDashboardActions({
    messengerPosition,
    messengerGeoStatus,
    requestMessengerLocation,
    fetchData,
    loading,
  });

  // Initial load
  useEffect(() => {
    if (!isConfigured) return;
    fetchData();
  }, [isConfigured, fetchData]);

  useEffect(() => {
    if (isMessengerDashboard && messengerGeoStatus === 'idle') requestMessengerLocation();
  }, [isMessengerDashboard, messengerGeoStatus, requestMessengerLocation]);

  // Redirect messenger to waiting tab if there are no pending tasks on initial load
  useEffect(() => {
    if (!isConfigured || !isMessengerDashboard) return;
    if (lastUpdatedAt && !hasSetInitialView.current && !loading) {
      hasSetInitialView.current = true;
      if (messengerMineParcels.length === 0) {
        setMessengerView('waiting');
      }
    }
  }, [isConfigured, isMessengerDashboard, lastUpdatedAt, loading, messengerMineParcels.length, setMessengerView]);

  // Reset initial view check if employee ID changes
  useEffect(() => {
    hasSetInitialView.current = false;
  }, [currentEmployeeId]);

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [statusFilter, debouncedSearch, adminSort, pageSize]);

  // Clamp currentPage ไม่ให้เกิน totalPages เมื่อข้อมูลเปลี่ยน
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // Scroll to top of the dashboard list when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Load more from backend when navigating to a page that needs more data
  const loadMoreRef = useRef({ adminSortedParcelsLength: filteredParcels.length, hasMore, loading, loadMoreParcels });
  useEffect(() => {
    loadMoreRef.current = { adminSortedParcelsLength: filteredParcels.length, hasMore, loading, loadMoreParcels };
  });

  useEffect(() => {
    const neededCount = currentPage * pageSize;
    const { adminSortedParcelsLength, hasMore: more, loading: isLoadingData, loadMoreParcels: fetchMore } = loadMoreRef.current;
    if (neededCount > adminSortedParcelsLength && more && !isLoadingData) {
      fetchMore();
    }
  }, [currentPage, pageSize]);

  const shouldRefreshSelectedParcel = Boolean(
    selectedParcel &&
    (isTimelineOpen || isDeliveryDetailsOpen) &&
    selectedParcel['สถานะ'] === 'กำลังจัดส่ง',
  );
  const { parcel: realtimeSelectedParcel } = useRealtimeParcel(
    selectedParcel?.TrackingID,
    shouldRefreshSelectedParcel,
    selectedParcel,
  );
  const liveSelectedParcel = realtimeSelectedParcel ?? selectedParcel;

  useEffect(() => {
    if (!realtimeSelectedParcel || realtimeSelectedParcel === selectedParcel) return;
    setSelectedParcel(current => current?.TrackingID === realtimeSelectedParcel.TrackingID ? realtimeSelectedParcel : current);
    updateParcelLocally(realtimeSelectedParcel.TrackingID, realtimeSelectedParcel);
  }, [realtimeSelectedParcel, selectedParcel, updateParcelLocally, setSelectedParcel]);

  const selectedTimelineEvents = useMemo(() =>
    liveSelectedParcel ? getTimelineEvents(liveSelectedParcel) : [], [liveSelectedParcel]);

  /** True when the selected parcel has at least one known-coordinate branch. */
  const selectedParcelHasKnownBranches = useMemo(() => {
    if (!liveSelectedParcel) return false;
    return selectedTimelineEvents.some(
      event => typeof event.latitude === 'number' && typeof event.longitude === 'number'
    );
  }, [liveSelectedParcel, selectedTimelineEvents]);

  const clearFilters = () => { setSearchTerm(''); setStatusFilter(defaultStatusFilter); setCurrentPage(1); };
  const hasFilters = !!(searchTerm || statusFilter !== defaultStatusFilter);

  const [messengerVisibleCounts, setMessengerVisibleCounts] = useState<Record<MessengerView, number>>({
    waiting: MESSENGER_BATCH_SIZE,
    mine: MESSENGER_BATCH_SIZE,
    done: MESSENGER_BATCH_SIZE,
  });
  const [selectedAdminParcelIds, setSelectedAdminParcelIds] = useState<Set<string>>(new Set());
  const [selectedMessengerParcelIds, setSelectedMessengerParcelIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchStarting, setIsBatchStarting] = useState(false);
  const [isBatchConfirmOpen, setIsBatchConfirmOpen] = useState(false);
  const [isBatchConfirming, setIsBatchConfirming] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [systemHealthError, setSystemHealthError] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'ADMIN') return;
    let cancelled = false;
    const loadHealth = async () => {
      const res = await getSystemHealth();
      if (cancelled) return;
      if (res.success && res.health) {
        setSystemHealth(res.health);
        setSystemHealthError(null);
      } else {
        setSystemHealthError(res.error || 'ไม่สามารถตรวจสอบสถานะระบบได้');
      }
    };
    void loadHealth();
    const timer = window.setInterval(loadHealth, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [role]);

  const toggleSelectedAdminParcel = useCallback((trackingId: string, checked: boolean) => {
    setSelectedAdminParcelIds(current => {
      const next = new Set(current);
      if (checked) next.add(trackingId);
      else next.delete(trackingId);
      return next;
    });
  }, []);

  const toggleAllVisibleAdminParcels = useCallback((checked: boolean) => {
    setSelectedAdminParcelIds(current => {
      const next = new Set(current);
      paginatedParcels.forEach(parcel => {
        if (checked) next.add(parcel.TrackingID);
        else next.delete(parcel.TrackingID);
      });
      return next;
    });
  }, [paginatedParcels]);

  const clearSelectedAdminParcels = useCallback(() => {
    setSelectedAdminParcelIds(new Set());
  }, []);

  const toggleSelectedMessengerParcel = useCallback((trackingId: string, checked: boolean) => {
    setSelectedMessengerParcelIds(current => {
      const next = new Set(current);
      if (checked) next.add(trackingId);
      else next.delete(trackingId);
      return next;
    });
  }, []);

  const clearSelectedMessengerParcels = useCallback(() => {
    setSelectedMessengerParcelIds(new Set());
  }, []);

  const selectedAdminParcels = useMemo(
    () => filteredParcels.filter(parcel => selectedAdminParcelIds.has(parcel.TrackingID)),
    [filteredParcels, selectedAdminParcelIds],
  );
  const selectedMessengerParcels = useMemo(
    () => filteredParcels.filter(parcel => selectedMessengerParcelIds.has(parcel.TrackingID)),
    [filteredParcels, selectedMessengerParcelIds],
  );
  const batchConfirmParcels = useMemo(
    () => isMessengerDashboard
      ? selectedMessengerParcels.filter(parcel => canConfirmMessengerJob(parcel, currentEmployeeId))
      : selectedAdminParcels.filter(parcel => parcel['สถานะ'] !== 'ส่งสำเร็จ'),
    [currentEmployeeId, isMessengerDashboard, selectedAdminParcels, selectedMessengerParcels],
  );
  const eligibleMessengerStartCount = useMemo(
    () => selectedMessengerParcels.filter(parcel => isAvailableForMessenger(parcel)).length,
    [selectedMessengerParcels],
  );
  const messengerBatchMode = messengerView === 'waiting'
    ? 'start'
    : messengerView === 'mine'
      ? 'confirm'
      : null;
  const messengerBatchActionCount = messengerBatchMode === 'start' ? eligibleMessengerStartCount : batchConfirmParcels.length;
  const isInitialDashboardLoad = !lastUpdatedAt && filteredParcels.length === 0;

  const handleBatchDelete = useCallback(async () => {
    const trackingIds = Array.from(selectedAdminParcelIds);
    if (trackingIds.length === 0 || isBatchDeleting) return;
    const ok = window.confirm(`ลบพัสดุที่เลือก ${trackingIds.length} รายการหรือไม่?`);
    if (!ok) return;
    setIsBatchDeleting(true);
    await executeBatchDelete(trackingIds);
    setIsBatchDeleting(false);
    clearSelectedAdminParcels();
  }, [clearSelectedAdminParcels, executeBatchDelete, isBatchDeleting, selectedAdminParcelIds]);

  const handleBatchStartDelivery = useCallback(async () => {
    if (isBatchStarting) return;
    const parcelsToStart = selectedMessengerParcels.filter(parcel => isAvailableForMessenger(parcel));
    if (parcelsToStart.length === 0) return;
    setIsBatchStarting(true);
    try {
      const result = await executeBatchStartDelivery(parcelsToStart, messengerPosition?.latitude, messengerPosition?.longitude);
      if (result.queued || result.failedCount === 0) {
        clearSelectedMessengerParcels();
        return;
      }
      setSelectedMessengerParcelIds(new Set(result.failedIds));
    } finally {
      setIsBatchStarting(false);
    }
  }, [clearSelectedMessengerParcels, executeBatchStartDelivery, isBatchStarting, messengerPosition, selectedMessengerParcels]);

  const submitBatchConfirm = useCallback(async (input: {
    photoUrl: string;
    note: string;
    latitude?: number;
    longitude?: number;
  }): Promise<boolean> => {
    if (batchConfirmParcels.length === 0 || isBatchConfirming) return false;
    setIsBatchConfirming(true);
    const result = await executeBatchConfirmDelivery(
      batchConfirmParcels,
      input.photoUrl,
      input.note,
      input.latitude,
      input.longitude,
    );
    setIsBatchConfirming(false);
    if (!result.success) return false;
    setIsBatchConfirmOpen(false);
    if (result.queued || result.failedCount === 0) {
      clearSelectedAdminParcels();
      clearSelectedMessengerParcels();
    } else if (isMessengerDashboard) {
      clearSelectedAdminParcels();
      setSelectedMessengerParcelIds(new Set(result.failedIds));
    } else {
      setSelectedAdminParcelIds(new Set(result.failedIds));
      clearSelectedMessengerParcels();
    }
    return true;
  }, [batchConfirmParcels, clearSelectedAdminParcels, clearSelectedMessengerParcels, executeBatchConfirmDelivery, isBatchConfirming, isMessengerDashboard]);

  useEffect(() => {
    setMessengerVisibleCounts({
      waiting: MESSENGER_BATCH_SIZE,
      mine: MESSENGER_BATCH_SIZE,
      done: MESSENGER_BATCH_SIZE,
    });
  }, [debouncedSearch]);

  useEffect(() => {
    clearSelectedMessengerParcels();
  }, [clearSelectedMessengerParcels, messengerView]);

  useEffect(() => {
    setSelectedAdminParcelIds(current => {
      const availableIds = new Set(filteredParcels.map(parcel => parcel.TrackingID));
      const next = new Set(Array.from(current).filter(id => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
    setSelectedMessengerParcelIds(current => {
      const availableIds = new Set(filteredParcels.map(parcel => parcel.TrackingID));
      const next = new Set(Array.from(current).filter(id => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filteredParcels]);

  const showMoreMessenger = (view: MessengerView) => {
    setMessengerVisibleCounts(current => ({
      ...current,
      [view]: current[view] + MESSENGER_BATCH_SIZE,
    }));
  };

  const visibleMessengerWaitingParcels = messengerWaitingParcels.slice(0, messengerVisibleCounts.waiting);
  const visibleMessengerMineParcels = messengerMineParcels.slice(0, messengerVisibleCounts.mine);
  const visibleMessengerDoneParcels = messengerDoneParcels.slice(0, messengerVisibleCounts.done);
  const shouldShowSystemHealth = role === 'ADMIN' && (
    Boolean(systemHealthError) ||
    systemHealth?.status === 'degraded'
  );

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

  if (isInitialDashboardLoad) {
    return (
      <div className="mx-auto max-w-[390px] md:max-w-none">
        <AppLoading label={isMessengerDashboard ? 'กำลังโหลดงานจัดส่ง' : 'กำลังโหลดรายการส่ง'} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[390px] space-y-4 md:max-w-none md:space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {shouldShowSystemHealth && (
        <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
          systemHealth?.status === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <span className="font-bold">
                สถานะระบบ: {systemHealth ? (systemHealth.status === 'ok' ? 'ปกติ' : 'ต้องตรวจสอบ') : 'ตรวจสอบไม่สำเร็จ'}
              </span>
            </div>
            {systemHealth && (
              <span className="text-xs font-semibold opacity-80">
                {systemHealth.metrics.parcelRowCount} รายการ, {systemHealth.metrics.activeUserCount} ผู้ใช้ active, {systemHealth.elapsedMs} ms
              </span>
            )}
          </div>
          {(systemHealthError || systemHealth?.checks.some(check => !check.ok)) && (
            <p className="mt-1 text-xs font-medium opacity-90">
              {systemHealthError || systemHealth?.checks.filter(check => !check.ok).map(check => `${check.name}: ${check.message}`).join(' | ')}
            </p>
          )}
        </div>
      )}
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
      {isMessengerDashboard && null}

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
            <div className={`flex items-center gap-1.5 rounded-xl border bg-white px-2.5 text-[11px] font-semibold text-slate-500 shadow-sm ${
              isMessengerDashboard
                ? 'h-11 md:h-12 border-gray-100 px-3 text-xs'
                : 'h-8 rounded-lg border-outline-variant/35 text-[11px] px-2'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span>
                {loading ? 'กำลังอัปเดต...' : (lastUpdatedAt ? `อัปเดต ${new Date(lastUpdatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'รอข้อมูล')}
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
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              ดาวน์โหลด CSV
            </button>
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
        {isMessengerDashboard ? (
          <MessengerDashboardView
            messengerView={messengerView}
            setMessengerView={setMessengerView}
            messengerWaitingParcels={messengerWaitingParcels}
            messengerMineParcels={messengerMineParcels}
            messengerDoneParcels={messengerDoneParcels}
            visibleMessengerWaitingParcels={visibleMessengerWaitingParcels}
            visibleMessengerMineParcels={visibleMessengerMineParcels}
            visibleMessengerDoneParcels={visibleMessengerDoneParcels}
            messengerVisibleCounts={messengerVisibleCounts}
            showMoreMessenger={showMoreMessenger}
            selectedMessengerParcelIds={selectedMessengerParcelIds}
            toggleSelectedMessengerParcel={toggleSelectedMessengerParcel}
            clearSelectedMessengerParcels={clearSelectedMessengerParcels}
            messengerBatchMode={messengerBatchMode}
            messengerBatchActionCount={messengerBatchActionCount}
            isBatchStarting={isBatchStarting}
            handleBatchStartDelivery={handleBatchStartDelivery}
            setIsBatchConfirmOpen={setIsBatchConfirmOpen}
            setSelectedParcel={setSelectedParcel}
            setIsDeliveryDetailsOpen={setIsDeliveryDetailsOpen}
            setIsTimelineOpen={setIsTimelineOpen}
            openConfirmFlow={openConfirmFlow}
            handleStartDelivery={handleStartDelivery}
            handleReleaseDelivery={handleReleaseDelivery}
            startingDeliveryId={startingDeliveryId}
            releasingDeliveryId={releasingDeliveryId}
            currentEmployeeId={currentEmployeeId}
            role={role}
          />
        ) : (
          <AdminDashboardView
            selectedAdminParcelIds={selectedAdminParcelIds}
            batchConfirmParcels={batchConfirmParcels}
            clearSelectedAdminParcels={clearSelectedAdminParcels}
            setIsBatchConfirmOpen={setIsBatchConfirmOpen}
            handleBatchDelete={handleBatchDelete}
            isBatchDeleting={isBatchDeleting}
            adminTotalCount={adminTotalCount}
            filteredParcels={filteredParcels}
            parcels={parcels}
            paginatedParcels={paginatedParcels}
            setSelectedParcel={setSelectedParcel}
            setIsTimelineOpen={setIsTimelineOpen}
            openEditParcel={openEditParcel}
            openConfirmFlow={openConfirmFlow}
            setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
            handleReleaseDelivery={handleReleaseDelivery}
            releasingDeliveryId={releasingDeliveryId}
            toggleSelectedAdminParcel={toggleSelectedAdminParcel}
            toggleAllVisibleAdminParcels={toggleAllVisibleAdminParcels}
            adminNeedsAttentionParcels={adminNeedsAttentionParcels}
            adminRegularParcels={adminRegularParcels}
            startIndex={startIndex}
            endIndex={endIndex}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            loadMoreParcels={loadMoreParcels}
            loading={loading}
            hasMore={hasMore}
            hasFilters={hasFilters}
            clearFilters={clearFilters}
          />
        )}
      </section>

      {(isDeliveryDetailsOpen || isTimelineOpen || isConfirmFlowOpen || isDeleteConfirmOpen || isEditParcelOpen || isBatchConfirmOpen) && (
        <Suspense fallback={null}>
          <DashboardDialogs
            selectedParcel={liveSelectedParcel}
            isDeliveryDetailsOpen={isDeliveryDetailsOpen}
            setIsDeliveryDetailsOpen={setIsDeliveryDetailsOpen}
            isTimelineOpen={isTimelineOpen}
            setIsTimelineOpen={setIsTimelineOpen}
            selectedTimelineEvents={selectedTimelineEvents}
            selectedParcelHasKnownBranches={selectedParcelHasKnownBranches}
            openConfirmFlow={openConfirmFlow}
            handleDelete={handleDelete}
            isConfirmFlowOpen={isConfirmFlowOpen}
            setIsConfirmFlowOpen={setIsConfirmFlowOpen}
            confirmTrackingId={confirmTrackingId}
            setConfirmTrackingId={setConfirmTrackingId}
            isDeleteConfirmOpen={isDeleteConfirmOpen}
            setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
            executeDelete={executeDelete}
            isEditParcelOpen={isEditParcelOpen}
            setIsEditParcelOpen={setIsEditParcelOpen}
            isSavingParcelEdit={isSavingParcelEdit}
            submitParcelEdit={submitParcelEdit}
            isBatchConfirmOpen={isBatchConfirmOpen}
            setIsBatchConfirmOpen={setIsBatchConfirmOpen}
            batchConfirmParcels={batchConfirmParcels}
            isBatchConfirming={isBatchConfirming}
            submitBatchConfirm={submitBatchConfirm}
          />
        </Suspense>
      )}
    </div>
  );
}
