/**
 * Dashboard Page
 */

import { lazy, Suspense, useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { useAuth } from '@/contexts/AuthContext';
import { deleteParcel, releaseDelivery, startDelivery } from '@/lib/parcelService';
import { useDebounce } from '@/hooks/useDebounce';
import StatusBadge from '@/components/StatusBadge';
import type { Parcel } from '@/types/parcel';
import { toast } from 'sonner';
import { parseParcelTimeline } from '@/lib/timeline';
import { buildAssignmentNote, getActiveDeliveryAssignment, type DeliveryAssignment } from '@/lib/deliveryAssignment';
import { Skeleton } from '@/components/ui/skeleton';
import { formatThaiDateTime, getDateTime } from '@/lib/dateUtils';
import ImagePopup from '@/components/ImagePopup';
import { normalizeRole, type AppRole } from '@/lib/roles';
import type { TimelineEvent } from '@/types/timeline';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DashboardProps { isConfigured: boolean; }

const ParcelTimelineModal = lazy(() => import('@/components/ParcelTimelineModal'));
const TrackingMap = lazy(() => import('@/components/TrackingMap'));
const ConfirmReceipt = lazy(() => import('@/pages/ConfirmReceipt'));
const CreateParcel = lazy(() => import('@/pages/CreateParcel'));
const Track = lazy(() => import('@/pages/Track'));

const STATS = [
  { key: 'total',     filter: 'ทั้งหมด',     label: 'ทั้งหมด',  icon: 'inventory_2',     iconBg: 'bg-slate-100',    iconText: 'text-primary' },
  { key: 'pending',   filter: 'รอจัดส่ง',    label: 'รอจัดส่ง', icon: 'inventory_2', iconBg: 'bg-amber-50',    iconText: 'text-amber-600' },
  { key: 'transit',   filter: 'กำลังจัดส่ง', label: 'กำลังจัดส่ง', icon: 'local_shipping', iconBg: 'bg-blue-50',     iconText: 'text-blue-600' },
  { key: 'delivered', filter: 'ส่งสำเร็จ',   label: 'ส่งสำเร็จ', icon: 'task_alt',       iconBg: 'bg-emerald-50',  iconText: 'text-emerald-600' },
] as const;

const STALE_DAYS = 2;
const PREVIEW_ROLES: AppRole[] = ['USER', 'MESSENGER', 'ADMIN'];

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

const LazyPanelFallback = ({ label = 'กำลังโหลด...' }: { label?: string }) => (
  <div className="grid min-h-[220px] place-items-center rounded-2xl bg-white/80 p-6 text-center">
    <div className="flex flex-col items-center gap-3 text-primary">
      <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
      <p className="text-sm font-black">{label}</p>
    </div>
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

const getDeliveryProofEvent = (events: TimelineEvent[]) =>
  [...events].reverse().find(event =>
    event.title.includes('ส่งสำเร็จ') &&
    (event.imageUrl || (typeof event.latitude === 'number' && typeof event.longitude === 'number'))
  );

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

const resolveDashboardRole = (rawRole: unknown): AppRole => {
  if (import.meta.env.DEV) {
    const previewRole = new URLSearchParams(window.location.search).get('previewRole');
    const normalizedPreview = normalizeRole(previewRole);
    if (PREVIEW_ROLES.includes(normalizedPreview)) return normalizedPreview;
  }
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
    <span className={`material-symbols-outlined ${compact ? 'text-base' : 'text-lg'} ${loading ? 'animate-spin' : ''}`}>
      {loading ? 'progress_activity' : icon}
    </span>
    {children}
  </button>
);

const ActionGroup = ({ children, compact = false }: { children: ReactNode; compact?: boolean }) => (
  <div className={`flex flex-col gap-2 sm:flex-row sm:items-center ${compact ? 'sm:justify-end' : ''}`}>
    {children}
  </div>
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
          <span className="material-symbols-outlined text-lg">{icon}</span>
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
        <span className="material-symbols-outlined text-3xl">{icon}</span>
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
        {isReleasing ? 'กำลังปล่อย' : 'ปล่อยงาน'}
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
  <ActionGroup>
    {canConfirm && parcel['สถานะ'] !== 'ส่งสำเร็จ' && (
      <DashboardActionButton
        icon="add_a_photo"
        onClick={onConfirm}
        variant="primary"
      >
        บันทึกผลการส่ง
      </DashboardActionButton>
    )}
    <DashboardActionButton
      icon="history"
      onClick={onOpen}
      variant="secondary"
      compact={compactDetail}
    >
      {detailLabel}
    </DashboardActionButton>
    {canDelete && onDelete && (
      <DashboardActionButton
        icon="delete"
        onClick={onDelete}
        variant="danger"
      >
        ลบ
      </DashboardActionButton>
    )}
  </ActionGroup>
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
  const proof = getDeliveryProofSummary(parcel);
  const isDone = parcel['สถานะ'] === 'ส่งสำเร็จ';
  const isAssignedElsewhere = Boolean(assignment && !canConfirmDelivery && !isDone);
  return (
    <article className={`rounded-2xl border bg-white p-3 shadow-sm sm:p-4 ${isDone ? 'border-emerald-100' : 'border-primary/15'}`}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-primary/6 px-2 py-1 font-mono text-xs font-black text-primary">{parcel.TrackingID}</code>
            {isDone && <StatusBadge status={parcel['สถานะ']} className="h-6 w-[92px] text-[10px]" />}
            <StaleBadge parcel={parcel} />
          </div>
          <p className="mt-2 text-sm font-black leading-tight text-primary">ส่งให้ {parcel['ผู้รับ'] || '-'}</p>
        </div>
        {!isDone && (
          <ActionGroup compact>
            {canStartDelivery && (
              <DashboardActionButton
                icon="local_shipping"
                onClick={onStartDelivery}
                loading={isStartingDelivery}
                variant="blue"
              >
                {isStartingDelivery ? 'กำลังรับงาน' : 'รับงาน'}
              </DashboardActionButton>
            )}
            {canReleaseDelivery && (
              <DashboardActionButton
                icon="undo"
                onClick={onReleaseDelivery}
                loading={isReleasingDelivery}
                variant="warning"
              >
                {isReleasingDelivery ? 'กำลังปล่อย' : 'ปล่อยงาน'}
              </DashboardActionButton>
            )}
            {canConfirmDelivery && (
              <DashboardActionButton
                icon="add_a_photo"
                onClick={onConfirm}
                variant="primary"
              >
                บันทึกผลการส่ง
              </DashboardActionButton>
            )}
          </ActionGroup>
        )}
      </div>
      {assignment && !isDone && (
        <div className="mb-3">
          <AssignmentBadge assignment={assignment} isMine={!isAssignedElsewhere} />
        </div>
      )}
      <MessengerRouteSummary parcel={parcel} />
      <div className="mt-3">
        <ParcelInfoStrip parcel={parcel} />
      </div>
      {isDone && (
        <div className="mt-3 rounded-xl border border-outline-variant/15 bg-surface-container-lowest/70 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/45">หลักฐานสรุป</p>
          <p className="mt-1 text-xs font-bold leading-snug text-primary">
            {proof || 'ส่งสำเร็จแล้ว ดูประวัติเต็มเพื่อดูรูป/GPS'}
          </p>
        </div>
      )}
      <div className="mt-3">
        <CardActions parcel={parcel} onOpen={onOpen} onConfirm={onConfirm} canConfirm={false} detailLabel="ดูรูป/ประวัติ" compactDetail />
      </div>
    </article>
  );
};

const UserParcelOverviewCard = ({
  parcel,
  timelineEvents,
  onOpen,
  onOpenMap,
}: {
  parcel: Parcel;
  timelineEvents: TimelineEvent[];
  onOpen: () => void;
  onOpenMap: (events: TimelineEvent[]) => void;
}) => {
  const proofEvent = parcel['สถานะ'] === 'ส่งสำเร็จ' ? getDeliveryProofEvent(timelineEvents) : undefined;
  const hasProofImage = Boolean(proofEvent?.imageUrl);
  const hasProofMap = Boolean(
    proofEvent &&
    typeof proofEvent.latitude === 'number' &&
    typeof proofEvent.longitude === 'number'
  );

  return (
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
      {(hasProofImage || hasProofMap) && (
        <div className="mt-3">
          <ActionGroup>
          {hasProofImage && proofEvent?.imageUrl && (
            <ImagePopup
              url={proofEvent.imageUrl}
              title="รูปหลักฐานปลายทาง"
              className="h-10 flex-1 justify-center rounded-xl border border-outline-variant/35 bg-white px-4 py-2 text-xs font-black normal-case tracking-normal text-primary shadow-none transition-all hover:border-primary/35 hover:bg-primary/5 sm:flex-none"
            />
          )}
          {hasProofMap && proofEvent && (
            <DashboardActionButton
              icon="map"
              onClick={() => onOpenMap([proofEvent])}
              variant="primary"
            >
              แผนที่ปลายทาง
            </DashboardActionButton>
          )}
          </ActionGroup>
        </div>
      )}
      <div className="mt-3">
        <CardActions parcel={parcel} onOpen={onOpen} onConfirm={() => undefined} canConfirm={false} detailLabel="ดูรายละเอียด" compactDetail />
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
}) => (
  <article className="rounded-2xl border border-outline-variant/20 bg-white p-3 shadow-sm sm:p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-primary/6 px-2 py-1 font-mono text-xs font-black text-primary">{parcel.TrackingID}</code>
          <StaleBadge parcel={parcel} />
        </div>
        <p className="mt-2 text-base font-black leading-tight text-primary">{parcel['ผู้ส่ง'] || '-'} → {parcel['ผู้รับ'] || '-'}</p>
        <p className="mt-1 text-xs font-semibold text-on-surface-variant/70">{parcel['สาขาผู้ส่ง'] || '-'} → {parcel['สาขาผู้รับ'] || '-'}</p>
      </div>
      <StatusBadge status={parcel['สถานะ']} />
    </div>
    <div className="mt-3">
      <ParcelInfoStrip parcel={parcel} />
    </div>
    {assignment && parcel['สถานะ'] !== 'ส่งสำเร็จ' && (
      <div className="mt-3">
        <AssignmentBadge
          assignment={assignment}
          canRelease
          isReleasing={isReleasingDelivery}
          onRelease={onReleaseDelivery}
        />
      </div>
    )}
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
  const { parcels, summary, loading, loadParcels, hasMore, loadMoreParcels, totalCount, removeParcelLocally, updateParcelLocally } = useParcelStore();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const role = resolveDashboardRole(user?.role);
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
  const [userMapEvents, setUserMapEvents] = useState<TimelineEvent[] | null>(null);
  const [startingDeliveryId, setStartingDeliveryId] = useState<string | null>(null);
  const [releasingDeliveryId, setReleasingDeliveryId] = useState<string | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(120);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const isFetchingRef = useRef(false);
  const isUserDashboard = role === 'USER';
  const canConfirmParcel = role === 'ADMIN' || role === 'MESSENGER';
  const currentEmployeeId = String(user?.employeeId || '').trim().toUpperCase();
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
    () => filteredParcels.filter(parcel => parcel['สถานะ'] !== 'ส่งสำเร็จ').sort(sortMessengerWork),
    [filteredParcels],
  );
  const messengerDoneParcels = useMemo(
    () => filteredParcels.filter(parcel => parcel['สถานะ'] === 'ส่งสำเร็จ'),
    [filteredParcels],
  );
  const adminNeedsAttentionParcels = useMemo(
    () => filteredParcels
      .filter(parcel => parcel['สถานะ'] !== 'ส่งสำเร็จ' || isParcelStale(parcel))
      .sort((a, b) => {
        const staleDiff = Number(isParcelStale(b)) - Number(isParcelStale(a));
        if (staleDiff !== 0) return staleDiff;
        return sortMessengerWork(a, b);
      })
      .slice(0, 6),
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
    setStartingDeliveryId(parcel.TrackingID);
    const res = await startDelivery(parcel.TrackingID);
    setStartingDeliveryId(null);

    if (!res.success) {
      toast.error(res.error || 'ไม่สามารถรับงานได้');
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
    };

    const hasLocalAssignment = Boolean(getActiveDeliveryAssignment(parcel));
    updateParcelLocally(parcel.TrackingID, {
      'สถานะ': 'กำลังจัดส่ง',
      events: res.alreadyStarted && hasLocalAssignment ? parcel.events : [...(parcel.events || []), startEvent],
    });
    toast.success(res.alreadyStarted ? 'งานนี้อยู่ระหว่างจัดส่งแล้ว' : 'รับงานแล้ว เปลี่ยนสถานะเป็นกำลังจัดส่ง');
    loadParcels(undefined, true).catch(() => {});
  };

  const handleReleaseDelivery = async (parcel: Parcel) => {
    if (releasingDeliveryId) return;
    setReleasingDeliveryId(parcel.TrackingID);
    const res = await releaseDelivery(parcel.TrackingID);
    setReleasingDeliveryId(null);

    if (!res.success) {
      toast.error(res.error || 'ไม่สามารถปล่อยงานได้');
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
    toast.success(res.alreadyReleased ? 'งานนี้พร้อมให้รับแล้ว' : 'ปล่อยงานแล้ว งานกลับไปรอจัดส่ง');
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
                  <p className="text-xs font-semibold leading-snug text-on-surface-variant/65">เรียงงานกำลังจัดส่งก่อน แล้วตามด้วยงานเก่าสุด เพื่อให้รู้ว่าควรทำอะไรก่อน</p>
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
      {import.meta.env.DEV && (
        <div className="rounded-xl border border-dashed border-primary/20 bg-primary/[0.03] px-3 py-2 text-xs font-bold text-primary">
          Preview role: {role} ใช้ `?previewRole=MESSENGER`, `USER`, หรือ `ADMIN` เพื่อทดสอบหน้าแต่ละ role
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
          <div className="p-3 sm:p-4">
            <EmptyState
              icon="search_off"
              title="ไม่พบข้อมูลพัสดุ"
              description="ลองปรับคำค้นหาหรือล้างตัวกรอง"
              action={hasFilters && !isMessengerDashboard ? (
                <DashboardActionButton icon="filter_alt_off" onClick={clearFilters} variant="secondary" compact>
                  ล้างตัวกรอง
                </DashboardActionButton>
              ) : undefined}
            />
          </div>
        ) : isMessengerDashboard ? (
          <div className="space-y-5 p-3 sm:p-4">
            <div>
              <RoleSectionHeader
                icon="local_shipping"
                title="ต้องไปส่ง"
                subtitle="งานกำลังจัดส่งมาก่อน ตามด้วยงานที่รอจัดส่งเก่าสุด"
                count={messengerOpenParcels.length}
                tone="amber"
              />
              {messengerOpenParcels.length ? (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {messengerOpenParcels.map(parcel => {
                    const assignment = getActiveDeliveryAssignment(parcel);
                    const isAssignedToMe = Boolean(assignment?.assignedToId && assignment.assignedToId === currentEmployeeId);
                    const canStart = !assignment && parcel['สถานะ'] === 'รอจัดส่ง';
                    const canRelease = Boolean(assignment && isAssignedToMe);
                    const canConfirm = !assignment || isAssignedToMe;
                    return (
                      <MessengerDeliveryCard
                        key={parcel.TrackingID}
                        parcel={parcel}
                        assignment={assignment}
                        canStartDelivery={canStart}
                        canReleaseDelivery={canRelease}
                        canConfirmDelivery={canConfirm}
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
              ) : (
                <EmptyState icon="task_alt" title="ไม่มีงานค้างส่งในตอนนี้" tone="emerald" />
              )}
            </div>

            <div>
              <RoleSectionHeader
                icon="done_all"
                title="ส่งแล้ว"
                subtitle="สรุปหลักฐานและผู้รับจริงของงานที่ปิดแล้ว"
                count={messengerDoneParcels.length}
                tone="emerald"
              />
              {messengerDoneParcels.length ? (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {messengerDoneParcels.map(parcel => (
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
              ) : (
                <EmptyState icon="inventory_2" title="ยังไม่มีงานที่ส่งสำเร็จในรายการนี้" />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-3 sm:p-4">
            {!isUserDashboard && adminNeedsAttentionParcels.length > 0 && (
              <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50/50 p-3 sm:p-4">
                <RoleSectionHeader
                  icon="priority_high"
                  title="ต้องจัดการ"
                  subtitle="งานที่ยังไม่สำเร็จหรือค้างนาน แสดงก่อนเพื่อไม่ต้องไล่หาเอง"
                  count={adminNeedsAttentionParcels.length}
                  tone="amber"
                />
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
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
              </div>
            )}
            {!isUserDashboard && (
              <RoleSectionHeader
                icon="view_agenda"
                title="รายการทั้งหมด"
                subtitle="แสดงตามตัวกรองปัจจุบัน"
                count={paginatedParcels.length}
              />
            )}
            {paginatedParcels.map(parcel => (
              isUserDashboard ? (
                <UserParcelOverviewCard
                  key={parcel.TrackingID}
                  parcel={parcel}
                  timelineEvents={getTimelineEvents(parcel)}
                  onOpen={() => { setSelectedParcel(parcel); setIsTimelineOpen(true); }}
                  onOpenMap={setUserMapEvents}
                />
              ) : (
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

      {userMapEvents && (
      <Dialog open={Boolean(userMapEvents)} onOpenChange={(open) => { if (!open) setUserMapEvents(null); }}>
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100vw-1rem)] max-w-3xl overflow-hidden rounded-3xl border-none bg-transparent p-0 shadow-2xl"
        >
          <div className="bg-transparent p-2 sm:p-3">
            <div className="relative">
              <div className="pointer-events-none absolute bottom-12 left-3 z-[500] inline-flex items-center gap-2 rounded-2xl bg-primary/90 px-3 py-2 text-white shadow-lg backdrop-blur-sm sm:bottom-auto sm:left-4 sm:top-4">
                <span className="material-symbols-outlined text-lg text-secondary">flag</span>
                <span className="text-sm font-black">แผนที่ปลายทาง</span>
              </div>
              <button
                type="button"
                onClick={() => setUserMapEvents(null)}
                className="absolute right-3 top-3 z-[500] grid h-11 w-11 place-items-center rounded-2xl bg-white text-primary shadow-lg shadow-black/20 transition-all hover:bg-secondary active:scale-95"
                aria-label="ปิดแผนที่ปลายทาง"
              >
                <span className="material-symbols-outlined text-2xl font-black">close</span>
              </button>
              <Suspense fallback={<LazyPanelFallback label="กำลังโหลดแผนที่..." />}>
                <TrackingMap
                  events={userMapEvents || []}
                  className="h-[62vh] max-h-[560px] min-h-[340px] rounded-2xl"
                  mapClassName="min-h-0"
                />
              </Suspense>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
            <Suspense fallback={<LazyPanelFallback label="กำลังโหลดหน้าบันทึกผล..." />}>
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

      {/* ── User Quick Create Dialog ── */}
      {isCreateFlowOpen && (
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
            <Suspense fallback={<LazyPanelFallback label="กำลังโหลดฟอร์มส่งพัสดุ..." />}>
              <CreateParcel embedded />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* ── User Quick Track Dialog ── */}
      {isTrackFlowOpen && (
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
            <Suspense fallback={<LazyPanelFallback label="กำลังโหลดหน้าติดตาม..." />}>
              <Track embedded />
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
