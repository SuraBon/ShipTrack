import {
  MESSENGER_BATCH_SIZE,
  DashboardIcon,
  MessengerViewBanner,
  type MessengerView,
} from '@/components/dashboard/DashboardComponents';
import EmptyState from '@/components/EmptyState';
import { MessengerDeliveryCard } from '@/components/dashboard/MessengerDeliveryCard';
import type { Parcel } from '@/types/parcel';
import { Loader2, PackageCheck } from 'lucide-react';
import {
  isAvailableForMessenger,
  getActiveDeliveryAssignment,
  canReleaseMessengerJob,
  canConfirmMessengerJob,
} from '@/lib/deliveryAssignment';

interface MessengerDashboardViewProps {
  messengerView: MessengerView;
  setMessengerView: (val: MessengerView) => void;
  messengerWaitingParcels: Parcel[];
  messengerMineParcels: Parcel[];
  messengerDoneParcels: Parcel[];
  visibleMessengerWaitingParcels: Parcel[];
  visibleMessengerMineParcels: Parcel[];
  visibleMessengerDoneParcels: Parcel[];
  messengerVisibleCounts: Record<MessengerView, number>;
  showMoreMessenger: (view: MessengerView) => void;
  selectedMessengerParcelIds: Set<string>;
  toggleSelectedMessengerParcel: (trackingId: string, checked: boolean) => void;
  clearSelectedMessengerParcels: () => void;
  messengerBatchMode: 'start' | 'confirm' | null;
  messengerBatchActionCount: number;
  isBatchStarting: boolean;
  handleBatchStartDelivery: () => void;
  setIsBatchConfirmOpen: (val: boolean) => void;
  setSelectedParcel: (parcel: Parcel) => void;
  setIsDeliveryDetailsOpen: (val: boolean) => void;
  setIsTimelineOpen: (val: boolean) => void;
  openConfirmFlow: (trackingId: string) => void;
  handleStartDelivery: (parcel: Parcel) => void;
  handleReleaseDelivery: (parcel: Parcel) => void;
  startingDeliveryId: string | null;
  releasingDeliveryId: string | null;
  currentEmployeeId: string;
  role: string;
}

export function MessengerDashboardView({
  messengerView,
  setMessengerView,
  messengerWaitingParcels,
  messengerMineParcels,
  messengerDoneParcels,
  visibleMessengerWaitingParcels,
  visibleMessengerMineParcels,
  visibleMessengerDoneParcels,
  messengerVisibleCounts,
  showMoreMessenger,
  selectedMessengerParcelIds,
  toggleSelectedMessengerParcel,
  clearSelectedMessengerParcels,
  messengerBatchMode,
  messengerBatchActionCount,
  isBatchStarting,
  handleBatchStartDelivery,
  setIsBatchConfirmOpen,
  setSelectedParcel,
  setIsDeliveryDetailsOpen,
  setIsTimelineOpen,
  openConfirmFlow,
  handleStartDelivery,
  handleReleaseDelivery,
  startingDeliveryId,
  releasingDeliveryId,
  currentEmployeeId,
  role,
}: MessengerDashboardViewProps) {
  return (
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
            title="งานรอรับ"
            subtitle="งานที่ไม่มีคนรับ กดรับเพื่อเริ่มส่ง"
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
            subtitle="งานที่กำลังส่ง กดยืนยันส่งเมื่อส่งเสร็จ"
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
            title="ส่งสำเร็จ"
            subtitle="ประวัติงานที่ยืนยันส่งแล้ว"
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
            <EmptyState icon="history" title="ยังไม่มีประวัติการส่งสำเร็จ" description="ประวัติงานที่ยืนยันส่งแล้วจะแสดงที่นี่" />
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
  );
}
