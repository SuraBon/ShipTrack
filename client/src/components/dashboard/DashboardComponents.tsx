import { type ReactNode } from 'react';
import StatusBadge from '@/components/StatusBadge';
import type { Parcel } from '@/types/parcel';
import type { TimelineEvent } from '@/types/timeline';
import { parseParcelTimeline } from '@/lib/timeline';
import { formatThaiDateTime, getDateTime } from '@/lib/dateUtils';
import { normalizeRole, type AppRole } from '@/lib/roles';
import { parseAssignedToId } from '@/lib/deliveryAssignment';
import type { DeliveryAssignment } from '@/lib/deliveryAssignment';
import { Skeleton } from '@/components/ui/skeleton';
import { translateSystemNote } from '@/lib/translationUtils';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  ClipboardCheck,
  FilterX,
  History,
  Loader2,
  Map,
  Package,
  PackageCheck,
  PackageOpen,
  RotateCcw,
  Search,
  SearchX,
  Trash2,
  Truck,
  Undo2,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';

export const STATS = [
  { key: 'total',     filter: 'ทั้งหมด',     label: 'ทั้งหมด',  icon: 'inventory_2',     iconBg: 'bg-slate-100',    iconText: 'text-primary' },
  { key: 'pending',   filter: 'รอจัดส่ง',    label: 'รอจัดส่ง', icon: 'package_open', iconBg: 'bg-amber-50',    iconText: 'text-amber-600' },
  { key: 'transit',   filter: 'กำลังจัดส่ง', label: 'กำลังจัดส่ง', icon: 'local_shipping', iconBg: 'bg-blue-50',     iconText: 'text-blue-600' },
  { key: 'delivered', filter: 'ส่งสำเร็จ',   label: 'ส่งสำเร็จ', icon: 'check_circle',       iconBg: 'bg-emerald-50',  iconText: 'text-emerald-600' },
] as const;

export const STALE_DAYS = 2;
export type MessengerView = 'waiting' | 'mine' | 'done';
export type AdminSortMode = 'newest' | 'oldest' | 'stale' | 'status';

export const MESSENGER_BATCH_SIZE = 10;

const dashboardIconMap: Record<string, LucideIcon> = {
  add_a_photo: Camera,
  assignment_turned_in: ClipboardCheck,
  check_circle: CheckCircle2,
  delete: Trash2,
  done_all: PackageCheck,
  filter_alt_off: FilterX,
  history: History,
  inventory_2: Package,
  local_shipping: Truck,
  map: Map,
  package_check: PackageCheck,
  package_open: PackageOpen,
  person_pin_circle: UserCheck,
  priority_high: AlertTriangle,
  progress_activity: Loader2,
  search: Search,
  search_off: SearchX,
  task_alt: CheckCircle2,
  undo: Undo2,
  view_agenda: ClipboardList,
};

export const DashboardIcon = ({ icon, className = '' }: { icon: string; className?: string }) => {
  const Icon = dashboardIconMap[icon];
  if (Icon) return <Icon className={className || 'h-4 w-4'} aria-hidden="true" />;
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{icon}</span>;
};

export const sortAdminParcels = (items: Parcel[], mode: AdminSortMode) => {
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

export const StatsCard = ({
  label,
  icon,
  iconBg,
  iconText,
  count,
  active,
  onClick,
  loading = false,
}: {
  label: string;
  icon: string;
  iconBg: string;
  iconText: string;
  count: number;
  active: boolean;
  onClick: () => void;
  loading?: boolean;
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
        <DashboardIcon icon={icon} className={`h-6 w-6 ${iconText}`} />
      </div>
      <div className="min-w-0 flex-1">
        {loading ? (
          <Skeleton className="h-7 w-12 rounded-lg" />
        ) : (
          <p className="text-3xl font-black leading-none text-primary font-display">{count}</p>
        )}
        <p className="mt-1 truncate text-sm font-medium leading-tight text-primary">{label}</p>
      </div>
    </div>
  </button>
);

export const TableSkeleton = () => (
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

export const LazyPanelFallback = ({ label = 'กำลังโหลด...' }: { label?: string }) => (
  <div className="grid min-h-[220px] place-items-center rounded-2xl bg-white/80 p-6 text-center">
    <div className="flex flex-col items-center gap-3 text-primary">
      <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
      <p className="text-sm font-black">{label}</p>
    </div>
  </div>
);

export const MessengerRouteSummary = ({ parcel, compact = false }: { parcel: Parcel; compact?: boolean }) => (
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
        <span className="material-symbols-outlined text-base text-on-surface-variant/50" aria-hidden="true">person_pin</span>
        <span className="min-w-0 truncate">ผู้รับ: {parcel['ผู้รับ'] || '-'}</span>
      </div>
    )}
  </div>
);

export const getCleanNote = (parcel: Parcel) => {
  const createdEventNote = parcel.events?.find(evt => evt.eventType === 'CREATED')?.note?.trim();
  if (createdEventNote && createdEventNote !== 'รับเข้าระบบ') return createdEventNote;
  return (parcel['หมายเหตุ'] || '').replace(/\[[\s\S]*?\]/g, '').trim();
};

const timelineCache = new WeakMap<Parcel, TimelineEvent[]>();
export const getTimelineEvents = (parcel: Parcel): TimelineEvent[] => {
  const cached = timelineCache.get(parcel);
  if (cached) return cached;
  const events = parseParcelTimeline(parcel);
  timelineCache.set(parcel, events);
  return events;
};

export const getLatestTimelineSummary = (parcel: Parcel) => {
  const events = getTimelineEvents(parcel);
  const latest = [...events].reverse().find(event => event.title || event.description);
  if (!latest) return 'ยังไม่มีประวัติการเคลื่อนไหว';
  return `${latest.title}${latest.description ? `: ${latest.description}` : ''}`;
};

export const getParcelAgeDays = (parcel: Parcel) => {
  const createdAt = getDateTime(parcel['วันที่สร้าง']);
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt) / (24 * 60 * 60 * 1000)));
};

export const isParcelStale = (parcel: Parcel) => parcel['สถานะ'] !== 'ส่งสำเร็จ' && getParcelAgeDays(parcel) > STALE_DAYS;

export const sortMessengerWork = (a: Parcel, b: Parcel) => {
  const priority = (parcel: Parcel) => parcel['สถานะ'] === 'กำลังจัดส่ง' ? 0 : 1;
  const priorityDiff = priority(a) - priority(b);
  if (priorityDiff !== 0) return priorityDiff;
  return getDateTime(a['วันที่สร้าง']) - getDateTime(b['วันที่สร้าง']);
};

export const wasAssignedToMe = (parcel: Parcel, employeeId: string): boolean => {
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

export const resolveDashboardRole = (rawRole: unknown): AppRole => {
  return normalizeRole(rawRole);
};

export const StaleBadge = ({ parcel }: { parcel: Parcel }) => {
  if (!isParcelStale(parcel)) return null;
  const ageDays = getParcelAgeDays(parcel);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-800">
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">priority_high</span>
      ค้างนาน {ageDays} วัน
    </span>
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

export const DashboardActionButton = ({
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

export const MessengerViewBanner = ({
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

export const AssignmentBadge = ({
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
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/85">
        <DashboardIcon icon="person_pin_circle" className="h-4 w-4" />
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

export const CardActions = ({
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
        <PackageCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
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
        <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
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

export const DeliveryInfoRow = ({
  icon,
  label,
  value,
  tone = 'slate',
}: {
  icon: string;
  label: string;
  value?: string;
  tone?: 'slate' | 'blue' | 'emerald' | 'orange';
}) => {
  const toneClasses = {
    slate: 'bg-slate-50 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    orange: 'bg-orange-50 text-orange-700',
  };

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneClasses[tone]}`}>
        <span className="material-symbols-outlined text-xl" aria-hidden="true">{icon}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold leading-none text-slate-400">{label}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm font-black leading-snug text-slate-900">
          {value?.trim() || '-'}
        </p>
      </div>
    </div>
  );
};
