/**
 * Dashboard Page
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { useAuth } from '@/contexts/AuthContext';
import { deleteParcel } from '@/lib/parcelService';
import { useDebounce } from '@/hooks/useDebounce';
import StatusBadge from '@/components/StatusBadge';
import type { Parcel } from '@/types/parcel';
import { toast } from 'sonner';
import { parseParcelTimeline } from '@/lib/timeline';
import { Skeleton } from '@/components/ui/skeleton';
import { formatThaiDateTime } from '@/lib/dateUtils';
import ParcelTimelineModal from '@/components/ParcelTimelineModal';
import ConfirmReceipt from '@/pages/ConfirmReceipt';
import CreateParcel from '@/pages/CreateParcel';
import Track from '@/pages/Track';
import { normalizeRole } from '@/lib/roles';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DashboardProps { isConfigured: boolean; }

const STATS = [
  { key: 'total',     filter: 'ทั้งหมด',     label: 'ทั้งหมด',  icon: 'inventory_2',     iconBg: 'bg-slate-100',    iconText: 'text-primary' },
  { key: 'pending',   filter: 'รอจัดส่ง',    label: 'รอจัดส่ง', icon: 'inventory_2', iconBg: 'bg-amber-50',    iconText: 'text-amber-600' },
  { key: 'transit',   filter: 'กำลังจัดส่ง', label: 'กำลังจัดส่ง', icon: 'local_shipping', iconBg: 'bg-blue-50',     iconText: 'text-blue-600' },
  { key: 'delivered', filter: 'ส่งสำเร็จ',   label: 'ส่งสำเร็จ', icon: 'task_alt',       iconBg: 'bg-emerald-50',  iconText: 'text-emerald-600' },
] as const;

const StatsCard = ({
  label,
  icon,
  iconBg,
  iconText,
  count,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  iconBg: string;
  iconText: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex min-h-[92px] w-full items-center rounded-2xl border bg-white px-5 py-4 text-left shadow-sm transition-all duration-300 active:scale-[0.99] ${
      active
        ? 'border-primary/45 ring-2 ring-primary/10'
        : 'border-outline-variant/25 hover:border-primary/25 hover:shadow-md'
    }`}
  >
    <div className="flex min-w-0 items-center gap-4">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${iconBg}`}>
        <span className={`material-symbols-outlined text-2xl ${iconText}`} style={{ fontVariationSettings: "'FILL' 0" }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-3xl font-black leading-none text-primary font-display">{count}</p>
        <p className="mt-1 truncate text-sm font-medium leading-tight text-primary">{label}</p>
      </div>
    </div>
  </button>
);

const TableSkeleton = () => (
  <div className="w-full space-y-3 p-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="rounded-2xl border border-outline-variant/15 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-32 rounded-lg" />
            <Skeleton className="h-4 w-3/4 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-24 w-full rounded-xl" />
      </div>
    ))}
  </div>
);

const MessengerRouteSummary = ({ parcel, compact = false }: { parcel: Parcel; compact?: boolean }) => (
  <div className={`rounded-xl border border-primary/10 bg-primary/[0.03] ${compact ? 'p-2.5' : 'p-3'}`}>
    <div className={`grid items-stretch gap-2 ${compact ? 'grid-cols-[1fr_auto_1fr]' : 'grid-cols-[1fr_auto_1fr]'}`}>
      <div className="min-w-0 rounded-lg bg-white px-2.5 py-2 shadow-sm ring-1 ring-outline-variant/10">
        <div className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-on-surface-variant/50">
          <span className="material-symbols-outlined text-[13px]">package_2</span>
          รับจาก
        </div>
        <p className="truncate text-sm font-black leading-tight text-primary">{parcel['สาขาผู้ส่ง'] || '-'}</p>
        {!compact && <p className="mt-0.5 truncate text-[11px] font-semibold text-on-surface-variant/60">{parcel['ผู้ส่ง'] || '-'}</p>}
      </div>
      <div className="grid w-8 place-items-center text-primary">
        <span className="material-symbols-outlined text-xl">arrow_forward</span>
      </div>
      <div className="min-w-0 rounded-lg bg-white px-2.5 py-2 shadow-sm ring-1 ring-outline-variant/10">
        <div className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-on-surface-variant/50">
          <span className="material-symbols-outlined text-[13px]">flag</span>
          ส่งที่
        </div>
        <p className="truncate text-sm font-black leading-tight text-primary">{parcel['สาขาผู้รับ'] || '-'}</p>
        {!compact && <p className="mt-0.5 truncate text-[11px] font-semibold text-on-surface-variant/60">ให้ {parcel['ผู้รับ'] || '-'}</p>}
      </div>
    </div>
    {compact && (
      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-black text-primary shadow-sm ring-1 ring-outline-variant/10">
        <span className="material-symbols-outlined text-base">person_pin</span>
        <span className="min-w-0 truncate">ให้ {parcel['ผู้รับ'] || '-'}</span>
      </div>
    )}
  </div>
);

const getCleanNote = (parcel: Parcel) => {
  const createdEventNote = parcel.events?.find(evt => evt.eventType === 'CREATED')?.note?.trim();
  if (createdEventNote && createdEventNote !== 'รับเข้าระบบ') return createdEventNote;
  return (parcel['หมายเหตุ'] || '').replace(/\[[\s\S]*?\]/g, '').trim();
};

const getLatestTimelineSummary = (parcel: Parcel) => {
  const events = parseParcelTimeline(parcel);
  const latest = [...events].reverse().find(event => event.title || event.description);
  if (!latest) return 'ยังไม่มีประวัติการเคลื่อนไหว';
  return `${latest.title}${latest.description ? `: ${latest.description}` : ''}`;
};

const getDeliveryProofSummary = (parcel: Parcel) => {
  const deliveryEvent = [...(parcel.events || [])].reverse().find(evt => evt.eventType === 'DELIVERED' || evt.eventType === 'PROXY');
  if (!deliveryEvent) return '';
  const receiver = deliveryEvent.person ? `ผู้รับจริง: ${deliveryEvent.person}` : '';
  const match =
    deliveryEvent.deliveryMatchStatus === 'DELIVERED_ELSEWHERE'
      ? `ส่งคนละจุด${deliveryEvent.deliveryMismatchReason ? ` (${deliveryEvent.deliveryMismatchReason})` : ''}`
      : deliveryEvent.deliveryMatchStatus === 'MATCHED_DECLARED_DESTINATION'
        ? 'ยืนยันส่งตรงปลายทาง'
        : '';
  return [receiver, match].filter(Boolean).join(' · ');
};

const ParcelInfoStrip = ({ parcel }: { parcel: Parcel }) => {
  const note = getCleanNote(parcel);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div className="rounded-xl bg-surface-container-lowest px-3 py-2 ring-1 ring-outline-variant/10">
        <p className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/45">เอกสาร</p>
        <p className="mt-0.5 truncate text-xs font-black text-primary">{parcel['ประเภทเอกสาร'] || '-'}</p>
      </div>
      <div className="rounded-xl bg-surface-container-lowest px-3 py-2 ring-1 ring-outline-variant/10">
        <p className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/45">รายละเอียด</p>
        <p className="mt-0.5 truncate text-xs font-bold text-primary">{parcel['รายละเอียด'] || '-'}</p>
      </div>
      <div className="rounded-xl bg-surface-container-lowest px-3 py-2 ring-1 ring-outline-variant/10">
        <p className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/45">หมายเหตุ</p>
        <p className="mt-0.5 truncate text-xs font-bold text-primary">{note || '-'}</p>
      </div>
    </div>
  );
};

const CardActions = ({
  parcel,
  onOpen,
  onConfirm,
  onDelete,
  canConfirm,
  canDelete = false,
}: {
  parcel: Parcel;
  onOpen: () => void;
  onConfirm: () => void;
  onDelete?: () => void;
  canConfirm: boolean;
  canDelete?: boolean;
}) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
    {canConfirm && parcel['สถานะ'] !== 'ส่งสำเร็จ' && (
      <button
        type="button"
        onClick={onConfirm}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white shadow-sm transition-all hover:bg-primary/95 active:scale-[0.98] sm:flex-none"
      >
        <span className="material-symbols-outlined text-lg">add_a_photo</span>
        บันทึกผลการส่ง
      </button>
    )}
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-outline-variant/35 bg-white px-4 text-sm font-black text-primary transition-all hover:border-primary/35 hover:bg-primary/5 active:scale-[0.98] sm:flex-none"
    >
      <span className="material-symbols-outlined text-lg">history</span>
      ประวัติเต็ม
    </button>
    {canDelete && onDelete && (
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-error/20 bg-error/8 px-4 text-sm font-black text-error transition-all hover:bg-error hover:text-white active:scale-[0.98] sm:flex-none"
      >
        <span className="material-symbols-outlined text-lg">delete</span>
        ลบ
      </button>
    )}
  </div>
);

const MessengerDeliveryCard = ({
  parcel,
  onOpen,
  onConfirm,
}: {
  parcel: Parcel;
  onOpen: () => void;
  onConfirm: () => void;
}) => {
  const proof = getDeliveryProofSummary(parcel);
  const isDone = parcel['สถานะ'] === 'ส่งสำเร็จ';
  return (
    <article className={`rounded-2xl border bg-white p-3 shadow-sm sm:p-4 ${isDone ? 'border-emerald-100' : 'border-primary/15'}`}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-primary/6 px-2 py-1 font-mono text-xs font-black text-primary">{parcel.TrackingID}</code>
            {isDone && <StatusBadge status={parcel['สถานะ']} className="h-6 w-[92px] text-[10px]" />}
          </div>
          <p className="mt-2 text-sm font-black leading-tight text-primary">ส่งให้ {parcel['ผู้รับ'] || '-'}</p>
        </div>
        {!isDone && (
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white shadow-sm transition-all hover:bg-primary/95 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">add_a_photo</span>
            บันทึกผลการส่ง
          </button>
        )}
      </div>
      <MessengerRouteSummary parcel={parcel} />
      <div className="mt-3">
        <ParcelInfoStrip parcel={parcel} />
      </div>
      <div className="mt-3 rounded-xl border border-outline-variant/15 bg-surface-container-lowest/70 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/45">
          {isDone ? 'หลักฐานสรุป' : 'ตอนบันทึกต้องเก็บ'}
        </p>
        <p className="mt-1 text-xs font-bold leading-snug text-primary">
          {isDone ? (proof || 'ส่งสำเร็จแล้ว ดูประวัติเต็มเพื่อดูรูป/GPS') : 'ถ่ายรูปหลักฐาน + บันทึก GPS + ยืนยันว่าตรงปลายทางหรือฝากไว้ที่อื่น'}
        </p>
      </div>
      <div className="mt-3">
        <CardActions parcel={parcel} onOpen={onOpen} onConfirm={onConfirm} canConfirm={false} />
      </div>
    </article>
  );
};

const UserParcelOverviewCard = ({
  parcel,
  onOpen,
}: {
  parcel: Parcel;
  onOpen: () => void;
}) => (
  <article className="rounded-2xl border border-outline-variant/20 bg-white p-3 shadow-sm sm:p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <code className="rounded-lg bg-primary/6 px-2 py-1 font-mono text-xs font-black text-primary">{parcel.TrackingID}</code>
        <p className="mt-2 text-base font-black leading-tight text-primary">ส่งให้ {parcel['ผู้รับ'] || '-'}</p>
        <p className="mt-1 text-xs font-semibold text-on-surface-variant/70">ปลายทาง: {parcel['สาขาผู้รับ'] || '-'}</p>
      </div>
      <StatusBadge status={parcel['สถานะ']} />
    </div>
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="rounded-xl bg-surface-container-lowest px-3 py-2 ring-1 ring-outline-variant/10">
        <p className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/45">วันที่สร้าง</p>
        <p className="mt-0.5 text-xs font-bold text-primary">{formatThaiDateTime(parcel['วันที่สร้าง'])}</p>
      </div>
      <div className="rounded-xl bg-surface-container-lowest px-3 py-2 ring-1 ring-outline-variant/10">
        <p className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/45">อัปเดตล่าสุด</p>
        <p className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-primary">{getLatestTimelineSummary(parcel)}</p>
      </div>
    </div>
    <div className="mt-3">
      <ParcelInfoStrip parcel={parcel} />
    </div>
    <div className="mt-3">
      <CardActions parcel={parcel} onOpen={onOpen} onConfirm={() => undefined} canConfirm={false} />
    </div>
  </article>
);

const AdminParcelManagementCard = ({
  parcel,
  onOpen,
  onConfirm,
  onDelete,
}: {
  parcel: Parcel;
  onOpen: () => void;
  onConfirm: () => void;
  onDelete: () => void;
}) => (
  <article className="rounded-2xl border border-outline-variant/20 bg-white p-3 shadow-sm sm:p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <code className="rounded-lg bg-primary/6 px-2 py-1 font-mono text-xs font-black text-primary">{parcel.TrackingID}</code>
        <p className="mt-2 text-base font-black leading-tight text-primary">{parcel['ผู้ส่ง'] || '-'} → {parcel['ผู้รับ'] || '-'}</p>
        <p className="mt-1 text-xs font-semibold text-on-surface-variant/70">{parcel['สาขาผู้ส่ง'] || '-'} → {parcel['สาขาผู้รับ'] || '-'}</p>
      </div>
      <StatusBadge status={parcel['สถานะ']} />
    </div>
    <div className="mt-3">
      <ParcelInfoStrip parcel={parcel} />
    </div>
    <div className="mt-3 rounded-xl bg-surface-container-lowest px-3 py-2 ring-1 ring-outline-variant/10">
      <p className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/45">ล่าสุด</p>
      <p className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-primary">{getLatestTimelineSummary(parcel)}</p>
    </div>
    <div className="mt-3">
      <CardActions
        parcel={parcel}
        onOpen={onOpen}
        onConfirm={onConfirm}
        onDelete={onDelete}
        canConfirm
        canDelete
      />
    </div>
  </article>
);

export default function Dashboard({ isConfigured }: DashboardProps) {
  const { user } = useAuth();
  const { parcels, summary, loading, loadParcels, hasMore, loadMoreParcels, totalCount, removeParcelLocally } = useParcelStore();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const role = normalizeRole(user?.role);
  const isMessengerDashboard = role === 'MESSENGER';
  const defaultStatusFilter = 'ทั้งหมด';
  const [statusFilter, setStatusFilter] = useState(() => defaultStatusFilter);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [confirmTrackingId, setConfirmTrackingId] = useState<string | null>(null);
  const [isConfirmFlowOpen, setIsConfirmFlowOpen] = useState(false);
  const [isConfirmPreparingCamera, setIsConfirmPreparingCamera] = useState(false);
  const [isCreateFlowOpen, setIsCreateFlowOpen] = useState(false);
  const [isTrackFlowOpen, setIsTrackFlowOpen] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(120);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const isFetchingRef = useRef(false);
  const isUserDashboard = role === 'USER';
  const canConfirmParcel = role === 'ADMIN' || role === 'MESSENGER';
  const stats = useMemo(() => {
    return STATS.map((stat) => ({
      ...stat,
      label: isUserDashboard && stat.key === 'total' ? 'พัสดุของฉันทั้งหมด' : stat.label,
      count: summary?.[stat.key] ?? 0,
    }));
  }, [isUserDashboard, summary]);

  // Single fetch function — loadParcels already recomputes summary internally
  // ✅ FIX: Use ref to avoid stale closure without adding loadParcels to deps
  const loadParcelsRef = useRef(loadParcels);
  useEffect(() => { loadParcelsRef.current = loadParcels; }, [loadParcels]);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      await loadParcelsRef.current();
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      isFetchingRef.current = false;
      setRefreshCountdown(120);
    }
  }, []); // ✅ Empty deps — no infinite loop risk

  // Initial load
  useEffect(() => {
    if (!isConfigured) return;
    fetchData();
  }, [isConfigured, fetchData]);

  // Countdown tick — pauses when tab is hidden to save GAS quota
  useEffect(() => {
    if (!isConfigured) return;
    const timer = setInterval(() => {
      // Don't refresh when tab is not visible
      if (document.hidden) return;
      let shouldRefresh = false;
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          shouldRefresh = true;
          return 0;
        }
        return prev - 1;
      });
      if (shouldRefresh) {
        fetchData();
      }
    }, 1000);
    return () => clearInterval(timer);
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

  const messengerOpenParcels = useMemo(
    () => filteredParcels.filter(parcel => parcel['สถานะ'] !== 'ส่งสำเร็จ'),
    [filteredParcels],
  );
  const messengerDoneParcels = useMemo(
    () => filteredParcels.filter(parcel => parcel['สถานะ'] === 'ส่งสำเร็จ'),
    [filteredParcels],
  );

  // Pagination calculations — use totalCount from backend for accurate total pages
  const backendTotalPages = Math.max(1, Math.ceil((totalCount || filteredParcels.length) / pageSize));
  const { totalPages, paginatedParcels, startIndex, endIndex } = useMemo(() => {
    const total = backendTotalPages;
    const paginated = filteredParcels.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const start = filteredParcels.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, filteredParcels.length);
    return { totalPages: total, paginatedParcels: paginated, startIndex: start, endIndex: end };
  }, [filteredParcels, currentPage, pageSize, backendTotalPages]);

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [statusFilter, debouncedSearch]);

  // Clamp currentPage ไม่ให้เกิน totalPages เมื่อข้อมูลเปลี่ยน
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // Load more from backend when navigating to a page that needs more data
  useEffect(() => {
    const neededCount = currentPage * pageSize;
    if (neededCount > filteredParcels.length && hasMore && !loading) {
      loadMoreParcels();
    }
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    if (loading) return; // ป้องกันกดซ้ำระหว่าง loading
    await fetchData();
    toast.success('อัปเดตข้อมูลเรียบร้อย');
  };

  const selectedTimelineEvents = useMemo(() =>
    selectedParcel ? parseParcelTimeline(selectedParcel) : [], [selectedParcel]);

  /** True when the selected parcel has at least one known-coordinate branch. */
  const selectedParcelHasKnownBranches = useMemo(() => {
    if (!selectedParcel) return false;
    return selectedTimelineEvents.some(
      event => typeof event.latitude === 'number' && typeof event.longitude === 'number'
    );
  }, [selectedParcel, selectedTimelineEvents]);

  const clearFilters = () => { setSearchTerm(''); setStatusFilter(defaultStatusFilter); setCurrentPage(1); };
  const hasFilters = !!(searchTerm || statusFilter !== defaultStatusFilter);

  const handleDelete = async () => {
    if (!selectedParcel) return;
    setIsDeleteConfirmOpen(true);
  };

  const openConfirmFlow = (trackingId: string) => {
    setIsTimelineOpen(false);
    setConfirmTrackingId(trackingId);
    setIsConfirmFlowOpen(true);
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
            <span className="material-symbols-outlined text-3xl text-error">warning</span>
          </div>
          <h2 className="text-xl font-bold text-primary mb-2">ยังไม่ได้ตั้งค่าระบบ</h2>
          <p className="text-sm text-on-surface-variant">กรุณาตั้งค่า GAS URL และ API KEY ในไฟล์ .env</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {isMessengerDashboard && (
        <div className="rounded-2xl border border-primary/15 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-xl">local_shipping</span>
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-black leading-tight text-primary">งานที่ต้องไปส่งวันนี้</h2>
                  <p className="text-xs font-semibold leading-snug text-on-surface-variant/65">ดูเส้นทาง รับจากไหน → ส่งที่ไหน → ให้ใคร แล้วกดบันทึกผลได้ทันที</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white shadow-sm transition-all hover:bg-primary/95 active:scale-[0.98] disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
              อัปเดตงาน
            </button>
          </div>
        </div>
      )}

      {isUserDashboard && (
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <button
            type="button"
            onClick={() => setIsCreateFlowOpen(true)}
            className="flex items-center gap-2.5 rounded-xl border border-outline-variant/25 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <span className="material-symbols-outlined text-xl">add_box</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-primary">ส่งพัสดุใหม่</span>
              <span className="block truncate text-[11px] font-semibold text-on-surface-variant/55">กรอกผู้รับ/ปลายทาง</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setIsTrackFlowOpen(true)}
            className="flex items-center gap-2.5 rounded-xl border border-outline-variant/25 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-primary">ดูสถานะพัสดุ</span>
              <span className="block truncate text-[11px] font-semibold text-on-surface-variant/55">ดูว่าส่งถึงไหนแล้ว</span>
            </span>
          </button>
        </div>
      )}

      {/* ── Stats ── */}
      {!isMessengerDashboard && (
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
                    <span className={`material-symbols-outlined text-lg ${s.iconText}`}>{s.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-black leading-none text-primary">{s.count}</p>
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
              />
            ))}
          </div>
        </>
      )}

      {/* ── Filters ── */}
      <div className="bg-white/85 backdrop-blur-sm border border-outline-variant/30 rounded-xl p-2.5 sm:rounded-2xl sm:p-4 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xl">search</span>
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ค้นหาหมายเลขติดตาม, ผู้ส่ง, ผู้รับ หรือปลายทาง..."
              className="h-10 w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl pl-10 pr-10 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-display transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-on-surface-variant/50 transition-colors hover:bg-surface-container hover:text-primary"
                title="ล้างคำค้นหา"
                aria-label="ล้างคำค้นหา"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="flex h-8 items-center gap-1 rounded-lg border border-outline-variant/35 bg-white px-2 text-[11px] font-medium text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono font-bold text-primary">{refreshCountdown}s</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="grid h-8 w-8 place-items-center rounded-lg border border-outline-variant/35 bg-white text-on-surface-variant shadow-sm transition-all hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              title="รีเฟรช"
            >
              <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Role Cards ── */}
      <section className="overflow-hidden rounded-xl border border-outline-variant/35 bg-white/90 shadow-sm backdrop-blur-sm sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="material-symbols-outlined text-base text-primary sm:text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isMessengerDashboard ? 'route' : isUserDashboard ? 'inventory_2' : 'view_agenda'}
            </span>
            <h2 className="truncate font-display text-sm font-bold text-primary">
              {isMessengerDashboard ? 'งานส่งหน้าเดียวจบ' : isUserDashboard ? 'พัสดุของฉัน' : 'รายการจัดการพัสดุ'}
            </h2>
            <span className="rounded-full bg-primary/8 px-2 py-0.5 text-[11px] font-bold text-primary">
              {filteredParcels.length}
            </span>
            {loading && <span className="material-symbols-outlined text-sm text-primary animate-spin">progress_activity</span>}
          </div>
          {hasFilters && !isMessengerDashboard && (
            <button onClick={clearFilters}
              className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-error/80 transition-colors hover:text-error sm:text-xs">
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {loading && !filteredParcels.length ? (
          <TableSkeleton />
        ) : !filteredParcels.length ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">search_off</span>
            </div>
            <div>
              <p className="font-bold text-primary">ไม่พบข้อมูลพัสดุ</p>
              <p className="mt-0.5 text-sm text-on-surface-variant">ลองปรับคำค้นหา</p>
            </div>
            {hasFilters && !isMessengerDashboard && (
              <button onClick={clearFilters} className="text-sm font-bold text-primary hover:underline">ล้างตัวกรอง</button>
            )}
          </div>
        ) : isMessengerDashboard ? (
          <div className="space-y-5 p-3 sm:p-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-black text-primary">ต้องไปส่ง</h3>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700">{messengerOpenParcels.length} งาน</span>
              </div>
              {messengerOpenParcels.length ? (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {messengerOpenParcels.map(parcel => (
                    <MessengerDeliveryCard
                      key={parcel.TrackingID}
                      parcel={parcel}
                      onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                      onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-5 text-center text-sm font-bold text-emerald-800">
                  ไม่มีงานค้างส่งในตอนนี้
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-black text-primary">ส่งแล้ว</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">{messengerDoneParcels.length} งาน</span>
              </div>
              {messengerDoneParcels.length ? (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {messengerDoneParcels.map(parcel => (
                    <MessengerDeliveryCard
                      key={parcel.TrackingID}
                      parcel={parcel}
                      onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                      onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-5 text-center text-sm font-bold text-on-surface-variant/60">
                  ยังไม่มีงานที่ส่งสำเร็จในรายการนี้
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-3 sm:p-4">
            {paginatedParcels.map(parcel => (
              isUserDashboard ? (
                <UserParcelOverviewCard
                  key={parcel.TrackingID}
                  parcel={parcel}
                  onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                />
              ) : (
                <AdminParcelManagementCard
                  key={parcel.TrackingID}
                  parcel={parcel}
                  onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                  onConfirm={() => openConfirmFlow(parcel.TrackingID)}
                  onDelete={() => { setSelectedParcel(parcel); setIsDeleteConfirmOpen(true); }}
                />
              )
            ))}
          </div>
        )}

        {!isMessengerDashboard && filteredParcels.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-outline-variant/10 bg-surface-container-lowest/40 px-5 py-3 sm:flex-row">
            <span className="text-xs text-on-surface-variant/60">
              แสดง <span className="font-bold text-primary">{startIndex}–{endIndex}</span> จาก <span className="font-bold text-primary">{totalCount || filteredParcels.length}</span> รายการ
              {filteredParcels.length !== parcels.length && <span className="text-on-surface-variant/40"> (กรองจาก {parcels.length})</span>}
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30">
                  <span className="material-symbols-outlined text-base">first_page</span>
                </button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30">
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <span className="px-2 text-xs font-black text-primary">{currentPage}/{totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30">
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="rounded-lg p-1.5 text-on-surface-variant/50 transition-all hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-30">
                  <span className="material-symbols-outlined text-base">last_page</span>
                </button>
              </div>
            )}

            {hasMore && (
              <button
                onClick={loadMoreParcels}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
              >
                {loading ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : <span className="material-symbols-outlined text-sm">download</span>}
                โหลดข้อมูลเพิ่ม
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Timeline Dialog ── */}
      <ParcelTimelineModal
        isOpen={isTimelineOpen}
        setIsOpen={setIsTimelineOpen}
        selectedParcel={selectedParcel}
        selectedTimelineEvents={selectedTimelineEvents}
        hasKnownBranches={selectedParcelHasKnownBranches}
        onConfirmParcel={openConfirmFlow}
        onDeleteParcel={handleDelete}
      />

      {/* ── Confirm / Photo Capture Dialog ── */}
      <Dialog
        open={isConfirmFlowOpen}
        onOpenChange={(open) => {
          setIsConfirmFlowOpen(open);
          if (!open) {
            setConfirmTrackingId(null);
            setIsConfirmPreparingCamera(false);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-none"
        >
          <div className="modal-scroll relative max-h-[92vh] overflow-y-auto p-3 pr-4 sm:p-5 sm:pr-6">
            {!isConfirmPreparingCamera && (
              <button
                type="button"
                onClick={() => setIsConfirmFlowOpen(false)}
                className="absolute right-6 top-6 z-20 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
                aria-label="ปิดหน้าบันทึกการจัดส่ง"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            )}
            <ConfirmReceipt
              key={confirmTrackingId ?? 'confirm-flow'}
              initialTrackingId={confirmTrackingId}
              onInitialTrackingIdConsumed={() => undefined}
              autoCheckInitial
              autoOpenCamera
              embedded
              onPreparingCameraChange={setIsConfirmPreparingCamera}
              onComplete={() => {
                setIsConfirmFlowOpen(false);
                setConfirmTrackingId(null);
                setIsConfirmPreparingCamera(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── User Quick Create Dialog ── */}
      <Dialog open={isCreateFlowOpen} onOpenChange={setIsCreateFlowOpen}>
        <DialogContent
          showCloseButton={false}
          className="!left-0 !top-0 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none !translate-x-0 !translate-y-0 flex-col overflow-hidden rounded-none border-none bg-background p-0 shadow-2xl"
        >
          <DialogHeader className="shrink-0 border-b border-outline-variant/20 bg-primary px-5 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-secondary-container">
                  <span className="material-symbols-outlined text-xl">add_box</span>
                </span>
                <DialogTitle className="font-display text-lg font-black text-white">ส่งพัสดุใหม่</DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateFlowOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="ปิดหน้าส่งพัสดุใหม่"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
            <CreateParcel embedded />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── User Quick Track Dialog ── */}
      <Dialog open={isTrackFlowOpen} onOpenChange={setIsTrackFlowOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-hidden rounded-3xl border-none bg-background p-0 shadow-2xl"
        >
          <DialogHeader className="shrink-0 border-b border-outline-variant/20 bg-primary px-5 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-secondary-container">
                  <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
                </span>
                <DialogTitle className="font-display text-lg font-black text-white">ดูสถานะพัสดุ</DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => setIsTrackFlowOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="ปิดหน้าดูสถานะพัสดุ"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </DialogHeader>
          <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-3 sm:p-5">
            <Track embedded />
          </div>
        </DialogContent>
      </Dialog>

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
