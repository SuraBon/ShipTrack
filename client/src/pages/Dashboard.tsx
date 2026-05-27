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
import { useRouteSyncStatus } from '@/hooks/useRouteSyncStatus';
import { useDashboardActions } from '@/hooks/useDashboardActions';
import type { Parcel } from '@/types/parcel';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  PackageCheck,
  RotateCcw,
  ChevronDown,
  Search,
  Undo2,
  FilterX,
  Download,
  Trash2,
} from 'lucide-react';
import { convertParcelsToCSV, downloadCSV } from '@/lib/csvHelper';
import { Skeleton } from '@/components/ui/skeleton';
import AppLoading from '@/components/AppLoading';
import EmptyState from '@/components/EmptyState';
import {
  canConfirmMessengerJob,
  canReleaseMessengerJob,
  getActiveDeliveryAssignment,
  isAvailableForMessenger,
} from '@/lib/deliveryAssignment';

// Subcomponents and helpers
import {
  MESSENGER_BATCH_SIZE,
  resolveDashboardRole,
  StatsCard,
  TableSkeleton,
  MessengerViewBanner,
  getTimelineEvents,
  DashboardIcon,
  DashboardActionButton,
  type MessengerView,
  type AdminSortMode,
} from '@/components/dashboard/DashboardComponents';
import { MessengerDeliveryCard } from '@/components/dashboard/MessengerDeliveryCard';

// Lazy load admin components to minimize bundle size for messengers
const AdminParcelManagementCard = lazy(() =>
  import('@/components/dashboard/AdminParcelManagementCard').then(m => ({ default: m.AdminParcelManagementCard }))
);
const AdminParcelManagementTable = lazy(() =>
  import('@/components/dashboard/AdminParcelManagementTable').then(m => ({ default: m.AdminParcelManagementTable }))
);

interface DashboardProps { isConfigured: boolean; }

const DashboardDialogs = lazy(() => import('@/components/dashboard/DashboardDialogs'));

const formatSyncTime = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
};

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
  
  const routeSyncStatus = useRouteSyncStatus();
  const defaultStatusFilter = 'ทั้งหมด';
  const [statusFilter, setStatusFilter] = useState(() => defaultStatusFilter);
  
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [adminSort, setAdminSort] = useState<AdminSortMode>('newest');
  const [isRouteCardExpanded, setIsRouteCardExpanded] = useState(false);
  
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
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!filteredParcels || filteredParcels.length === 0) {
      toast.error('ไม่มีข้อมูลให้ออกรายงาน');
      return;
    }
    try {
      const csv = convertParcelsToCSV(filteredParcels);
      downloadCSV(csv, `shiptrack-parcels-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('ดาวน์โหลดรายงาน CSV สำเร็จ');
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถส่งออกรายงานได้');
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
    ) || Boolean(liveSelectedParcel.routeSamples?.some(sample => typeof sample.latitude === 'number' && typeof sample.longitude === 'number'));
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

  const toggleSelectedAdminParcel = useCallback((trackingId: string, checked: boolean) => {
    setSelectedAdminParcelIds(current => {
      const next = new Set(current);
      if (checked) next.add(trackingId);
      else next.delete(trackingId);
      return next;
    });
  }, []);

  const toggleAllVisibleAdminParcels = useCallback((visibleParcels: Parcel[], checked: boolean) => {
    setSelectedAdminParcelIds(current => {
      const next = new Set(current);
      visibleParcels.forEach(parcel => {
        if (checked) next.add(parcel.TrackingID);
        else next.delete(parcel.TrackingID);
      });
      return next;
    });
  }, []);

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
      {isMessengerDashboard && (
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setIsRouteCardExpanded(value => !value)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
            aria-expanded={isRouteCardExpanded}
          >
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              routeSyncStatus.activeRouteCount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'
            }`}>
              <DashboardIcon icon={routeSyncStatus.activeRouteCount > 0 ? 'my_location' : 'location_searching'} className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-slate-900">บันทึกเส้นทาง</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                  routeSyncStatus.isRouteSyncing
                    ? 'bg-blue-100 text-blue-700'
                    : routeSyncStatus.lastRouteSyncError
                      ? 'bg-red-50 text-red-600'
                      : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {routeSyncStatus.isRouteSyncing ? 'กำลังซิงค์' : routeSyncStatus.lastRouteSyncError ? 'ซิงค์ไม่สำเร็จ' : 'พร้อมซิงค์'}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                {routeSyncStatus.activeRouteCount > 0
                  ? `กำลังบันทึกพิกัด ${routeSyncStatus.activeRouteCount} งาน`
                  : 'ยังไม่มีงานที่กำลังบันทึกพิกัด'}
              </p>
            </div>
            <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isRouteCardExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {isRouteCardExpanded && (
            <div className="border-t border-blue-50 px-4 pb-4 pt-3">
              <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold text-slate-500">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black text-slate-400">พิกัดค้างส่ง</p>
                  <p className="mt-0.5 text-sm font-black text-slate-900">{routeSyncStatus.pendingRouteSampleCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black text-slate-400">บันทึกล่าสุด</p>
                  <p className="mt-0.5 text-sm font-black text-slate-900">{formatSyncTime(routeSyncStatus.latestRouteSampleAt)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black text-slate-400">ซิงค์ล่าสุด</p>
                  <p className="mt-0.5 text-sm font-black text-slate-900">{formatSyncTime(routeSyncStatus.lastRouteSyncAt)}</p>
                </div>
              </div>
              {routeSyncStatus.lastRouteSyncError && (
                <p className="mt-2 text-[11px] font-semibold text-red-600">{routeSyncStatus.lastRouteSyncError}</p>
              )}
            </div>
          )}
        </div>
      )}

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
            {messengerBatchMode && selectedMessengerParcelIds.size > 0 && (
              <div className="sticky top-2 z-30 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-bold text-slate-700">
                  {messengerBatchMode === 'start'
                    ? `เลือกแล้ว ${selectedMessengerParcelIds.size} รายการ • รับได้ ${messengerBatchActionCount}`
                    : `เลือกแล้ว ${selectedMessengerParcelIds.size} รายการ • ส่งได้ ${messengerBatchActionCount}`}
                </span>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button type="button" onClick={clearSelectedMessengerParcels} className="app-secondary-button h-10 px-3 text-xs">
                    ยกเลิกเลือก
                  </button>
                  {messengerBatchMode === 'start' ? (
                    <button
                      type="button"
                      onClick={handleBatchStartDelivery}
                      disabled={messengerBatchActionCount === 0 || isBatchStarting}
                      className="app-primary-button h-10 px-3 text-xs disabled:opacity-60"
                    >
                      {isBatchStarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                      {isBatchStarting ? 'กำลังรับงาน...' : 'รับพร้อมกัน'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsBatchConfirmOpen(true)}
                      disabled={messengerBatchActionCount === 0}
                      className="app-primary-button h-10 px-3 text-xs disabled:opacity-60"
                    >
                      <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      ส่งพร้อมกัน
                    </button>
                  )}
                </div>
              </div>
            )}
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
                        selected={selectedMessengerParcelIds.has(parcel.TrackingID)}
                        onSelectedChange={(checked) => toggleSelectedMessengerParcel(parcel.TrackingID, checked)}
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
                          selected={selectedMessengerParcelIds.has(parcel.TrackingID)}
                          onSelectedChange={(checked) => toggleSelectedMessengerParcel(parcel.TrackingID, checked)}
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
                  subtitle="ประวัติงานที่ยืนยันส่งเรียบร้อยแล้ว"
                  count={messengerDoneParcels.length}
                  tone="emerald"
                />
                {messengerDoneParcels.length > 0 && (
                  <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-emerald-950 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
                        <DashboardIcon icon="check_circle" className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black">ส่งงานสำเร็จ {messengerDoneParcels.length} รายการ</p>
                        <p className="mt-1 text-xs font-semibold leading-relaxed text-emerald-800/80">
                          แตะ “ดู Milestone” เพื่อดูรูปหลักฐานและประวัติการส่งของแต่ละรายการ
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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
            {selectedAdminParcelIds.size > 0 && (
              <div className="sticky top-2 z-30 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-bold text-slate-700">
                  เลือกแล้ว {selectedAdminParcelIds.size} รายการ (ส่งได้ {batchConfirmParcels.length})
                </span>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button type="button" onClick={clearSelectedAdminParcels} className="app-secondary-button h-10 px-3 text-xs">
                    ยกเลิกเลือก
                  </button>
                  <button type="button" onClick={() => setIsBatchConfirmOpen(true)} disabled={batchConfirmParcels.length === 0} className="app-primary-button h-10 px-3 text-xs disabled:opacity-60">
                    <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    ส่งพร้อมกัน
                  </button>
                  <button type="button" onClick={handleBatchDelete} disabled={isBatchDeleting} className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60 sm:col-span-1">
                    {isBatchDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    ลบพร้อมกัน
                  </button>
                </div>
              </div>
            )}
            <MessengerViewBanner
              icon="search"
              title="รายการที่ค้นพบ"
              subtitle="ผลการค้นหาตามตัวกรองที่เลือกไว้"
              count={adminTotalCount}
              tone="blue"
            />
            {paginatedParcels.length ? (
              <Suspense fallback={<TableSkeleton />}>
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {paginatedParcels.map(parcel => (
                    <AdminParcelManagementCard
                      key={parcel.TrackingID}
                      parcel={parcel}
                      assignment={getActiveDeliveryAssignment(parcel)}
                      onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                      onEdit={() => openEditParcel(parcel)}
                      onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                      onDelete={() => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                      onReleaseDelivery={() => handleReleaseDelivery(parcel)}
                      isReleasingDelivery={releasingDeliveryId === parcel.TrackingID}
                      selected={selectedAdminParcelIds.has(parcel.TrackingID)}
                      onSelectedChange={(checked) => toggleSelectedAdminParcel(parcel.TrackingID, checked)}
                    />
                  ))}
                </div>
                <AdminParcelManagementTable
                  parcels={paginatedParcels}
                  onOpen={(parcel) => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                  onEdit={openEditParcel}
                  onConfirm={(parcel) => openConfirmFlow(parcel.TrackingID)}
                  onDelete={(parcel) => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                  onReleaseDelivery={handleReleaseDelivery}
                  releasingDeliveryId={releasingDeliveryId}
                  selectedIds={selectedAdminParcelIds}
                  onToggleSelected={toggleSelectedAdminParcel}
                  onToggleAllVisible={toggleAllVisibleAdminParcels}
                />
              </Suspense>
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
            {selectedAdminParcelIds.size > 0 && (
              <div className="sticky top-2 z-30 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-bold text-slate-700">
                  เลือกแล้ว {selectedAdminParcelIds.size} รายการ (ส่งได้ {batchConfirmParcels.length})
                </span>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button type="button" onClick={clearSelectedAdminParcels} className="app-secondary-button h-10 px-3 text-xs">
                    ยกเลิกเลือก
                  </button>
                  <button type="button" onClick={() => setIsBatchConfirmOpen(true)} disabled={batchConfirmParcels.length === 0} className="app-primary-button h-10 px-3 text-xs disabled:opacity-60">
                    <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    ส่งพร้อมกัน
                  </button>
                  <button type="button" onClick={handleBatchDelete} disabled={isBatchDeleting} className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60 sm:col-span-1">
                    {isBatchDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    ลบพร้อมกัน
                  </button>
                </div>
              </div>
            )}
            {adminNeedsAttentionParcels.length > 0 && (
              <div>
                <MessengerViewBanner
                  icon="package_check"
                  title="รอยืนยันส่ง"
                  subtitle="รายการที่ยังไม่ส่งสำเร็จหรือค้างนาน กดยืนยันส่งเมื่อปิดงานแล้ว"
                  count={adminNeedsAttentionParcels.length}
                  tone="amber"
                />
                <Suspense fallback={<TableSkeleton />}>
                  <div className="grid grid-cols-1 gap-3 md:hidden">
                    {adminNeedsAttentionParcels.map(parcel => (
                      <AdminParcelManagementCard
                        key={`attention-${parcel.TrackingID}`}
                        parcel={parcel}
                        assignment={getActiveDeliveryAssignment(parcel)}
                        onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                        onEdit={() => openEditParcel(parcel)}
                        onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                        onDelete={() => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                        onReleaseDelivery={() => handleReleaseDelivery(parcel)}
                        isReleasingDelivery={releasingDeliveryId === parcel.TrackingID}
                        selected={selectedAdminParcelIds.has(parcel.TrackingID)}
                        onSelectedChange={(checked) => toggleSelectedAdminParcel(parcel.TrackingID, checked)}
                      />
                    ))}
                  </div>
                  <AdminParcelManagementTable
                    parcels={adminNeedsAttentionParcels}
                    onOpen={(parcel) => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                    onEdit={openEditParcel}
                    onConfirm={(parcel) => openConfirmFlow(parcel.TrackingID)}
                    onDelete={(parcel) => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                    onReleaseDelivery={handleReleaseDelivery}
                    releasingDeliveryId={releasingDeliveryId}
                    selectedIds={selectedAdminParcelIds}
                    onToggleSelected={toggleSelectedAdminParcel}
                    onToggleAllVisible={toggleAllVisibleAdminParcels}
                  />
                </Suspense>
              </div>
            )}
            <MessengerViewBanner
              icon="check_circle"
              title="ส่งสำเร็จแล้ว"
              subtitle="รายการที่ปิดงานแล้ว ดูรายละเอียดหรือประวัติการส่งได้จากปุ่มรายละเอียด"
              count={adminRegularParcels.length}
            />
            {adminRegularParcels.length ? (
              <Suspense fallback={<TableSkeleton />}>
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {adminRegularParcels.map(parcel => (
                    <AdminParcelManagementCard
                      key={parcel.TrackingID}
                      parcel={parcel}
                      assignment={getActiveDeliveryAssignment(parcel)}
                      onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                      onEdit={() => openEditParcel(parcel)}
                      onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                      onDelete={() => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                      onReleaseDelivery={() => handleReleaseDelivery(parcel)}
                      isReleasingDelivery={releasingDeliveryId === parcel.TrackingID}
                      selected={selectedAdminParcelIds.has(parcel.TrackingID)}
                      onSelectedChange={(checked) => toggleSelectedAdminParcel(parcel.TrackingID, checked)}
                    />
                  ))}
                </div>
                <AdminParcelManagementTable
                  parcels={adminRegularParcels}
                  onOpen={(parcel) => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                  onEdit={openEditParcel}
                  onConfirm={(parcel) => openConfirmFlow(parcel.TrackingID)}
                  onDelete={(parcel) => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                  onReleaseDelivery={handleReleaseDelivery}
                  releasingDeliveryId={releasingDeliveryId}
                  selectedIds={selectedAdminParcelIds}
                  onToggleSelected={toggleSelectedAdminParcel}
                  onToggleAllVisible={toggleAllVisibleAdminParcels}
                />
              </Suspense>
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
