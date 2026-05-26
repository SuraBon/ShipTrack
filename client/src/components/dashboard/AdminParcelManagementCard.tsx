import { useState } from 'react';
import { Package } from 'lucide-react';
import type { Parcel } from '@/types/parcel';
import type { DeliveryAssignment } from '@/lib/deliveryAssignment';
import StatusBadge from '@/components/StatusBadge';
import { formatThaiDateTime } from '@/lib/dateUtils';
import { translateSystemNote } from '@/lib/translationUtils';
import {
  AssignmentBadge,
  CardActions,
  MessengerRouteSummary,
  StaleBadge,
  getCleanNote,
  getLatestTimelineSummary,
} from './DashboardComponents';

export const AdminParcelManagementCard = ({
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
  const itemDescription = parcel['รายละเอียด'] || '';
  const [isAdminNoteExpanded, setIsAdminNoteExpanded] = useState(false);
  const [isAdminItemDescriptionExpanded, setIsAdminItemDescriptionExpanded] = useState(false);
  const translatedNote = translateSystemNote(note);
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

  const renderMaterialIcon = (name: string, className = '') => {
    return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>;
  };

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
                {renderMaterialIcon(iconName, 'text-base')}
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
            {(itemDescription || note) && (
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => itemDescription && setIsAdminItemDescriptionExpanded(!isAdminItemDescriptionExpanded)}
                  className={`flex min-w-0 items-start gap-2.5 rounded-lg bg-slate-50 px-2.5 py-2 transition-all ${itemDescription ? 'cursor-pointer hover:bg-slate-100' : 'opacity-40'}`}
                >
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold leading-none text-slate-500">สิ่งที่ส่ง</p>
                      {itemDescription.length > 25 && (
                        <span className="shrink-0 text-[8px] font-bold uppercase text-slate-500">{isAdminItemDescriptionExpanded ? 'ย่อ' : 'ดูเพิ่ม'}</span>
                      )}
                    </div>
                    <p className={`mt-1 min-w-0 text-xs font-semibold leading-relaxed text-slate-800 ${isAdminItemDescriptionExpanded ? 'break-words whitespace-pre-wrap' : 'truncate'}`}>
                      {itemDescription || '-'}
                    </p>
                  </div>
                </div>

                <div 
                  onClick={() => note && setIsAdminNoteExpanded(!isAdminNoteExpanded)}
                  className={`flex min-w-0 items-start gap-2.5 rounded-lg bg-orange-50/70 px-2.5 py-2 transition-all ${note ? 'cursor-pointer hover:bg-orange-100/70' : 'opacity-40'}`}
                >
                  {renderMaterialIcon('sticky_note_2', 'mt-0.5 text-orange-500 text-base leading-none')}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold leading-none text-orange-600">หมายเหตุ</p>
                      {translatedNote.length > 25 && (
                        <span className="text-[8px] text-orange-600 font-bold uppercase">{isAdminNoteExpanded ? 'ย่อ' : 'ดูเพิ่ม'}</span>
                      )}
                    </div>
                    <p className={`mt-1 min-w-0 text-xs font-semibold leading-relaxed text-slate-800 ${isAdminNoteExpanded ? 'break-words' : 'truncate'}`}>
                      {translatedNote || '-'}
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
            {renderMaterialIcon('schedule', 'text-[14px]')}
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
