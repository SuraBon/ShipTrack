import { useState } from 'react';
import { Package } from 'lucide-react';
import type { Parcel } from '@/types/parcel';
import type { DeliveryAssignment } from '@/lib/deliveryAssignment';
import StatusBadge from '@/components/StatusBadge';
import ImagePopup from '@/components/ImagePopup';
import { Checkbox } from '@/components/ui/checkbox';
import { translateSystemNote } from '@/lib/translationUtils';
import {
  DashboardActionButton,
  AssignmentBadge,
  MessengerRouteSummary,
  StaleBadge,
  CardActions,
  getCleanNote,
  getPreferredParcelImage,
  isParcelStale,
} from './DashboardComponents';

export const MessengerDeliveryCard = ({
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
  selected,
  onSelectedChange,
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
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
}) => {
  const note = getCleanNote(parcel);
  const itemDescription = parcel['รายละเอียด'] || '';
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [isItemDescriptionExpanded, setIsItemDescriptionExpanded] = useState(false);
  const translatedNote = translateSystemNote(note);
  const isDone = parcel['สถานะ'] === 'ส่งสำเร็จ';
  const isAssignedElsewhere = Boolean(assignment && !canConfirmDelivery && !isDone);
  const proofImageUrl = getPreferredParcelImage(parcel);
  const actionLabel = canStartDelivery
    ? (isStartingDelivery ? 'กำลังรับงาน' : 'รับงาน')
    : canConfirmDelivery
      ? 'ยืนยันส่ง'
      : '';

  let cardStyles = 'border-outline-variant bg-card shadow-[3px_3px_0px_0px_var(--outline-variant)]';
  let iconName = 'person';
  let accentClass = 'bg-surface-container text-on-surface-variant';
  let statusLabel = 'รอดำเนินการ';
  let statusPillClass = 'bg-surface-container text-on-surface-variant border border-outline-variant';

  if (isDone) {
    cardStyles = 'border-outline-variant bg-card shadow-[3px_3px_0px_0px_var(--outline-variant)]';
    iconName = 'check_circle';
    accentClass = 'bg-emerald-100 text-emerald-950 dark:bg-emerald-900/30 dark:text-emerald-300';
    statusLabel = 'ส่งแล้ว';
    statusPillClass = 'bg-emerald-100 text-emerald-950 dark:bg-emerald-900/30 dark:text-emerald-300 border border-outline-variant';
  } else if (canConfirmDelivery) {
    cardStyles = 'border-outline-variant bg-card shadow-[3px_3px_0px_0px_var(--outline-variant)]';
    iconName = 'local_shipping';
    accentClass = 'bg-blue-100 text-blue-950 dark:bg-blue-900/30 dark:text-blue-300';
    statusLabel = 'กำลังส่ง';
    statusPillClass = 'bg-blue-100 text-blue-950 dark:bg-blue-900/30 dark:text-blue-300 border border-outline-variant';
  } else if (canStartDelivery) {
    iconName = 'inventory_2';
    accentClass = 'bg-amber-100 text-amber-950 dark:bg-amber-900/30 dark:text-amber-300';
    statusLabel = 'งานใหม่';
    statusPillClass = 'bg-amber-100 text-amber-950 dark:bg-amber-900/30 dark:text-amber-300 border border-outline-variant';
  } else if (isAssignedElsewhere) {
    iconName = 'person';
    statusLabel = 'มีผู้รับงานแล้ว';
    statusPillClass = 'bg-surface-container text-on-surface-variant border border-outline-variant';
  }

  const dateLabel = parcel['วันที่รับ']
    ? new Date(parcel['วันที่รับ']).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
    : 'เพิ่งเมื่อสักครู่';

  // Helper mapping string icon name to class/render (since raw material icons might be fallback)
  const renderMaterialIcon = (name: string, className = '') => {
    return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>;
  };

  return (
    <article className={`flex h-full flex-col overflow-hidden rounded-sm border-2 border-outline-variant bg-card transition-all duration-150 ${cardStyles}`}>
      <div className="flex items-center justify-between gap-3 border-b-2 border-outline-variant bg-slate-50 dark:bg-surface-container px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {onSelectedChange && (
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelectedChange(checked === true)}
              aria-label={`เลือก ${parcel.TrackingID}`}
              className="size-5 rounded-sm border-2 border-outline-variant"
            />
          )}
          <code className="min-w-0 truncate font-mono text-[10px] font-black tracking-wider text-muted-foreground">
            {parcel.TrackingID}
          </code>
        </div>
        <span className={`shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-semibold ${statusPillClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-sm border-2 border-outline-variant ${accentClass}`}>
                {iconName === 'check_circle' ? (
                  renderMaterialIcon('check_circle', 'text-xl')
                ) : iconName === 'local_shipping' ? (
                  renderMaterialIcon('local_shipping', 'text-xl')
                ) : iconName === 'inventory_2' ? (
                  renderMaterialIcon('inventory_2', 'text-xl')
                ) : (
                  renderMaterialIcon('person', 'text-xl')
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black leading-none text-muted-foreground">ผู้รับ</p>
                <h3 className="mt-1 truncate text-base font-black leading-tight text-foreground">
                  {parcel['ผู้รับ'] || '-'}
                </h3>
              </div>
            </div>

            {!isDone && (canStartDelivery || canConfirmDelivery) && (
              <DashboardActionButton
                icon={canStartDelivery ? 'assignment_turned_in' : 'package_check'}
                onClick={canStartDelivery ? onStartDelivery : onConfirm}
                loading={canStartDelivery ? isStartingDelivery : false}
                variant="blue"
                compact
                className="h-10 flex-none rounded-sm px-4 text-xs font-black"
              >
                {actionLabel}
              </DashboardActionButton>
            )}
          </div>

          {assignment && !isDone && isAssignedElsewhere && (
            <AssignmentBadge assignment={assignment} />
          )}

          <MessengerRouteSummary parcel={parcel} />

          {(itemDescription || note || isParcelStale(parcel)) && (
            <div className="space-y-2">
              {(itemDescription || note) && (
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  <div
                    onClick={() => itemDescription && setIsItemDescriptionExpanded(!isItemDescriptionExpanded)}
                    className={`flex min-w-0 items-start gap-2.5 rounded-sm border-2 border-outline-variant bg-slate-50 dark:bg-surface-container px-2.5 py-2 transition-all ${itemDescription ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-surface-container-high' : 'opacity-40'}`}
                  >
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black leading-none text-muted-foreground">สิ่งที่ส่ง</p>
                        {itemDescription.length > 25 && (
                          <span className="shrink-0 text-[8px] font-black uppercase text-muted-foreground">{isItemDescriptionExpanded ? 'ย่อ' : 'ดูเพิ่ม'}</span>
                        )}
                      </div>
                      <p className={`mt-1 min-w-0 text-xs font-semibold leading-relaxed text-foreground ${isItemDescriptionExpanded ? 'break-words whitespace-pre-wrap' : 'line-clamp-3 md:line-clamp-none'}`}>
                        {itemDescription || '-'}
                      </p>
                    </div>
                  </div>

                  <div 
                    onClick={() => note && setIsNoteExpanded(!isNoteExpanded)}
                    className={`flex min-w-0 items-start gap-2.5 rounded-sm border-2 border-outline-variant bg-orange-50/70 dark:bg-amber-900/15 px-2.5 py-2 transition-all ${note ? 'cursor-pointer hover:bg-orange-100/70 dark:hover:bg-amber-900/25' : 'opacity-40'}`}
                  >
                    {renderMaterialIcon('sticky_note_2', 'mt-0.5 text-orange-500 dark:text-amber-400 text-base leading-none')}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black leading-none text-orange-600 dark:text-amber-400">หมายเหตุ</p>
                        {translatedNote.length > 25 && (
                          <span className="text-[8px] text-orange-600 dark:text-amber-400 font-black uppercase">{isNoteExpanded ? 'ย่อ' : 'ดูเพิ่ม'}</span>
                        )}
                      </div>
                      <p className={`mt-1 min-w-0 text-xs font-semibold leading-relaxed text-slate-850 dark:text-foreground ${isNoteExpanded ? 'break-words' : 'line-clamp-3 md:line-clamp-none'}`}>
                        {translatedNote || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <StaleBadge parcel={parcel} />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t-2 border-outline-variant pt-3">
          <div className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground/60">
            {renderMaterialIcon('schedule', 'text-[14px]')}
            <span className="truncate">{dateLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {proofImageUrl && (
              <ImagePopup
                url={proofImageUrl}
                title="รูปหลักฐาน"
                triggerVariant="icon"
                className="h-9 w-9 rounded-sm bg-slate-50 dark:bg-surface-container text-slate-600 dark:text-muted-foreground border-2 border-outline-variant hover:bg-secondary/15 hover:text-secondary shadow-[1px_1px_0px_0px_var(--outline-variant)]"
              />
            )}
            {canReleaseDelivery && (
              <DashboardActionButton
                icon="undo"
                onClick={onReleaseDelivery}
                loading={isReleasingDelivery}
                variant="warning"
                compact
                className="h-8 flex-none rounded-sm px-2.5 text-[11px]"
              >
                {isReleasingDelivery ? 'กำลังคืน' : 'คืนงาน'}
              </DashboardActionButton>
            )}
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600 dark:text-blue-400 transition-colors hover:text-blue-800"
            >
              {isDone ? 'ดูประวัติส่ง' : 'ดูรายละเอียด'}
              {renderMaterialIcon(isDone ? 'timeline' : 'chevron_right', 'text-[13px]')}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
