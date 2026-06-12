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
  { key: 'total',     filter: 'ทั้งหมด',     label: 'ทั้งหมด',  icon: 'inventory_2',     iconBg: 'bg-slate-100 dark:bg-surface-container',    iconText: 'text-primary dark:text-foreground' },
  { key: 'pending',   filter: 'รอจัดส่ง',    label: 'รอจัดส่ง', icon: 'package_open', iconBg: 'bg-amber-50 dark:bg-amber-900/25',    iconText: 'text-amber-600 dark:text-amber-400' },
  { key: 'transit',   filter: 'กำลังจัดส่ง', label: 'กำลังจัดส่ง', icon: 'local_shipping', iconBg: 'bg-blue-50 dark:bg-blue-900/25',     iconText: 'text-blue-600 dark:text-blue-400' },
  { key: 'delivered', filter: 'ส่งสำเร็จ',   label: 'ส่งสำเร็จ', icon: 'check_circle',       iconBg: 'bg-emerald-50 dark:bg-emerald-900/25',  iconText: 'text-emerald-600 dark:text-emerald-400' },
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
    className={`flex min-h-[92px] w-full items-center rounded-sm border-2 bg-white dark:bg-card px-5 py-4 text-left transition-all duration-150 ${
      active
        ? 'border-outline-variant bg-secondary/10 dark:bg-secondary/20 shadow-[2px_2px_0px_0px_var(--outline-variant)]'
        : 'border-outline-variant shadow-[3px_3px_0px_0px_var(--outline-variant)] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_var(--outline-variant)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--outline-variant)]'
    }`}
  >
    <div className="flex min-w-0 items-center gap-4">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-sm border-1.5 border-outline-variant ${iconBg}`}>
        <DashboardIcon icon={icon} className={`h-6 w-6 ${iconText}`} />
      </div>
      <div className="min-w-0 flex-1">
        {loading ? (
          <Skeleton className="h-7 w-12 rounded-lg" />
        ) : (
          <p className="text-3xl font-black leading-none text-primary font-display">{count}</p>
        )}
        <p className="mt-1 truncate text-sm font-black leading-tight text-primary">{label}</p>
      </div>
    </div>
  </button>
);

export const TableSkeleton = () => (
  <div className="w-full space-y-3 p-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="rounded-sm border-2 border-outline-variant bg-white dark:bg-card p-4 shadow-[2px_2px_0px_0px_var(--outline-variant)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-32 rounded-sm" />
            <Skeleton className="h-4 w-3/4 rounded-sm" />
          </div>
          <Skeleton className="h-7 w-24 rounded-sm" />
        </div>
        <Skeleton className="mt-4 h-24 w-full rounded-sm" />
      </div>
    ))}
  </div>
);

export const LazyPanelFallback = ({ label = 'กำลังโหลด...' }: { label?: string }) => (
  <div className="grid min-h-[220px] place-items-center rounded-sm border-2 border-outline-variant bg-white dark:bg-card p-6 text-center shadow-[3px_3px_0px_0px_var(--outline-variant)]">
    <div className="flex flex-col items-center gap-3 text-primary">
      <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
      <p className="text-sm font-black">{label}</p>
    </div>
  </div>
);

export const MessengerRouteSummary = ({ parcel, compact = false }: { parcel: Parcel; compact?: boolean }) => (
  <div className={`rounded-sm border border-outline-variant bg-slate-50 dark:bg-surface-container ${compact ? 'p-2.5' : 'p-3'}`}>
    <div className="space-y-2.5">
      <div className="flex min-w-0 items-start gap-2.5 px-0.5">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.14)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black leading-none text-slate-400 dark:text-muted-foreground">รับจาก</p>
          <p className="mt-1 min-w-0 truncate text-[13px] font-bold leading-snug text-slate-700 dark:text-foreground">
            {parcel['สาขาผู้ส่ง'] || '-'} <span className="font-medium text-slate-500 dark:text-muted-foreground">({parcel['ผู้ส่ง'] || '-'})</span>
          </p>
        </div>
      </div>
      <div className="flex min-w-0 items-start gap-2.5 rounded-sm bg-red-50/70 dark:bg-red-900/15 border border-red-700/25 px-3 py-2.5">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(248,113,113,0.14)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black leading-none text-red-500 dark:text-red-400">ต้องไปส่ง</p>
          <p className="mt-1 min-w-0 truncate text-[15px] font-black leading-snug text-slate-900 dark:text-foreground">
            {parcel['สาขาผู้รับ'] || '-'} <span className="font-semibold text-slate-600 dark:text-muted-foreground">({parcel['ผู้รับ'] || '-'})</span>
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

// Cache for parcel timeline events to prevent re-parsing on every render.
// Since we use a WeakMap, the cache key (parcel object) is weak. If a parcel object
// is updated (which replaces the object reference in the store rather than mutating it),
// the cached entry will automatically garbage collect and re-fetch, avoiding stale cache.
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

export const getPreferredParcelImage = (parcel: Parcel): string | undefined => {
  const events = getTimelineEvents(parcel);
  const destinationImage = [...events]
    .reverse()
    .find(event => (event.eventType === 'DELIVERED' || event.eventType === 'PROXY') && event.imageUrl)
    ?.imageUrl;
  if (destinationImage) return destinationImage;

  const latestImage = [...events].reverse().find(event => event.imageUrl)?.imageUrl;
  if (latestImage) return latestImage;

  return events.find(event => event.eventType === 'CREATED' && event.imageUrl)?.imageUrl;
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
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/25 px-2 py-1 text-[10px] font-black text-amber-800 dark:text-amber-300">
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">priority_high</span>
      ค้างนาน {ageDays} วัน
    </span>
  );
};

type DashboardActionVariant = 'primary' | 'secondary' | 'blue' | 'warning' | 'danger' | 'ghost';
type SectionTone = 'default' | 'amber' | 'emerald' | 'blue';

const actionVariantClass: Record<DashboardActionVariant, string> = {
  primary: 'bg-primary text-primary-foreground border-2 border-outline-variant shadow-[2px_2px_0px_0px_var(--outline-variant)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_var(--outline-variant)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--outline-variant)]',
  secondary: 'border-2 border-outline-variant bg-white dark:bg-surface-container text-foreground hover:bg-surface-container-low shadow-[2px_2px_0px_0px_var(--outline-variant)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_var(--outline-variant)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--outline-variant)]',
  blue: 'bg-secondary text-secondary-foreground border-2 border-outline-variant shadow-[2px_2px_0px_0px_var(--outline-variant)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_var(--outline-variant)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--outline-variant)]',
  warning: 'border-2 border-outline-variant bg-amber-100 dark:bg-amber-950/40 text-amber-950 dark:text-amber-300 shadow-[2px_2px_0px_0px_var(--outline-variant)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_var(--outline-variant)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--outline-variant)]',
  danger: 'border-2 border-outline-variant bg-red-100 dark:bg-red-950/40 text-red-950 dark:text-red-300 shadow-[2px_2px_0px_0px_var(--outline-variant)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_var(--outline-variant)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--outline-variant)]',
  ghost: 'bg-transparent text-primary hover:bg-secondary/15',
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
    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-sm font-black transition-all disabled:cursor-wait disabled:opacity-70 sm:flex-none ${
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
      shell: 'border-2 border-outline-variant bg-surface-container dark:bg-card shadow-[3px_3px_0px_0px_var(--outline-variant)]',
      icon: 'bg-surface-container-low dark:bg-surface-container text-on-surface-variant border-r-2 border-outline-variant',
      badge: 'border-2 border-outline-variant bg-surface-container-low dark:bg-surface-container text-on-surface-variant',
    },
    amber: {
      shell: 'border-2 border-outline-variant bg-surface-container dark:bg-card shadow-[3px_3px_0px_0px_var(--outline-variant)]',
      icon: 'bg-surface-container-low dark:bg-surface-container text-on-surface-variant border-r-2 border-outline-variant',
      badge: 'border-2 border-outline-variant bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300',
    },
    emerald: {
      shell: 'border-2 border-outline-variant bg-surface-container dark:bg-card shadow-[3px_3px_0px_0px_var(--outline-variant)]',
      icon: 'bg-surface-container-low dark:bg-surface-container text-on-surface-variant border-r-2 border-outline-variant',
      badge: 'border-2 border-outline-variant bg-emerald-100 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300',
    },
    blue: {
      shell: 'border-2 border-outline-variant bg-surface-container dark:bg-card shadow-[3px_3px_0px_0px_var(--outline-variant)]',
      icon: 'bg-surface-container-low dark:bg-surface-container text-on-surface-variant border-r-2 border-outline-variant',
      badge: 'border-2 border-outline-variant bg-blue-100 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300',
    },
  };
  const classes = toneMap[tone];
  return (
    <div className={`mb-4 flex items-stretch overflow-hidden rounded-sm ${classes.shell}`}>
      <div className={`grid h-auto w-12 shrink-0 place-items-center ${classes.icon}`}>
        <DashboardIcon icon={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-black text-on-surface dark:text-foreground">{title}</h3>
          <span className={`shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-black ${classes.badge}`}>{count} งาน</span>
        </div>
        <p className="text-[11px] font-semibold leading-relaxed text-on-surface-variant dark:text-muted-foreground">{subtitle}</p>
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
  <div className={`flex flex-col gap-2 rounded-sm border-2 px-3 py-2.5 text-xs font-black sm:flex-row sm:items-center sm:justify-between shadow-[2px_2px_0px_0px_var(--outline-variant)] ${
    isMine
      ? 'border-outline-variant bg-emerald-100 dark:bg-emerald-900/30 text-emerald-950 dark:text-emerald-300'
      : 'border-outline-variant bg-blue-100 dark:bg-blue-900/30 text-blue-950 dark:text-blue-300'
  }`}>
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm border border-outline-variant bg-white/80 dark:bg-card">
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
        className="bg-white/85 dark:bg-card"
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
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-sm border-2 border-outline-variant bg-slate-900 text-white font-black shadow-[2px_2px_0px_0px_var(--outline-variant)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_var(--outline-variant)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--outline-variant)]"
      >
        <PackageCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        ยืนยันส่ง
      </button>
    )}
    <div className={canDelete && onDelete ? 'grid grid-cols-[minmax(0,1fr)_auto] gap-2' : 'grid'}>
      <button
        type="button"
        onClick={onOpen}
        className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-sm border-2 border-outline-variant bg-white dark:bg-card px-3 font-black text-foreground shadow-[2px_2px_0px_0px_var(--outline-variant)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_var(--outline-variant)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--outline-variant)] ${
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
          className={`inline-flex items-center justify-center gap-2 rounded-sm border-2 border-outline-variant bg-red-100 dark:bg-red-950/40 px-3 font-black text-red-700 dark:text-red-300 shadow-[2px_2px_0px_0px_var(--outline-variant)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_var(--outline-variant)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_var(--outline-variant)] ${
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
    slate: 'bg-slate-50 dark:bg-surface-container text-slate-700 dark:text-muted-foreground',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    orange: 'bg-orange-50 dark:bg-amber-900/20 text-orange-700 dark:text-amber-300',
  };

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-sm border-2 border-outline-variant bg-white dark:bg-card p-3 shadow-[2px_2px_0px_0px_var(--outline-variant)]">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-outline-variant ${toneClasses[tone]}`}>
        <span className="material-symbols-outlined text-xl" aria-hidden="true">{icon}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black leading-none text-muted-foreground">{label}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm font-black leading-snug text-foreground">
          {value?.trim() || '-'}
        </p>
      </div>
    </div>
  );
};
