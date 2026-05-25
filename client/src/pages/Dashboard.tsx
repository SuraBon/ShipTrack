/**
 * Dashboard Page
 */

import { lazy, Suspense, useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { useAuth } from '@/contexts/AuthContext';
import { deleteParcel, releaseDelivery, startDelivery } from '@/lib/parcelService';
import { useDebounce } from '@/hooks/useDebounce';
import { useGeolocation } from '@/hooks/useGeolocation';
import StatusBadge from '@/components/StatusBadge';
import ImagePopup from '@/components/ImagePopup';
import type { Parcel } from '@/types/parcel';
import { toast } from 'sonner';
import { parseParcelTimeline } from '@/lib/timeline';
import {
  buildAssignmentNote,
  canConfirmMessengerJob,
  canReleaseMessengerJob,
  getActiveDeliveryAssignment,
  isAssignedToCurrentUser,
  isAvailableForMessenger,
  parseAssignedToId,
  type DeliveryAssignment,
} from '@/lib/deliveryAssignment';
import { Skeleton } from '@/components/ui/skeleton';
import { formatThaiDateTime, getDateTime } from '@/lib/dateUtils';
import { normalizeRole, type AppRole } from '@/lib/roles';
import type { TimelineEvent } from '@/types/timeline';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UI_COPY } from '@/lib/uiCopy';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileClock,
  FilterX,
  History,
  Loader2,
  Map,
  Package,
  PackageCheck,
  RotateCcw,
  SearchX,
  Trash2,
  Truck,
  Undo2,
  type LucideIcon,
} from 'lucide-react';

interface DashboardProps { isConfigured: boolean; }

const ParcelTimelineModal = lazy(() => import('@/components/ParcelTimelineModal'));
const ConfirmReceipt = lazy(() => import('@/pages/ConfirmReceipt'));

const STATS = [
  { key: 'total',     filter: 'ทั้งหมด',     label: 'ทั้งหมด',  icon: 'inventory_2',     iconBg: 'bg-slate-100',    iconText: 'text-primary' },
  { key: 'pending',   filter: 'รอจัดส่ง',    label: 'รอจัดส่ง', icon: 'inventory_2', iconBg: 'bg-amber-50',    iconText: 'text-amber-600' },
  { key: 'transit',   filter: 'กำลังจัดส่ง', label: 'กำลังจัดส่ง', icon: 'local_shipping', iconBg: 'bg-blue-50',     iconText: 'text-blue-600' },
  { key: 'delivered', filter: 'ส่งสำเร็จ',   label: 'ส่งสำเร็จ', icon: 'task_alt',       iconBg: 'bg-emerald-50',  iconText: 'text-emerald-600' },
] as const;

const STALE_DAYS = 2;
type MessengerView = 'waiting' | 'mine' | 'done';
type AdminSortMode = 'newest' | 'oldest' | 'stale' | 'status';

const MESSENGER_BATCH_SIZE = 10;

const sortAdminParcels = (items: Parcel[], mode: AdminSortMode) => {
  const sorted = [...items];
  if (mode === 'oldest') {
    return sorted.sort((a, b) => getDateTime(a['วันที่สร้าง']) - getDateTime(b['วันที่สร้าง']));
  }
  if (mode === 'stale') {
    return sorted.sort((a, b) => {
      const staleDiff = Number(isParcelStale(b)) - Number(isParcelStale(a));
      if (staleDiff !== 0) return staleDiff;
      return getDateTime(a['วันที่สร้าง']) - getDateTime(b['วันที่สร้าง']);
    });
  }
  if (mode === 'status') {
    const statusOrder: Record<string, number> = {
      'รอจัดส่ง': 0,
      'กำลังจัดส่ง': 1,
      'ส่งสำเร็จ': 2,
    };
    return sorted.sort((a, b) => {
      const statusDiff = (statusOrder[a['สถานะ']] ?? 9) - (statusOrder[b['สถานะ']] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      return getDateTime(b['วันที่สร้าง']) - getDateTime(a['วันที่สร้าง']);
    });
  }
  return sorted.sort((a, b) => getDateTime(b['วันที่สร้าง']) - getDateTime(a['วันที่สร้าง']));
};

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
        ? 'border-slate-900/35 ring-2 ring-slate-900/10'
        : 'border-gray-100 hover:border-slate-300 hover:shadow-md'
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

const LazyPanelFallback = ({ label = 'กำลังโหลด...' }: { label?: string }) => (
  <div className="grid min-h-[220px] place-items-center rounded-2xl bg-white/80 p-6 text-center">
    <div className="flex flex-col items-center gap-3 text-primary">
      <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
      <p className="text-sm font-black">{label}</p>
    </div>
  </div>
);

const MessengerRouteSummary = ({ parcel, compact = false }: { parcel: Parcel; compact?: boolean }) => (
  <div className={`rounded-2xl bg-slate-50 ${compact ? 'p-2.5' : 'p-3'}`}>
    <div className="space-y-2.5">
      <div className="flex min-w-0 items-start gap-2.5 px-0.5">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.14)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black leading-none text-slate-400">รับจาก</p>
          <p className="mt-1 min-w-0 truncate text-[13px] font-bold leading-snug text-slate-700">
            {parcel['สาขาผู้ส่ง'] || '-'} <span className="font-medium text-slate-500">({parcel['ผู้ส่ง'] || '-'})</span>
          </p>
        </div>
      </div>
      <div className="flex min-w-0 items-start gap-2.5 rounded-xl bg-red-50/70 px-3 py-2.5">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(248,113,113,0.14)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black leading-none text-red-500">ต้องไปส่ง</p>
          <p className="mt-1 min-w-0 truncate text-[15px] font-black leading-snug text-slate-900">
            {parcel['สาขาผู้รับ'] || '-'} <span className="font-semibold text-slate-600">({parcel['ผู้รับ'] || '-'})</span>
          </p>
        </div>
      </div>
    </div>
    {compact && (
      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant/70">
        <span className="material-symbols-outlined text-base text-on-surface-variant/50">person_pin</span>
        <span className="min-w-0 truncate">ผู้รับ: {parcel['ผู้รับ'] || '-'}</span>
      </div>
    )}
  </div>
);

const getCleanNote = (parcel: Parcel) => {
  const createdEventNote = parcel.events?.find(evt => evt.eventType === 'CREATED')?.note?.trim();
  if (createdEventNote && createdEventNote !== 'รับเข้าระบบ') return createdEventNote;
  return (parcel['หมายเหตุ'] || '').replace(/\[[\s\S]*?\]/g, '').trim();
};

const timelineCache = new WeakMap<Parcel, TimelineEvent[]>();
const getTimelineEvents = (parcel: Parcel) => {
  const cached = timelineCache.get(parcel);
  if (cached) return cached;
  const events = parseParcelTimeline(parcel);
  timelineCache.set(parcel, events);
  return events;
};

const getLatestTimelineSummary = (parcel: Parcel) => {
  const events = getTimelineEvents(parcel);
  const latest = [...events].reverse().find(event => event.title || event.description);
  if (!latest) return 'ยังไม่มีประวัติการเคลื่อนไหว';
  return `${latest.title}${latest.description ? `: ${latest.description}` : ''}`;
};

const getParcelAgeDays = (parcel: Parcel) => {
  const createdAt = getDateTime(parcel['วันที่สร้าง']);
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt) / (24 * 60 * 60 * 1000)));
};

const isParcelStale = (parcel: Parcel) => parcel['สถานะ'] !== 'ส่งสำเร็จ' && getParcelAgeDays(parcel) > STALE_DAYS;

const sortMessengerWork = (a: Parcel, b: Parcel) => {
  const priority = (parcel: Parcel) => parcel['สถานะ'] === 'กำลังจัดส่ง' ? 0 : 1;
  const priorityDiff = priority(a) - priority(b);
  if (priorityDiff !== 0) return priorityDiff;
  return getDateTime(a['วันที่สร้าง']) - getDateTime(b['วันที่สร้าง']);
};

const wasAssignedToMe = (parcel: Parcel, employeeId: string): boolean => {
  const currentId = employeeId.trim().toUpperCase();
  if (!currentId) return false;
  
  let lastAssignedId = '';
  for (const event of parcel.events || []) {
    if (event.eventType === 'START_DELIVERY') {
      const assignedToId = parseAssignedToId(event.note);
      if (assignedToId) {
        lastAssignedId = assignedToId.trim().toUpperCase();
      }
    } else if (event.eventType === 'RELEASE_DELIVERY') {
      lastAssignedId = '';
    }
  }
  return lastAssignedId === currentId;
};

const resolveDashboardRole = (rawRole: unknown): AppRole => {
  return normalizeRole(rawRole);
};

const StaleBadge = ({ parcel }: { parcel: Parcel }) => {
  if (!isParcelStale(parcel)) return null;
  const ageDays = getParcelAgeDays(parcel);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-800">
      <span className="material-symbols-outlined text-[13px]">priority_high</span>
      ค้างนาน {ageDays} วัน
    </span>
  );
};

const ParcelInfoStrip = ({ parcel }: { parcel: Parcel }) => {
  const note = getCleanNote(parcel);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="rounded-xl bg-surface-container-lowest px-3 py-2 ring-1 ring-outline-variant/10">
        <p className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/45">{UI_COPY.parcel.itemDetail}</p>
        <p className="mt-0.5 truncate text-xs font-bold text-primary">{parcel['รายละเอียด'] || '-'}</p>
      </div>
      <div className="rounded-xl bg-surface-container-lowest px-3 py-2 ring-1 ring-outline-variant/10">
        <p className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/45">หมายเหตุ</p>
        <p className="mt-0.5 truncate text-xs font-bold text-primary">{note || '-'}</p>
      </div>
    </div>
  );
};

type DashboardActionVariant = 'primary' | 'secondary' | 'blue' | 'warning' | 'danger' | 'ghost';
type SectionTone = 'default' | 'amber' | 'emerald' | 'blue';

const actionVariantClass: Record<DashboardActionVariant, string> = {
  primary: 'bg-primary text-white shadow-sm hover:bg-primary/95',
  secondary: 'border border-outline-variant/35 bg-white text-primary hover:border-primary/35 hover:bg-primary/5',
  blue: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700',
  warning: 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
  danger: 'border border-error/20 bg-error/8 text-error hover:bg-error hover:text-white',
  ghost: 'bg-surface-container-lowest text-primary ring-1 ring-outline-variant/10 hover:bg-surface-container',
};

const dashboardIconMap: Record<string, LucideIcon> = {
  add_a_photo: Camera,
  delete: Trash2,
  done_all: PackageCheck,
  filter_alt_off: FilterX,
  history: History,
  inventory_2: Package,
  local_shipping: Truck,
  map: Map,
  priority_high: AlertTriangle,
  progress_activity: Loader2,
  search_off: SearchX,
  task_alt: CheckCircle2,
  undo: Undo2,
  view_agenda: ClipboardList,
};

const DashboardIcon = ({ icon, className = '' }: { icon: string; className?: string }) => {
  const Icon = dashboardIconMap[icon];
  if (Icon) return <Icon className={className || 'h-4 w-4'} aria-hidden="true" />;
  return <span className={`material-symbols-outlined ${className}`}>{icon}</span>;
};

const sectionToneClass: Record<SectionTone, { shell: string; icon: string; count: string }> = {
  default: {
    shell: 'border-outline-variant/20 bg-white',
    icon: 'bg-primary/8 text-primary',
    count: 'bg-primary/8 text-primary',
  },
  amber: {
    shell: 'border-amber-100 bg-amber-50/60',
    icon: 'bg-white text-amber-700',
    count: 'bg-white text-amber-800 shadow-sm',
  },
  emerald: {
    shell: 'border-emerald-100 bg-emerald-50/70',
    icon: 'bg-white text-emerald-700',
    count: 'bg-white text-emerald-800 shadow-sm',
  },
  blue: {
    shell: 'border-blue-100 bg-blue-50/70',
    icon: 'bg-white text-blue-700',
    count: 'bg-white text-blue-800 shadow-sm',
  },
};

const DashboardActionButton = ({
  icon,
  children,
  onClick,
  disabled,
  loading,
  variant = 'secondary',
  compact = false,
  className = '',
}: {
  icon: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: DashboardActionVariant;
  compact?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl font-black transition-all active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 sm:flex-none ${
      compact ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm'
    } ${actionVariantClass[variant]} ${className}`}
  >
    {loading ? (
      <Loader2 className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} animate-spin`} aria-hidden="true" />
    ) : (
      <DashboardIcon icon={icon} className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    )}
    {children}
  </button>
);

const RoleSectionHeader = ({
  icon,
  title,
  subtitle,
  count,
  tone = 'default',
}: {
  icon: string;
  title: string;
  subtitle?: string;
  count?: number;
  tone?: SectionTone;
}) => {
  const toneClass = sectionToneClass[tone];
  return (
    <div className={`mb-3 flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 ${toneClass.shell}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneClass.icon}`}>
          <DashboardIcon icon={icon} className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-black leading-tight text-primary">{title}</h3>
          {subtitle && <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-on-surface-variant/65">{subtitle}</p>}
        </div>
      </div>
      {typeof count === 'number' && (
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${toneClass.count}`}>
          {count} งาน
        </span>
      )}
    </div>
  );
};

const MessengerViewBanner = ({
  icon,
  title,
  subtitle,
  count,
  tone = 'amber',
}: {
  icon: string;
  title: string;
  subtitle: string;
  count: number;
  tone?: SectionTone;
}) => {
  const toneMap: Record<SectionTone, { shell: string; icon: string; badge: string }> = {
    default: {
      shell: 'border-slate-100 bg-slate-50/70',
      icon: 'bg-white text-slate-700',
      badge: 'border-slate-100 bg-white text-slate-700',
    },
    amber: {
      shell: 'border-orange-100 bg-orange-50/50',
      icon: 'bg-orange-100 text-orange-600',
      badge: 'border-orange-100 bg-white text-orange-600',
    },
    emerald: {
      shell: 'border-emerald-100 bg-emerald-50/60',
      icon: 'bg-emerald-100 text-emerald-700',
      badge: 'border-emerald-100 bg-white text-emerald-700',
    },
    blue: {
      shell: 'border-blue-100 bg-blue-50/60',
      icon: 'bg-blue-100 text-blue-700',
      badge: 'border-blue-100 bg-white text-blue-700',
    },
  };
  const classes = toneMap[tone];
  return (
    <div className={`mb-4 flex items-start gap-4 rounded-2xl border p-4 ${classes.shell}`}>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${classes.icon}`}>
        <DashboardIcon icon={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-bold text-gray-800">{title}</h3>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${classes.badge}`}>{count} งาน</span>
        </div>
        <p className="text-[11px] leading-relaxed text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
};

const EmptyState = ({
  icon,
  title,
  description,
  action,
  tone = 'default',
}: {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: SectionTone;
}) => {
  const toneClass = sectionToneClass[tone];
  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center ${toneClass.shell}`}>
      <div className={`grid h-14 w-14 place-items-center rounded-2xl ${toneClass.icon}`}>
        <DashboardIcon icon={icon} className="h-7 w-7" />
      </div>
      <div>
        <p className="font-bold text-primary">{title}</p>
        {description && <p className="mt-0.5 text-sm text-on-surface-variant/65">{description}</p>}
      </div>
      {action}
    </div>
  );
};

const AssignmentBadge = ({
  assignment,
  isMine = false,
  canRelease = false,
  isReleasing = false,
  onRelease,
}: {
  assignment: DeliveryAssignment;
  isMine?: boolean;
  canRelease?: boolean;
  isReleasing?: boolean;
  onRelease?: () => void;
}) => (
  <div className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold sm:flex-row sm:items-center sm:justify-between ${
    isMine
      ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
      : 'border-blue-100 bg-blue-50 text-blue-800'
  }`}>
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/80">
        <span className="material-symbols-outlined text-base">person_pin_circle</span>
      </span>
      <span className="min-w-0 truncate">
        {isMine ? 'คุณรับงานนี้แล้ว' : `คุณ ${assignment.assignedToName} กำลังส่งอยู่`}
      </span>
    </span>
    {canRelease && onRelease && (
      <DashboardActionButton
        icon="undo"
        onClick={onRelease}
        loading={isReleasing}
        variant={isMine ? 'warning' : 'secondary'}
        compact
        className="bg-white/85"
      >
        {isReleasing ? 'กำลังคืนงาน' : 'คืนงาน'}
      </DashboardActionButton>
    )}
  </div>
);

const CardActions = ({
  parcel,
  onOpen,
  onConfirm,
  onDelete,
  canConfirm,
  canDelete = false,
  detailLabel = 'ประวัติเต็ม',
  compactDetail = false,
}: {
  parcel: Parcel;
  onOpen: () => void;
  onConfirm: () => void;
  onDelete?: () => void;
  canConfirm: boolean;
  canDelete?: boolean;
  detailLabel?: string;
  compactDetail?: boolean;
}) => (
  <div className="grid gap-2">
    {canConfirm && parcel['สถานะ'] !== 'ส่งสำเร็จ' && (
      <button
        type="button"
        onClick={onConfirm}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
      >
        <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
        ยืนยันส่ง
      </button>
    )}
    <div className={canDelete && onDelete ? 'grid grid-cols-[minmax(0,1fr)_auto] gap-2' : 'grid'}>
      <button
        type="button"
        onClick={onOpen}
        className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white px-3 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] ${
          compactDetail ? 'h-10 text-xs' : 'h-11 text-sm'
        }`}
      >
        <History className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{detailLabel}</span>
      </button>
      {canDelete && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 font-semibold text-red-600 shadow-sm transition-all hover:bg-red-100 active:scale-[0.98] ${
            compactDetail ? 'h-10 text-xs' : 'h-11 text-sm'
          }`}
          aria-label="ลบรายการ"
          title="ลบรายการ"
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">ลบ</span>
        </button>
      )}
    </div>
  </div>
);

const MessengerDeliveryCard = ({
  parcel,
  onOpen,
  onConfirm,
  onStartDelivery,
  onReleaseDelivery,
  isStartingDelivery,
  isReleasingDelivery,
  assignment,
  canStartDelivery,
  canReleaseDelivery,
  canConfirmDelivery,
}: {
  parcel: Parcel;
  onOpen: () => void;
  onConfirm: () => void;
  onStartDelivery: () => void;
  onReleaseDelivery: () => void;
  isStartingDelivery: boolean;
  isReleasingDelivery: boolean;
  assignment: DeliveryAssignment | null;
  canStartDelivery: boolean;
  canReleaseDelivery: boolean;
  canConfirmDelivery: boolean;
}) => {
  const note = getCleanNote(parcel);
  const isDone = parcel['สถานะ'] === 'ส่งสำเร็จ';
  const isAssignedElsewhere = Boolean(assignment && !canConfirmDelivery && !isDone);
  const proofImageUrl = getTimelineEvents(parcel).find(event => event.imageUrl)?.imageUrl;
  const actionLabel = canStartDelivery
    ? (isStartingDelivery ? 'กำลังรับงาน' : 'รับงาน')
    : canConfirmDelivery
      ? 'ยืนยันส่ง'
      : '';

  let cardStyles = 'border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]';
  let iconName = 'person';
  let accentClass = 'bg-blue-50 text-blue-500';
  let statusLabel = 'รอดำเนินการ';
  let statusPillClass = 'bg-slate-100 text-slate-500';

  if (isDone) {
    cardStyles = 'border-emerald-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]';
    iconName = 'check_circle';
    accentClass = 'bg-emerald-50 text-emerald-600';
    statusLabel = 'ส่งแล้ว';
    statusPillClass = 'bg-emerald-100 text-emerald-700';
  } else if (canConfirmDelivery) {
    cardStyles = 'border-blue-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]';
    iconName = 'local_shipping';
    accentClass = 'bg-blue-50 text-blue-500';
    statusLabel = 'กำลังส่ง';
    statusPillClass = 'bg-blue-100 text-blue-600';
  } else if (canStartDelivery) {
    iconName = 'person';
    accentClass = 'bg-blue-50 text-blue-500';
    statusLabel = 'งานใหม่';
    statusPillClass = 'bg-blue-100 text-blue-600';
  } else if (isAssignedElsewhere) {
    statusLabel = 'มีผู้รับงานแล้ว';
    statusPillClass = 'bg-blue-50 text-blue-700';
  }

  const dateLabel = parcel['วันที่รับ']
    ? new Date(parcel['วันที่รับ']).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
    : 'เพิ่งเมื่อสักครู่';

  return (
    <article className={`flex h-full flex-col overflow-hidden rounded-[1.25rem] border transition-all duration-200 hover:shadow-md ${cardStyles}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3.5 py-2">
        <code className="min-w-0 truncate font-mono text-[10px] font-black tracking-wider text-slate-400">
          {parcel.TrackingID}
        </code>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPillClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${accentClass}`}>
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{iconName}</span>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] leading-none text-slate-400">ผู้รับ</p>
                <h3 className="mt-1 truncate text-base font-black leading-tight text-slate-900">
                  {parcel['ผู้รับ'] || '-'}
                </h3>
              </div>
            </div>

            {!isDone && (canStartDelivery || canConfirmDelivery) && (
              <DashboardActionButton
                icon={canStartDelivery ? 'task_alt' : 'task_alt'}
                onClick={canStartDelivery ? onStartDelivery : onConfirm}
                loading={canStartDelivery ? isStartingDelivery : false}
                variant="blue"
                compact
                className="h-10 flex-none rounded-xl bg-blue-600 px-4 text-xs font-black shadow-md shadow-blue-100 hover:bg-blue-700"
              >
                {actionLabel}
              </DashboardActionButton>
            )}
          </div>

          {assignment && !isDone && isAssignedElsewhere && (
            <AssignmentBadge assignment={assignment} />
          )}

          <MessengerRouteSummary parcel={parcel} />

          {(parcel['รายละเอียด'] || note || isParcelStale(parcel)) && (
            <div className="space-y-2">
              {(parcel['รายละเอียด'] || note) && (
                <div className="grid grid-cols-2 gap-2">
                  <div className={`flex min-w-0 items-start gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2 ${parcel['รายละเอียด'] ? '' : 'opacity-40'}`}>
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold leading-none text-slate-500">สิ่งที่ส่ง</p>
                      <p className="mt-1 min-w-0 truncate text-xs font-semibold leading-5 text-slate-800">
                        {parcel['รายละเอียด'] || '-'}
                      </p>
                    </div>
                  </div>

                  <div className={`flex min-w-0 items-start gap-2.5 rounded-xl bg-orange-50/70 px-2.5 py-2 ${note ? '' : 'opacity-40'}`}>
                    <span className="material-symbols-outlined mt-0.5 shrink-0 text-base leading-none text-orange-500">sticky_note_2</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold leading-none text-orange-600">หมายเหตุ</p>
                      <p className="mt-1 min-w-0 truncate text-xs font-semibold leading-5 text-slate-800">
                        {note || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <StaleBadge parcel={parcel} />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-50 pt-3">
          <div className="flex min-w-0 items-center gap-1 text-[10px] text-slate-300">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            <span className="truncate">{dateLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {proofImageUrl && (
              <ImagePopup
                url={proofImageUrl}
                title="รูปหลักฐาน"
                triggerVariant="icon"
                className="h-9 w-9 rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-100 hover:bg-blue-50 hover:text-blue-700"
              />
            )}
            {canReleaseDelivery && (
              <DashboardActionButton
                icon="undo"
                onClick={onReleaseDelivery}
                loading={isReleasingDelivery}
                variant="warning"
                compact
                className="h-8 flex-none rounded-lg px-2.5 text-[11px]"
              >
                {isReleasingDelivery ? 'กำลังคืน' : 'คืนงาน'}
              </DashboardActionButton>
            )}
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 transition-colors hover:text-blue-700"
            >
              ดูรายละเอียด
              <span className="material-symbols-outlined text-[13px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

const AdminParcelManagementCard = ({
  parcel,
  onOpen,
  onConfirm,
  onDelete,
  onReleaseDelivery,
  isReleasingDelivery,
  assignment,
}: {
  parcel: Parcel;
  onOpen: () => void;
  onConfirm: () => void;
  onDelete: () => void;
  onReleaseDelivery: () => void;
  isReleasingDelivery: boolean;
  assignment: DeliveryAssignment | null;
}) => {
  const note = getCleanNote(parcel);
  const isDone = parcel['สถานะ'] === 'ส่งสำเร็จ';
  const isInTransit = parcel['สถานะ'] === 'กำลังจัดส่ง';
  const statusLabel = isDone ? 'ส่งแล้ว' : isInTransit ? 'กำลังส่ง' : 'รอดำเนินการ';
  const statusPillClass = isDone
    ? 'bg-emerald-100 text-emerald-700'
    : isInTransit
      ? 'bg-blue-100 text-blue-600'
      : 'bg-amber-100 text-amber-700';
  const accentClass = isDone
    ? 'bg-emerald-50 text-emerald-600'
    : isInTransit
      ? 'bg-blue-50 text-blue-500'
      : 'bg-amber-50 text-amber-600';
  const iconName = isDone ? 'check_circle' : isInTransit ? 'local_shipping' : 'inventory_2';
  const dateLabel = formatThaiDateTime(parcel['วันที่รับ'] || parcel['วันที่สร้าง']);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2">
        <code className="min-w-0 truncate font-mono text-[10px] font-black tracking-wider text-slate-400">
          {parcel.TrackingID}
        </code>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPillClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${accentClass}`}>
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{iconName}</span>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] leading-none text-slate-400">ผู้รับ</p>
                <h3 className="mt-1 truncate text-sm font-semibold leading-tight text-slate-800">
                  {parcel['ผู้รับ'] || '-'}
                </h3>
              </div>
            </div>
            <StatusBadge status={parcel['สถานะ']} />
          </div>

          <MessengerRouteSummary parcel={parcel} />

          <div className="space-y-2">
            {(parcel['รายละเอียด'] || note) && (
              <div className="grid grid-cols-2 gap-2">
                <div className={`flex min-w-0 items-start gap-2.5 rounded-lg bg-slate-50 px-2.5 py-2 ${parcel['รายละเอียด'] ? '' : 'opacity-40'}`}>
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold leading-none text-slate-500">สิ่งที่ส่ง</p>
                    <p className="mt-1 min-w-0 truncate text-xs font-semibold leading-5 text-slate-800">
                      {parcel['รายละเอียด'] || '-'}
                    </p>
                  </div>
                </div>

                <div className={`flex min-w-0 items-start gap-2.5 rounded-lg bg-orange-50/70 px-2.5 py-2 ${note ? '' : 'opacity-40'}`}>
                  <span className="material-symbols-outlined mt-0.5 shrink-0 text-base leading-none text-orange-500">sticky_note_2</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold leading-none text-orange-600">หมายเหตุ</p>
                    <p className="mt-1 min-w-0 truncate text-xs font-semibold leading-5 text-slate-800">
                      {note || '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <StaleBadge parcel={parcel} />
          </div>

          {assignment && !isDone && (
            <AssignmentBadge
              assignment={assignment}
              canRelease
              isReleasing={isReleasingDelivery}
              onRelease={onReleaseDelivery}
            />
          )}

          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">ล่าสุด</p>
            <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-slate-700">{getLatestTimelineSummary(parcel)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-50 pt-3">
          <div className="flex min-w-0 items-center gap-1 text-[10px] text-slate-300">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            <span className="truncate">{dateLabel}</span>
          </div>
          <CardActions
            parcel={parcel}
            onOpen={onOpen}
            onConfirm={onConfirm}
            onDelete={onDelete}
            canConfirm
            canDelete
            detailLabel="ดูรายละเอียด"
            compactDetail
          />
        </div>
      </div>
    </article>
  );
};

const AdminParcelManagementTable = ({
  parcels,
  onOpen,
  onConfirm,
  onDelete,
  onReleaseDelivery,
  releasingDeliveryId,
}: {
  parcels: Parcel[];
  onOpen: (parcel: Parcel) => void;
  onConfirm: (parcel: Parcel) => void;
  onDelete: (parcel: Parcel) => void;
  onReleaseDelivery: (parcel: Parcel) => void;
  releasingDeliveryId: string | null;
}) => (
  <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Tracking</th>
            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">เส้นทาง</th>
            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">ผู้รับ</th>
            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">สถานะ</th>
            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">ล่าสุด</th>
            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-widest text-muted-foreground">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {parcels.map(parcel => {
            const assignment = getActiveDeliveryAssignment(parcel);
            const isDone = parcel['สถานะ'] === 'ส่งสำเร็จ';
            const isReleasing = releasingDeliveryId === parcel.TrackingID;
            return (
              <tr key={parcel.TrackingID} className={`${isParcelStale(parcel) ? 'bg-amber-50/30' : ''} transition-colors hover:bg-surface-container-lowest/70`}>
                <td className="px-4 py-3 align-top">
                  <code className="block max-w-[150px] break-all font-mono text-xs font-black text-primary">{parcel.TrackingID}</code>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatThaiDateTime(parcel['วันที่สร้าง'])}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="max-w-[220px] space-y-1 text-xs">
                    <p className="truncate font-semibold text-slate-800">{parcel['สาขาผู้ส่ง'] || '-'}</p>
                    <p className="truncate text-muted-foreground">→ {parcel['สาขาผู้รับ'] || '-'}</p>
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="max-w-[190px]">
                    <p className="truncate text-sm font-semibold text-foreground">{parcel['ผู้รับ'] || '-'}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{parcel['รายละเอียด'] || getCleanNote(parcel) || '-'}</p>
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="space-y-2">
                    <StatusBadge status={parcel['สถานะ']} />
                    {isParcelStale(parcel) && (
                      <span className="inline-flex rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">ค้างนาน</span>
                    )}
                    {assignment && !isDone && (
                      <p className="max-w-[180px] truncate text-[11px] font-semibold text-blue-700">ผู้รับงาน: {assignment.assignedToName}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="max-w-[240px] line-clamp-2 text-xs font-medium leading-relaxed text-slate-700">{getLatestTimelineSummary(parcel)}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => onOpen(parcel)} className="app-secondary-button h-9 px-2.5 text-xs">
                      <History className="h-3.5 w-3.5" aria-hidden="true" />
                      รายละเอียด
                    </button>
                    {!isDone && (
                      <button type="button" onClick={() => onConfirm(parcel)} className="app-primary-button h-9 px-2.5 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ยืนยันส่ง
                      </button>
                    )}
                    {assignment && !isDone && (
                      <button type="button" onClick={() => onReleaseDelivery(parcel)} disabled={isReleasing} className="app-secondary-button h-9 px-2.5 text-xs text-amber-700">
                        {isReleasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />}
                        คืนงาน
                      </button>
                    )}
                    <button type="button" onClick={() => onDelete(parcel)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-2.5 text-xs font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-100">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [confirmTrackingId, setConfirmTrackingId] = useState<string | null>(null);
  const [isConfirmFlowOpen, setIsConfirmFlowOpen] = useState(false);
  const [isConfirmPreparingCamera, setIsConfirmPreparingCamera] = useState(false);
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
  const canConfirmParcel = role === 'ADMIN' || role === 'MESSENGER';
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

  // Load more from backend when navigating to a page that needs more data
  useEffect(() => {
    const neededCount = currentPage * pageSize;
    if (neededCount > adminSortedParcels.length && hasMore && !loading) {
      loadMoreParcels();
    }
  }, [currentPage, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

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
    );
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
            <span className="material-symbols-outlined text-3xl text-error">warning</span>
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
      <div className="bg-transparent md:rounded-2xl md:border md:border-gray-100 md:bg-white md:p-4 md:shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl ${isMessengerDashboard ? 'text-gray-400' : 'text-on-surface-variant/50'}`}>search</span>
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
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden h-8 items-center gap-1 rounded-lg border border-outline-variant/35 bg-white px-2 text-[11px] font-medium text-on-surface-variant sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{lastUpdatedAt ? `อัปเดต ${new Date(lastUpdatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : 'รอข้อมูล'}</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className={isMessengerDashboard
                ? 'grid h-11 w-11 place-items-center rounded-xl border border-gray-100 bg-white text-gray-600 shadow-sm transition-all hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 md:h-12 md:w-12'
                : 'grid h-8 w-8 place-items-center rounded-lg border border-outline-variant/35 bg-white text-on-surface-variant shadow-sm transition-all hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'}
              title="รีเฟรช"
            >
              <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        </div>
        {!isMessengerDashboard && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-slate-600">
              <span className="material-symbols-outlined text-base text-slate-400">sort</span>
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
              <span className="material-symbols-outlined text-base text-slate-400">view_list</span>
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
                  icon="inventory_2"
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
                        onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
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
                          onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
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
                  icon="done_all"
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
                  <EmptyState icon="inventory_2" title="ยังไม่มีประวัติการส่งสำเร็จ" description="ประวัติงานที่คุณยืนยันส่งแล้วจะแสดงที่นี่" />
                )}
              </div>
            )}
            <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
              <div className="mx-auto grid max-w-[390px] grid-cols-3 gap-1">
                {[
                  { id: 'waiting' as const, label: 'งานรอรับ', icon: 'inventory_2', count: messengerWaitingParcels.length },
                  { id: 'mine' as const, label: 'งานที่ต้องส่ง', icon: 'local_shipping', count: messengerMineParcels.length },
                  { id: 'done' as const, label: 'ส่งสำเร็จ', icon: 'done_all', count: messengerDoneParcels.length },
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
                { id: 'waiting' as const, label: 'งานรอรับ', icon: 'inventory_2', count: messengerWaitingParcels.length },
                { id: 'mine' as const, label: 'งานที่ต้องส่ง', icon: 'local_shipping', count: messengerMineParcels.length },
                { id: 'done' as const, label: 'ส่งสำเร็จ', icon: 'done_all', count: messengerDoneParcels.length },
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
        ) : (
          <div className="space-y-4 pb-4">
            {adminNeedsAttentionParcels.length > 0 && (
              <div>
                <MessengerViewBanner
                  icon="priority_high"
                  title="ต้องจัดการ"
                  subtitle="งานที่ยังไม่สำเร็จหรือค้างนาน แสดงก่อนเพื่อไม่ต้องไล่หาเอง"
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
              icon="view_agenda"
              title="รายการอื่น"
              subtitle="รายการที่ไม่ได้อยู่ในกลุ่มต้องจัดการ"
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
                icon="task_alt"
                title="ไม่มีรายการอื่นในหน้านี้"
                description="รายการที่ต้องจัดการถูกแสดงไว้ด้านบนแล้ว"
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
              <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white p-1 sm:hidden">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30">
                  ก่อนหน้า
                </button>
                <span className="px-2 text-xs font-black text-primary">{currentPage}/{totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30">
                  ถัดไป
                </button>
              </div>
              <div className="hidden items-center gap-1 rounded-xl border border-gray-100 bg-white p-1 sm:flex">
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
              </>
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
          </div>
        )}
      </section>

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
            setIsConfirmPreparingCamera(false);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-none"
        >
          <DialogTitle className="sr-only">ยืนยันการส่ง</DialogTitle>
          <div className="modal-scroll relative max-h-[92vh] overflow-y-auto p-4 sm:p-6">
            {!isConfirmPreparingCamera && (
              <button
                type="button"
                onClick={() => setIsConfirmFlowOpen(false)}
                className="absolute right-6 top-6 z-20 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
                aria-label="ปิดหน้ายืนยันส่ง"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            )}
            <Suspense fallback={<LazyPanelFallback label="กำลังโหลดหน้ายืนยันส่ง..." />}>
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
