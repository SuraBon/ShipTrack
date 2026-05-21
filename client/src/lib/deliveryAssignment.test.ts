import { describe, expect, it } from 'vitest';
import {
  buildAssignmentNote,
  canConfirmMessengerJob,
  canReleaseMessengerJob,
  getActiveDeliveryAssignment,
  isAssignedToCurrentUser,
  isAvailableForMessenger,
} from './deliveryAssignment';
import type { Parcel } from '@/types/parcel';

const baseParcel: Parcel = {
  TrackingID: 'TRK1',
  'วันที่สร้าง': '1 มกราคม 2569',
  'ผู้ส่ง': 'A',
  'สาขาผู้ส่ง': 'MS',
  'ผู้รับ': 'B',
  'สาขาผู้รับ': 'มีนบุรี',
  'ประเภทเอกสาร': 'เอกสาร',
  'สถานะ': 'กำลังจัดส่ง',
};

describe('getActiveDeliveryAssignment', () => {
  it('returns the latest active messenger assignment', () => {
    const parcel: Parcel = {
      ...baseParcel,
      events: [{
        id: 'EVT1',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569 10:00',
        eventType: 'START_DELIVERY',
        location: 'MS',
        person: 'Messenger A',
        note: buildAssignmentNote('MSG_A'),
      }],
    };

    expect(getActiveDeliveryAssignment(parcel)).toMatchObject({
      assignedToId: 'MSG_A',
      assignedToName: 'Messenger A',
    });
  });

  it('clears assignment after release', () => {
    const parcel: Parcel = {
      ...baseParcel,
      events: [
        {
          id: 'EVT1',
          trackingId: 'TRK1',
          timestamp: '1 มกราคม 2569 10:00',
          eventType: 'START_DELIVERY',
          location: 'MS',
          person: 'Messenger A',
          note: buildAssignmentNote('MSG_A'),
        },
        {
          id: 'EVT2',
          trackingId: 'TRK1',
          timestamp: '1 มกราคม 2569 10:05',
          eventType: 'RELEASE_DELIVERY',
          location: 'MS',
          person: 'Messenger A',
          note: buildAssignmentNote('MSG_A'),
        },
      ],
    };

    expect(getActiveDeliveryAssignment(parcel)).toBeNull();
  });

  it('clears assignment after delivered or proxy event', () => {
    const assigned = {
      id: 'EVT1',
      trackingId: 'TRK1',
      timestamp: '1 มกราคม 2569 10:00',
      eventType: 'START_DELIVERY' as const,
      location: 'MS',
      person: 'Messenger A',
      note: buildAssignmentNote('MSG_A'),
    };

    expect(getActiveDeliveryAssignment({
      ...baseParcel,
      events: [{ ...assigned }, { ...assigned, id: 'EVT2', eventType: 'DELIVERED' }],
    })).toBeNull();

    expect(getActiveDeliveryAssignment({
      ...baseParcel,
      events: [{ ...assigned }, { ...assigned, id: 'EVT3', eventType: 'PROXY' }],
    })).toBeNull();
  });

  it('detects available and assigned messenger jobs', () => {
    const waitingParcel: Parcel = {
      ...baseParcel,
      'สถานะ': 'รอจัดส่ง',
      events: [],
    };
    const mineParcel: Parcel = {
      ...baseParcel,
      events: [{
        id: 'EVT1',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569 10:00',
        eventType: 'START_DELIVERY',
        location: 'MS',
        person: 'Messenger A',
        note: buildAssignmentNote('MSG_A'),
      }],
    };

    expect(isAvailableForMessenger(waitingParcel)).toBe(true);
    expect(isAvailableForMessenger(mineParcel)).toBe(false);
    expect(isAssignedToCurrentUser(mineParcel, 'msg_a')).toBe(true);
    expect(isAssignedToCurrentUser(mineParcel, 'MSG_B')).toBe(false);
  });

  it('guards release and confirm permissions', () => {
    const mineParcel: Parcel = {
      ...baseParcel,
      events: [{
        id: 'EVT1',
        trackingId: 'TRK1',
        timestamp: '1 มกราคม 2569 10:00',
        eventType: 'START_DELIVERY',
        location: 'MS',
        person: 'Messenger A',
        note: buildAssignmentNote('MSG_A'),
      }],
    };

    expect(canConfirmMessengerJob(mineParcel, 'MSG_A')).toBe(true);
    expect(canConfirmMessengerJob(mineParcel, 'MSG_B')).toBe(false);
    expect(canReleaseMessengerJob(mineParcel, 'MSG_A', 'MESSENGER')).toBe(true);
    expect(canReleaseMessengerJob(mineParcel, 'MSG_B', 'MESSENGER')).toBe(false);
    expect(canReleaseMessengerJob(mineParcel, 'ADMIN_1', 'ADMIN')).toBe(true);
    expect(canReleaseMessengerJob({ ...mineParcel, 'สถานะ': 'ส่งสำเร็จ' }, 'MSG_A', 'MESSENGER')).toBe(false);
  });
});
