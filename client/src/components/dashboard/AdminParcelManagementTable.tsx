import { useState } from 'react';
import { ClipboardList, PackageCheck, Undo2, Trash2, Loader2 } from 'lucide-react';
import type { Parcel } from '@/types/parcel';
import StatusBadge from '@/components/StatusBadge';
import { formatThaiDateTime } from '@/lib/dateUtils';
import { translateSystemNote } from '@/lib/translationUtils';
import { getActiveDeliveryAssignment } from '@/lib/deliveryAssignment';
import {
  getCleanNote,
  getLatestTimelineSummary,
  isParcelStale,
} from './DashboardComponents';

export const AdminParcelManagementTable = ({
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
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  return (
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
                      {(() => {
                        const textToShow = parcel['รายละเอียด'] || translateSystemNote(getCleanNote(parcel)) || '-';
                        const isExpanded = expandedIds.has(parcel.TrackingID);
                        const isLong = textToShow.length > 30;
                        return (
                          <div 
                            onClick={() => isLong && toggleExpand(parcel.TrackingID)}
                            className={`mt-1 text-xs text-muted-foreground transition-all ${isLong ? 'cursor-pointer hover:text-slate-800' : ''}`}
                          >
                            <p className={`${isExpanded ? 'break-words whitespace-pre-wrap leading-relaxed' : 'truncate'}`}>
                              {textToShow}
                            </p>
                            {isLong && (
                              <span className="text-[9px] font-bold text-primary/70 hover:text-primary mt-0.5 block leading-none">
                                {isExpanded ? 'ย่อรายละเอียด' : 'ดูรายละเอียดเพิ่ม'}
                              </span>
                            )}
                          </div>
                        );
                      })()}
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
                        <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                        รายละเอียด
                      </button>
                      {!isDone && (
                        <button type="button" onClick={() => onConfirm(parcel)} className="app-primary-button h-9 px-2.5 text-xs">
                          <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
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
};
export default AdminParcelManagementTable;
