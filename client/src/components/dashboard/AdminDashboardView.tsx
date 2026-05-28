import { Suspense } from 'react';
import {
  TableSkeleton,
  MessengerViewBanner,
} from '@/components/dashboard/DashboardComponents';
import EmptyState from '@/components/EmptyState';
import type { Parcel } from '@/types/parcel';
import { getActiveDeliveryAssignment } from '@/lib/deliveryAssignment';
import { PackageCheck, Trash2, Loader2 } from 'lucide-react';
import { AdminParcelManagementCard } from './AdminParcelManagementCard';
import AdminParcelManagementTable from './AdminParcelManagementTable';

interface AdminDashboardViewProps {
  selectedAdminParcelIds: Set<string>;
  batchConfirmParcels: Parcel[];
  clearSelectedAdminParcels: () => void;
  setIsBatchConfirmOpen: (val: boolean) => void;
  handleBatchDelete: () => void;
  isBatchDeleting: boolean;
  adminTotalCount: number;
  filteredParcels: Parcel[];
  parcels: Parcel[];
  paginatedParcels: Parcel[];
  setSelectedParcel: (parcel: Parcel) => void;
  setIsTimelineOpen: (val: boolean) => void;
  openEditParcel: (parcel: Parcel) => void;
  openConfirmFlow: (trackingId: string) => void;
  setIsDeleteConfirmOpen: (val: boolean) => void;
  handleReleaseDelivery: (parcel: Parcel) => void;
  releasingDeliveryId: string | null;
  toggleSelectedAdminParcel: (trackingId: string, checked: boolean) => void;
  toggleAllVisibleAdminParcels: (checked: boolean) => void;
  adminNeedsAttentionParcels: Parcel[];
  adminRegularParcels: Parcel[];
  startIndex: number;
  endIndex: number;
  currentPage: number;
  setCurrentPage: (val: number | ((prev: number) => number)) => void;
  totalPages: number;
  loadMoreParcels: () => void;
  loading: boolean;
  hasMore: boolean;
  hasFilters: boolean;
  clearFilters: () => void;
}

export function AdminDashboardView({
  selectedAdminParcelIds,
  batchConfirmParcels,
  clearSelectedAdminParcels,
  setIsBatchConfirmOpen,
  handleBatchDelete,
  isBatchDeleting,
  adminTotalCount,
  filteredParcels,
  parcels,
  paginatedParcels,
  setSelectedParcel,
  setIsTimelineOpen,
  openEditParcel,
  openConfirmFlow,
  setIsDeleteConfirmOpen,
  handleReleaseDelivery,
  releasingDeliveryId,
  toggleSelectedAdminParcel,
  toggleAllVisibleAdminParcels,
  adminNeedsAttentionParcels,
  adminRegularParcels,
  startIndex,
  endIndex,
  currentPage,
  setCurrentPage,
  totalPages,
  loadMoreParcels,
  loading,
  hasMore,
  hasFilters,
  clearFilters,
}: AdminDashboardViewProps) {
  return (
    <>
      {hasFilters ? (
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
                    onSelectedChange={(checked: boolean) => toggleSelectedAdminParcel(parcel.TrackingID, checked)}
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
                onToggleAllVisible={(_parcels: Parcel[], checked: boolean) => toggleAllVisibleAdminParcels(checked)}
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
                      onSelectedChange={(checked: boolean) => toggleSelectedAdminParcel(parcel.TrackingID, checked)}
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
                  onToggleAllVisible={(_parcels: Parcel[], checked: boolean) => toggleAllVisibleAdminParcels(checked)}
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
                    onSelectedChange={(checked: boolean) => toggleSelectedAdminParcel(parcel.TrackingID, checked)}
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
                onToggleAllVisible={(_parcels: Parcel[], checked: boolean) => toggleAllVisibleAdminParcels(checked)}
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

      {filteredParcels.length > 0 && (
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
    </>
  );
}
