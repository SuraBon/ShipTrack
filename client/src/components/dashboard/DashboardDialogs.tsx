import { lazy, Suspense, type Dispatch, type SetStateAction } from 'react';
import type { Parcel } from '@/types/parcel';
import type { TimelineEvent } from '@/types/timeline';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { LazyPanelFallback } from './DashboardComponents';
import { DeliveryJobDetailsModal } from './DeliveryJobDetailsModal';
import { AdminEditParcelDialog } from './AdminEditParcelDialog';
import { BatchConfirmDeliveryDialog } from './BatchConfirmDeliveryDialog';

const ParcelTimelineModal = lazy(() => import('@/components/ParcelTimelineModal'));
const ConfirmReceipt = lazy(() => import('@/pages/ConfirmReceipt'));

type DashboardDialogsProps = {
  selectedParcel: Parcel | null;
  isDeliveryDetailsOpen: boolean;
  setIsDeliveryDetailsOpen: Dispatch<SetStateAction<boolean>>;
  isTimelineOpen: boolean;
  setIsTimelineOpen: Dispatch<SetStateAction<boolean>>;
  selectedTimelineEvents: TimelineEvent[];
  selectedParcelHasKnownBranches: boolean;
  openConfirmFlow: (trackingId: string) => void;
  handleDelete: () => void;
  isConfirmFlowOpen: boolean;
  setIsConfirmFlowOpen: Dispatch<SetStateAction<boolean>>;
  confirmTrackingId: string | null;
  setConfirmTrackingId: Dispatch<SetStateAction<string | null>>;
  isDeleteConfirmOpen: boolean;
  setIsDeleteConfirmOpen: Dispatch<SetStateAction<boolean>>;
  executeDelete: () => void;
  isEditParcelOpen: boolean;
  setIsEditParcelOpen: Dispatch<SetStateAction<boolean>>;
  isSavingParcelEdit: boolean;
  submitParcelEdit: (updates: Partial<Record<string, string>>) => Promise<void>;
  isBatchConfirmOpen: boolean;
  setIsBatchConfirmOpen: Dispatch<SetStateAction<boolean>>;
  batchConfirmParcels: Parcel[];
  isBatchConfirming: boolean;
  submitBatchConfirm: (input: {
    photoUrl: string;
    note: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<boolean>;
};

export function DashboardDialogs({
  selectedParcel,
  isDeliveryDetailsOpen,
  setIsDeliveryDetailsOpen,
  isTimelineOpen,
  setIsTimelineOpen,
  selectedTimelineEvents,
  selectedParcelHasKnownBranches,
  openConfirmFlow,
  handleDelete,
  isConfirmFlowOpen,
  setIsConfirmFlowOpen,
  confirmTrackingId,
  setConfirmTrackingId,
  isDeleteConfirmOpen,
  setIsDeleteConfirmOpen,
  executeDelete,
  isEditParcelOpen,
  setIsEditParcelOpen,
  isSavingParcelEdit,
  submitParcelEdit,
  isBatchConfirmOpen,
  setIsBatchConfirmOpen,
  batchConfirmParcels,
  isBatchConfirming,
  submitBatchConfirm,
}: DashboardDialogsProps) {
  return (
    <>
      <BatchConfirmDeliveryDialog
        open={isBatchConfirmOpen}
        parcels={batchConfirmParcels}
        submitting={isBatchConfirming}
        onOpenChange={setIsBatchConfirmOpen}
        onSubmit={submitBatchConfirm}
      />

      <AdminEditParcelDialog
        parcel={selectedParcel}
        open={isEditParcelOpen}
        saving={isSavingParcelEdit}
        onOpenChange={setIsEditParcelOpen}
        onSubmit={submitParcelEdit}
      />

      <DeliveryJobDetailsModal
        parcel={selectedParcel}
        open={isDeliveryDetailsOpen}
        onOpenChange={setIsDeliveryDetailsOpen}
      />

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
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(92dvh,100vh)] w-[calc(100vw-0.75rem)] max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-0 shadow-2xl sm:w-[calc(100vw-1rem)] sm:rounded-[1.75rem]"
        >
          <DialogTitle className="sr-only">ยืนยันการส่ง</DialogTitle>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Suspense fallback={<LazyPanelFallback label="กำลังโหลดหน้ายืนยันการจัดส่ง..." />}>
              <ConfirmReceipt
                key={confirmTrackingId ?? 'confirm-flow'}
                initialTrackingId={confirmTrackingId}
                onInitialTrackingIdConsumed={() => undefined}
                autoCheckInitial
                autoOpenCamera
                embedded
                onClose={() => setIsConfirmFlowOpen(false)}
                onComplete={() => {
                  setIsConfirmFlowOpen(false);
                  setConfirmTrackingId(null);
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
    </>
  );
}

export default DashboardDialogs;
