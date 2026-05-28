import { useState } from 'react';
import { useParcelStore } from '@/hooks/useParcelStore';
import { useAuth } from '@/contexts/AuthContext';
import { batchConfirmReceipt, batchStartDelivery, deleteParcel, editParcel, releaseDelivery, startDelivery, syncRouteSamples } from '@/lib/parcelService';
import { startRouteTracking, stopRouteTracking } from '@/lib/routeTracking';
import { getActiveDeliveryAssignment, buildAssignmentNote } from '@/lib/deliveryAssignment';
import type { Parcel } from '@/types/parcel';
import { toast } from 'sonner';

import { GeoPosition, GeoStatus } from '@/hooks/useGeolocation';

export type MessengerView = 'waiting' | 'mine' | 'done';
export type DashboardBatchResult = {
  success: boolean;
  queued?: boolean;
  successCount: number;
  failedCount: number;
  failedIds: string[];
};

export function useDashboardActions({
  messengerPosition,
  messengerGeoStatus,
  requestMessengerLocation,
  fetchData,
  loading,
}: {
  messengerPosition: GeoPosition | null;
  messengerGeoStatus: GeoStatus;
  requestMessengerLocation: () => void;
  fetchData: () => Promise<void>;
  loading: boolean;
}) {
  const { user } = useAuth();
  const { removeParcelLocally, updateParcelLocally, loadParcels } = useParcelStore();

  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isDeliveryDetailsOpen, setIsDeliveryDetailsOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isEditParcelOpen, setIsEditParcelOpen] = useState(false);
  const [isSavingParcelEdit, setIsSavingParcelEdit] = useState(false);
  const [confirmTrackingId, setConfirmTrackingId] = useState<string | null>(null);
  const [isConfirmFlowOpen, setIsConfirmFlowOpen] = useState(false);
  const [messengerView, setMessengerView] = useState<MessengerView>('mine');
  const [startingDeliveryId, setStartingDeliveryId] = useState<string | null>(null);
  const [releasingDeliveryId, setReleasingDeliveryId] = useState<string | null>(null);

  const currentEmployeeId = String(user?.employeeId || '').trim().toUpperCase();

  const handleRefresh = async () => {
    if (loading) return;
    await fetchData();
    toast.success('อัปเดตข้อมูลเรียบร้อยแล้ว');
  };

  const handleDelete = async () => {
    if (!selectedParcel) return;
    setIsDeleteConfirmOpen(true);
  };

  const openEditParcel = (parcel: Parcel) => {
    setSelectedParcel(parcel);
    setIsTimelineOpen(false);
    setIsDeliveryDetailsOpen(false);
    setIsEditParcelOpen(true);
  };

  const submitParcelEdit = async (updates: Partial<Record<string, string>>) => {
    if (!selectedParcel || isSavingParcelEdit) return;
    setIsSavingParcelEdit(true);
    const res = await editParcel(selectedParcel.TrackingID, updates);
    setIsSavingParcelEdit(false);

    if (!res.success) {
      toast.error(res.error || 'บันทึกข้อมูลพัสดุไม่สำเร็จ');
      return;
    }

    const currentParcel = (selectedParcel as unknown) as Record<string, unknown>;
    const localUpdates = {
      'ผู้ส่ง': updates.senderName || currentParcel['ผู้ส่ง'],
      'สาขาผู้ส่ง': updates.senderBranch || currentParcel['สาขาผู้ส่ง'],
      'ผู้รับ': updates.receiverName || currentParcel['ผู้รับ'],
      'สาขาผู้รับ': updates.receiverBranch || currentParcel['สาขาผู้รับ'],
      'รายละเอียด': updates.description ?? currentParcel['รายละเอียด'],
    } as Partial<Parcel>;
    updateParcelLocally(selectedParcel.TrackingID, localUpdates);
    setSelectedParcel(current => current ? { ...current, ...localUpdates } : current);
    setIsEditParcelOpen(false);
    toast.success('บันทึกข้อมูลพัสดุเรียบร้อยแล้ว');
  };

  const executeBatchDelete = async (trackingIds: string[]) => {
    const uniqueIds = Array.from(new Set(trackingIds)).filter(Boolean);
    if (uniqueIds.length === 0) return { successCount: 0, failedCount: 0 };

    uniqueIds.forEach(removeParcelLocally);
    toast.success(`กำลังลบรายการ ${uniqueIds.length} รายการ...`);

    const results = await Promise.all(uniqueIds.map(async trackingID => {
      const res = await deleteParcel(trackingID);
      return { trackingID, res };
    }));
    const failed = results.filter(result => !result.res.success);

    if (failed.length > 0) {
      toast.error(`ไม่สามารถลบรายการได้จำนวน ${failed.length} รายการ ระบบกำลังโหลดข้อมูลใหม่`);
      loadParcels(undefined, true);
    } else {
      toast.success(`ลบรายการทั้งหมด ${uniqueIds.length} รายการเสร็จสิ้น`);
    }

    return { successCount: uniqueIds.length - failed.length, failedCount: failed.length };
  };

  const executeBatchStartDelivery = async (
    parcelsToStart: Parcel[],
    latitude?: number,
    longitude?: number,
  ): Promise<DashboardBatchResult> => {
    const trackingIds = Array.from(new Set(parcelsToStart.map(parcel => parcel.TrackingID))).filter(Boolean);
    if (trackingIds.length === 0) return { success: false, successCount: 0, failedCount: 0, failedIds: [] };
    const toastId = toast.loading(`กำลังรับงาน ${trackingIds.length} รายการ...`);
    const res = await batchStartDelivery(trackingIds, latitude, longitude);
    if (res.queued) {
      toast.info(`บันทึกรับงาน ${trackingIds.length} รายการในคิวออฟไลน์แล้ว`, { id: toastId });
      return { success: true, queued: true, successCount: trackingIds.length, failedCount: 0, failedIds: [] };
    }
    if (!res.success) {
      toast.error(res.error || 'รับงานพร้อมกันไม่สำเร็จ', { id: toastId });
      return { success: false, successCount: 0, failedCount: trackingIds.length, failedIds: trackingIds };
    }
    const results = res.results || [];
    const successIds = new Set(results.length ? results.filter(item => item.success).map(item => item.trackingID) : trackingIds);
    const failedIds = results.filter(item => !item.success).map(item => item.trackingID);
    parcelsToStart.forEach(parcel => {
      if (successIds.has(parcel.TrackingID)) {
        updateParcelLocally(parcel.TrackingID, { 'สถานะ': 'กำลังจัดส่ง' });
        startRouteTracking(parcel.TrackingID);
      }
    });
    const successCount = res.successCount ?? successIds.size;
    const failedCount = res.failedCount ?? failedIds.length;
    toast.success(`รับงานสำเร็จ ${successCount} รายการ${failedCount ? ` (ล้มเหลว ${failedCount})` : ''}`, { id: toastId });
    loadParcels(undefined, true).catch(() => {});
    setMessengerView('mine');
    return { success: successCount > 0, successCount, failedCount, failedIds };
  };

  const executeBatchConfirmDelivery = async (
    parcelsToConfirm: Parcel[],
    photoUrl: string,
    note?: string,
    latitude?: number,
    longitude?: number,
  ): Promise<DashboardBatchResult> => {
    const trackingIds = Array.from(new Set(parcelsToConfirm.map(parcel => parcel.TrackingID))).filter(Boolean);
    if (trackingIds.length === 0) return { success: false, successCount: 0, failedCount: 0, failedIds: [] };
    const toastId = toast.loading(`กำลังยืนยันส่ง ${trackingIds.length} รายการ...`);
    const res = await batchConfirmReceipt(trackingIds, photoUrl, note, latitude, longitude);
    if (res.queued) {
      toast.info(`บันทึกยืนยันส่ง ${trackingIds.length} รายการในคิวออฟไลน์แล้ว`, { id: toastId });
      return { success: true, queued: true, successCount: trackingIds.length, failedCount: 0, failedIds: [] };
    }
    if (!res.success) {
      toast.error(res.error || 'ยืนยันส่งพร้อมกันไม่สำเร็จ', { id: toastId });
      return { success: false, successCount: 0, failedCount: trackingIds.length, failedIds: trackingIds };
    }
    const results = res.results || [];
    const successIds = new Set(results.length ? results.filter(item => item.success).map(item => item.trackingID) : trackingIds);
    const failedIds = results.filter(item => !item.success).map(item => item.trackingID);
    parcelsToConfirm.forEach(parcel => {
      if (successIds.has(parcel.TrackingID)) {
        updateParcelLocally(parcel.TrackingID, { 'สถานะ': 'ส่งสำเร็จ', 'รูปยืนยัน': res.sharedPhotoUrl });
        stopRouteTracking(parcel.TrackingID);
        void syncRouteSamples(parcel.TrackingID);
      }
    });
    const successCount = res.successCount ?? successIds.size;
    const failedCount = res.failedCount ?? failedIds.length;
    toast.success(`ยืนยันส่งสำเร็จ ${successCount} รายการ${failedCount ? ` (ล้มเหลว ${failedCount})` : ''}`, { id: toastId });
    loadParcels(undefined, true).catch(() => {});
    return { success: successCount > 0, successCount, failedCount, failedIds };
  };

  const openConfirmFlow = (trackingId: string) => {
    setIsTimelineOpen(false);
    setIsDeliveryDetailsOpen(false);
    setConfirmTrackingId(trackingId);
    setIsConfirmFlowOpen(true);
  };

  const handleStartDelivery = async (parcel: Parcel) => {
    if (startingDeliveryId) return;
    if (!messengerPosition && messengerGeoStatus !== 'loading') requestMessengerLocation();
    setStartingDeliveryId(parcel.TrackingID);
    const toastId = toast.loading('กำลังรับงาน...');
    const res = await startDelivery(
      parcel.TrackingID,
      messengerPosition?.latitude,
      messengerPosition?.longitude,
    );
    setStartingDeliveryId(null);

    if (!res.success) {
      const message = res.error?.includes('มีผู้รับงานแล้ว')
        ? 'งานนี้มีพนักงานคนอื่นรับไปแล้ว กรุณากดรีเฟรชข้อมูล'
        : res.error || 'รับงานไม่สำเร็จ';
      toast.error(message, { id: toastId });
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
    startRouteTracking(parcel.TrackingID);
    setMessengerView('mine');
    toast.success(res.autoPickedUp ? 'รับงานสำเร็จ (ระบุพิกัดแล้ว)' : (res.alreadyStarted ? 'อยู่ระหว่างจัดส่งแล้ว' : 'รับงานสำเร็จ'), { id: toastId });
    loadParcels(undefined, true).catch(() => {});
  };

  const handleReleaseDelivery = async (parcel: Parcel) => {
    if (releasingDeliveryId) return;
    setReleasingDeliveryId(parcel.TrackingID);
    const res = await releaseDelivery(parcel.TrackingID);
    setReleasingDeliveryId(null);

    if (!res.success) {
      toast.error(res.error || 'คืนงานไม่สำเร็จ');
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
    stopRouteTracking(parcel.TrackingID);
    void syncRouteSamples(parcel.TrackingID);
    setMessengerView('waiting');
    toast.success(res.alreadyReleased ? 'คืนงานเข้าระบบแล้ว' : 'คืนงานสำเร็จ');
    loadParcels(undefined, true).catch(() => {});
  };

  const executeDelete = async () => {
    if (!selectedParcel) return;
    const trackingID = selectedParcel.TrackingID;
    setIsTimelineOpen(false);
    setIsDeleteConfirmOpen(false);
    removeParcelLocally(trackingID);
    toast.success('กำลังดำเนินการลบรายการ...');
    const res = await deleteParcel(trackingID);
    if (res.success) {
      toast.success('ลบรายการเสร็จสิ้น');
    } else {
      toast.error('ไม่สามารถลบรายการได้ ระบบจะทำการรีโหลดข้อมูลใหม่');
      loadParcels(undefined, true);
    }
  };

  return {
    selectedParcel,
    setSelectedParcel,
    isTimelineOpen,
    setIsTimelineOpen,
    isDeliveryDetailsOpen,
    setIsDeliveryDetailsOpen,
    isDeleteConfirmOpen,
    setIsDeleteConfirmOpen,
    isEditParcelOpen,
    setIsEditParcelOpen,
    isSavingParcelEdit,
    confirmTrackingId,
    setConfirmTrackingId,
    isConfirmFlowOpen,
    setIsConfirmFlowOpen,
    messengerView,
    setMessengerView,
    startingDeliveryId,
    releasingDeliveryId,
    handleRefresh,
    handleDelete,
    openEditParcel,
    submitParcelEdit,
    executeBatchDelete,
    executeBatchStartDelivery,
    executeBatchConfirmDelivery,
    executeDelete,
    openConfirmFlow,
    handleStartDelivery,
    handleReleaseDelivery,
  };
}
